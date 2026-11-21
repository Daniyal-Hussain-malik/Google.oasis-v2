import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { isSqlite, sequelize } from '../config/db.js';
import { env } from '../config/env.js';
import { badRequest, notFound } from '../utils/http.js';
import { logger } from './logger.js';
import { isCloudStorageConfigured, uploadBackupObject } from './storage.js';

const gzip = promisify(zlib.gzip);

const DEFAULT_BACKUP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backups');
const SAFE_BACKUP_NAME = /^oasis-(?:sqlite|snapshot)-[0-9]{8}-[0-9]{6}-[a-z0-9]{4}\.(?:sqlite|json)\.gz$/;

let schedulerTimer = null;
let backupInFlight = null;
let lastBackupSummary = null;

export function getBackupDir() {
  return env.backup.dir ? path.resolve(env.backup.dir) : DEFAULT_BACKUP_DIR;
}

function timestampSlug(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    '-',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join('');
}

async function exportLogicalSnapshotBuffer() {
  const models = {};
  for (const [name, model] of Object.entries(sequelize.models)) {
    const rows = await model.findAll({ raw: true });
    // Scrub password hashes from exported User records so offline snapshots remain safe
    models[name] = name === 'User' ? rows.map(({ passwordHash: _ph, ...rest }) => rest) : rows;
  }
  const payload = {
    version: 1,
    dialect: sequelize.getDialect(),
    exportedAt: new Date().toISOString(),
    models,
  };
  return gzip(Buffer.from(JSON.stringify(payload), 'utf8'));
}

async function pruneOldBackups(backupDir) {
  const cutoffMs = Date.now() - env.backup.retentionDays * 24 * 60 * 60 * 1000;
  let entries = [];
  try {
    entries = await fs.readdir(backupDir, { withFileTypes: true });
  } catch {
    return 0;
  }
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isFile() || !SAFE_BACKUP_NAME.test(entry.name)) continue;
    const fullPath = path.resolve(backupDir, entry.name);
    if (!fullPath.startsWith(backupDir + path.sep)) continue;
    const stat = await fs.stat(fullPath).catch(() => null);
    if (stat) candidates.push({ name: entry.name, fullPath, mtimeMs: stat.mtimeMs });
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  let removed = 0;
  // Always keep at least the newest 3 backups regardless of age
  for (let i = 3; i < candidates.length; i++) {
    if (candidates[i].mtimeMs < cutoffMs) {
      await fs.unlink(candidates[i].fullPath).catch(() => {});
      removed += 1;
    }
  }
  return removed;
}

export async function runDatabaseBackup({ triggeredBy = 'scheduler' } = {}) {
  if (backupInFlight) return backupInFlight;

  backupInFlight = (async () => {
    const started = Date.now();
    const backupDir = getBackupDir();
    await fs.mkdir(backupDir, { recursive: true });

    const suffix = crypto.randomBytes(2).toString('hex');
    const stamp = timestampSlug(new Date());
    let filename = '';
    let archiveBuffer = null;

    if (isSqlite() && env.db.storage && env.db.storage !== ':memory:') {
      const stagingName = `.staging-${stamp}-${suffix}.sqlite`;
      const stagingPath = path.resolve(backupDir, stagingName);
      if (!stagingPath.startsWith(backupDir + path.sep)) {
        throw badRequest('Invalid staging backup path.');
      }
      try {
        await sequelize.query('PRAGMA wal_checkpoint(TRUNCATE);').catch(() => {});
        await sequelize.query('VACUUM INTO ?', { replacements: [stagingPath] });
        const rawDb = await fs.readFile(stagingPath);
        archiveBuffer = await gzip(rawDb);
        filename = `oasis-sqlite-${stamp}-${suffix}.sqlite.gz`;
      } finally {
        await fs.unlink(stagingPath).catch(() => {});
      }
    } else {
      archiveBuffer = await exportLogicalSnapshotBuffer();
      filename = `oasis-snapshot-${stamp}-${suffix}.json.gz`;
    }

    const finalPath = path.resolve(backupDir, filename);
    if (!finalPath.startsWith(backupDir + path.sep)) {
      throw badRequest('Invalid backup file destination.');
    }
    await fs.writeFile(finalPath, archiveBuffer);

    const sha256 = crypto.createHash('sha256').update(archiveBuffer).digest('hex');
    let cloud = null;
    if (isCloudStorageConfigured()) {
      cloud = await uploadBackupObject({
        filename,
        buffer: archiveBuffer,
        contentType: 'application/gzip',
      });
    }

    const pruned = await pruneOldBackups(backupDir);
    const summary = {
      filename,
      dialect: sequelize.getDialect(),
      sizeBytes: archiveBuffer.length,
      sha256,
      cloudKey: cloud?.key || null,
      cloudProvider: cloud?.provider || null,
      triggeredBy,
      prunedCount: pruned,
      durationMs: Date.now() - started,
      createdAt: new Date().toISOString(),
    };
    lastBackupSummary = summary;
    logger.info({ backup: summary }, 'Database backup completed');
    return summary;
  })();

  try {
    return await backupInFlight;
  } finally {
    backupInFlight = null;
  }
}

export async function listBackups() {
  const backupDir = getBackupDir();
  let entries = [];
  try {
    entries = await fs.readdir(backupDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const items = [];
  for (const entry of entries) {
    if (!entry.isFile() || !SAFE_BACKUP_NAME.test(entry.name)) continue;
    const fullPath = path.resolve(backupDir, entry.name);
    if (!fullPath.startsWith(backupDir + path.sep)) continue;
    const stat = await fs.stat(fullPath).catch(() => null);
    if (!stat) continue;
    items.push({
      filename: entry.name,
      sizeBytes: stat.size,
      createdAt: stat.mtime.toISOString(),
    });
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return items;
}

export async function resolveBackupDownloadPath(filename) {
  const clean = String(filename || '').trim();
  if (!SAFE_BACKUP_NAME.test(clean)) {
    throw badRequest('Invalid backup filename.');
  }
  const backupDir = getBackupDir();
  const resolved = path.resolve(backupDir, clean);
  if (!resolved.startsWith(backupDir + path.sep)) {
    throw badRequest('Invalid backup path.');
  }
  try {
    await fs.access(resolved);
    return resolved;
  } catch {
    throw notFound('Backup archive not found.');
  }
}

export async function getBackupStatus() {
  const backups = await listBackups();
  return {
    enabled: env.backup.enabled,
    intervalHours: Math.round(env.backup.intervalMs / (60 * 60 * 1000)),
    retentionDays: env.backup.retentionDays,
    cloudSyncEnabled: isCloudStorageConfigured(),
    totalLocalBackups: backups.length,
    latest: lastBackupSummary || backups[0] || null,
  };
}

export function startBackupScheduler() {
  if (!env.backup.enabled || schedulerTimer) return;

  // Run an initial catch-up backup shortly after startup if no backup exists within the last interval
  setTimeout(async () => {
    try {
      const existing = await listBackups();
      const latestMs = existing[0] ? new Date(existing[0].createdAt).getTime() : 0;
      if (!latestMs || Date.now() - latestMs >= env.backup.intervalMs) {
        await runDatabaseBackup({ triggeredBy: 'startup_catchup' });
      }
    } catch (err) {
      logger.error({ err }, 'Startup catch-up database backup failed');
    }
  }, 20 * 1000).unref();

  schedulerTimer = setInterval(() => {
    runDatabaseBackup({ triggeredBy: 'daily_scheduler' }).catch((err) => {
      logger.error({ err }, 'Scheduled database backup failed');
    });
  }, env.backup.intervalMs);
  schedulerTimer.unref();
}

export function stopBackupScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
