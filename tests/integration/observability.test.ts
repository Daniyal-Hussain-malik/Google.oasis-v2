import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../backend/src/app.js';
import { bootstrapBackend } from '../../backend/src/bootstrap.js';
import { disconnectDb } from '../../backend/src/config/db.js';
import { env } from '../../backend/src/config/env.js';
import { listBackups, resolveBackupDownloadPath, runDatabaseBackup } from '../../backend/src/services/backup.js';
import { validateAlertWebhookUrl } from '../../backend/src/services/monitoring.js';

describe('observability, health probes, and automated backups', () => {
  let app: any;
  let tempBackupDir: string;

  beforeAll(async () => {
    tempBackupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oasis-backups-test-'));
    env.backup.dir = tempBackupDir;
    await bootstrapBackend();
    app = createApp();
  });

  afterAll(async () => {
    await disconnectDb();
    await fs.rm(tempBackupDir, { recursive: true, force: true });
  });

  it('serves /api/health and /api/health/live with request-id correlation headers', async () => {
    const live = await request(app).get('/api/health/live');
    expect(live.status).toBe(200);
    expect(live.body.ok).toBe(true);
    expect(live.headers['x-request-id']).toBeTruthy();

    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({ ok: true, db: 'connected' });
    expect(typeof health.body.latencyMs).toBe('number');
  });

  it('blocks loopback and private-network alert webhook URLs against SSRF', () => {
    expect(() => validateAlertWebhookUrl('http://127.0.0.1:8080/hook')).toThrow(/loopback or private/i);
    expect(() => validateAlertWebhookUrl('https://169.254.169.254/latest/meta-data')).toThrow(/loopback or private/i);
    expect(() => validateAlertWebhookUrl('https://10.0.0.5/alert')).toThrow(/loopback or private/i);
    expect(validateAlertWebhookUrl('https://hooks.slack.com/services/T000/B000/XXXX')).toBe(
      'https://hooks.slack.com/services/T000/B000/XXXX',
    );
  });

  it('creates compressed database snapshots with SHA-256 checksums and blocks backup path traversal', async () => {
    const summary = await runDatabaseBackup({ triggeredBy: 'vitest' });
    expect(summary.filename).toMatch(/^oasis-snapshot-.*\.json\.gz$/);
    expect(summary.sizeBytes).toBeGreaterThan(100);
    expect(summary.sha256).toMatch(/^[a-f0-9]{64}$/);

    const backups = await listBackups();
    expect(backups.some((b: any) => b.filename === summary.filename)).toBe(true);

    const safePath = await resolveBackupDownloadPath(summary.filename);
    expect(safePath.startsWith(tempBackupDir)).toBe(true);

    await expect(resolveBackupDownloadPath('../../etc/passwd')).rejects.toThrow(/Invalid backup filename/i);
  });
});
