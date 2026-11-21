import net from 'node:net';
import { sequelize } from '../config/db.js';
import { env } from '../config/env.js';
import { badRequest } from '../utils/http.js';
import { getBackupStatus } from './backup.js';
import { logger } from './logger.js';
import { notify } from './mail.js';
import { getSentryStatus } from './sentry.js';
import { getStorageStatus } from './storage.js';

let watchdogTimer = null;
let currentState = 'unknown'; // 'unknown' | 'healthy' | 'degraded'
const lastAlertSentByKey = new Map();
const recentErrors = []; // timestamps of 5xx errors in rolling window
const alertHistory = [];

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', 'metadata.google.internal']);

function isPrivateIp(host) {
  const ipType = net.isIP(host);
  if (!ipType) return false;
  if (ipType === 4) {
    const parts = host.split('.').map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  }
  const lower = host.toLowerCase();
  return lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd');
}

export function validateAlertWebhookUrl(rawUrl) {
  const clean = String(rawUrl || '').trim();
  if (!clean) return null;
  let parsed;
  try {
    parsed = new URL(clean);
  } catch {
    throw badRequest('Invalid uptime alert webhook URL.');
  }
  if (parsed.protocol !== 'https:' && (env.production || parsed.protocol !== 'http:')) {
    throw badRequest('Uptime alert webhook URL must use HTTPS.');
  }
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || isPrivateIp(host)) {
    throw badRequest('Uptime alert webhook host cannot target loopback or private networks.');
  }
  return parsed.toString();
}

export function recordServerError(err, req) {
  const now = Date.now();
  recentErrors.push(now);
  // Keep 15-minute rolling window
  while (recentErrors.length && now - recentErrors[0] > 15 * 60 * 1000) {
    recentErrors.shift();
  }

  const last5MinCount = recentErrors.filter((t) => now - t <= 5 * 60 * 1000).length;
  if (last5MinCount >= env.monitoring.errorSpikeThreshold) {
    sendUptimeAlert({
      key: 'error_spike',
      severity: 'warning',
      title: `Elevated 5xx Error Rate (${last5MinCount} errors / 5m)`,
      message: `Recent failure on ${req?.method || 'SERVER'} ${req?.originalUrl || req?.url || ''}: ${err?.message || 'Internal error'}`,
      details: { countLast5Min: last5MinCount },
    }).catch(() => {});
  }
}

export async function checkSystemHealth() {
  const dbStart = Date.now();
  let db = 'disconnected';
  let dbLatencyMs = null;
  let dbError = null;
  try {
    await sequelize.authenticate();
    db = 'connected';
    dbLatencyMs = Date.now() - dbStart;
  } catch (err) {
    dbError = err?.message || 'Database check failed';
  }

  const now = Date.now();
  while (recentErrors.length && now - recentErrors[0] > 15 * 60 * 1000) {
    recentErrors.shift();
  }

  const mem = process.memoryUsage();
  const [storage, backup] = await Promise.all([
    Promise.resolve(getStorageStatus()),
    getBackupStatus().catch(() => null),
  ]);

  return {
    ok: db === 'connected',
    status: db === 'connected' ? 'healthy' : 'degraded',
    db,
    dbDialect: sequelize.getDialect(),
    dbLatencyMs,
    ...(dbError ? { dbError } : {}),
    uptimeSeconds: Math.round(process.uptime()),
    memoryMb: {
      rss: Math.round(mem.rss / (1024 * 1024)),
      heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
      heapTotal: Math.round(mem.heapTotal / (1024 * 1024)),
    },
    errorsLast15m: recentErrors.length,
    sentry: getSentryStatus(),
    logging: { engine: 'pino', level: env.logLevel },
    storage,
    backup,
    alerts: {
      webhookConfigured: Boolean(env.monitoring.alertWebhookUrl),
      emailRecipients: env.mail.adminTo.length,
      recent: alertHistory.slice(0, 10),
    },
    timestamp: new Date().toISOString(),
  };
}

export async function sendUptimeAlert({ key = 'general', severity = 'warning', title, message, details = {}, force = false }) {
  const now = Date.now();
  const lastSent = lastAlertSentByKey.get(key) || 0;
  if (!force && now - lastSent < env.monitoring.alertMinIntervalMs) {
    return { sent: false, skippedReason: 'cooldown' };
  }
  lastAlertSentByKey.set(key, now);

  const entry = {
    id: `${now}-${key}`,
    severity,
    title,
    message,
    details,
    channels: [],
    at: new Date().toISOString(),
  };

  if (env.monitoring.alertWebhookUrl) {
    try {
      const target = validateAlertWebhookUrl(env.monitoring.alertWebhookUrl);
      if (target) {
        const res = await fetch(target, {
          method: 'POST',
          signal: AbortSignal.timeout(6000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `[${severity.toUpperCase()}] Oasis Resort Skardu — ${title}\n${message}`,
            service: 'oasis-resort-skardu',
            severity,
            title,
            message,
            details,
            timestamp: entry.at,
          }),
        });
        if (res.ok) entry.channels.push('webhook');
        else logger.warn({ statusCode: res.status, key }, 'Uptime webhook returned non-2xx');
      }
    } catch (err) {
      logger.warn({ err: err?.message, key }, 'Failed to dispatch uptime webhook alert');
    }
  }

  if (env.mail.adminTo.length) {
    try {
      const mailed = await notify({
        to: env.mail.adminTo,
        subject: `[Oasis Monitoring · ${severity.toUpperCase()}] ${title}`,
        text: `${title}\n\n${message}\n\nTimestamp: ${entry.at}\nDetails: ${JSON.stringify(details)}`,
        html: `<h3>[${severity.toUpperCase()}] ${title}</h3><p>${message}</p><pre>${JSON.stringify(details, null, 2)}</pre>`,
      });
      if (mailed) entry.channels.push('email');
    } catch (err) {
      logger.warn({ err: err?.message, key }, 'Failed to send uptime email alert');
    }
  }

  if (entry.channels.length === 0) {
    entry.channels.push('logged');
  }

  alertHistory.unshift(entry);
  if (alertHistory.length > 25) alertHistory.length = 25;

  logger[severity === 'critical' ? 'error' : 'info']({ alert: entry }, `Uptime alert: ${title}`);
  return { sent: true, entry };
}

export function startUptimeWatchdog() {
  if (process.env.VITEST === 'true' || watchdogTimer) return;

  watchdogTimer = setInterval(async () => {
    try {
      const health = await checkSystemHealth();
      const nextState = health.ok ? 'healthy' : 'degraded';
      if (currentState !== 'degraded' && nextState === 'degraded') {
        await sendUptimeAlert({
          key: 'db_outage',
          severity: 'critical',
          title: 'Database connectivity lost',
          message: health.dbError || 'Health probe could not reach database.',
          details: { dbDialect: health.dbDialect },
        });
      } else if (currentState === 'degraded' && nextState === 'healthy') {
        await sendUptimeAlert({
          key: 'db_recovered',
          severity: 'info',
          title: 'Database connectivity recovered',
          message: `Service healthy again (DB latency ${health.dbLatencyMs}ms).`,
          details: { dbLatencyMs: health.dbLatencyMs },
          force: true,
        });
      }
      currentState = nextState;
    } catch (err) {
      logger.error({ err }, 'Uptime watchdog probe error');
    }
  }, env.monitoring.checkIntervalMs);
  watchdogTimer.unref();
}

export function stopUptimeWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}
