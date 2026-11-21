import crypto from 'node:crypto';
import 'dotenv/config';

const production = process.env.NODE_ENV === 'production';

if (production && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in production.');
}

const runtimeJwtSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const runtimeRefreshSecret =
  process.env.JWT_REFRESH_SECRET ||
  crypto.createHmac('sha256', runtimeJwtSecret).update('oasis-refresh-token-key').digest('hex');

if (production && process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
  throw new Error('JWT_REFRESH_SECRET must be set to at least 32 characters in production.');
}

function normalizeOrigin(raw) {
  const value = String(raw || '').trim();
  if (!value || value === '*') return '';
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

const rawOriginList = [
  process.env.CORS_ORIGINS || '',
  process.env.CLIENT_ORIGIN || '',
  process.env.APP_URL || '',
  process.env.SITE_URL || '',
  process.env.ADMIN_URL || '',
]
  .join(',')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

const allowedOrigins = Array.from(new Set(rawOriginList));
const cookieSameSiteRaw = String(process.env.COOKIE_SAME_SITE || 'strict').trim().toLowerCase();
const cookieSameSite = ['strict', 'lax', 'none'].includes(cookieSameSiteRaw) ? cookieSameSiteRaw : 'strict';

const storageBucket = String(process.env.STORAGE_BUCKET || '').trim();
const storageAccessKey = String(process.env.STORAGE_ACCESS_KEY_ID || '').trim();
const storageSecretKey = String(process.env.STORAGE_SECRET_ACCESS_KEY || '').trim();
const explicitProvider = String(process.env.STORAGE_PROVIDER || '').trim().toLowerCase();
const storageProvider = ['s3', 'r2', 'gcs', 'local'].includes(explicitProvider)
  ? explicitProvider
  : storageBucket && storageAccessKey && storageSecretKey
    ? (process.env.R2_ACCOUNT_ID ? 'r2' : 's3')
    : 'local';

export const env = {
  production,
  port: Number(process.env.PORT) || 5000,
  db: {
    dialect: process.env.DB_DIALECT || 'mysql',
    url: process.env.DB_URL || '',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME || 'oasis_resort',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    storage: process.env.DB_STORAGE || ':memory:',
    ssl: process.env.DB_SSL === 'true',
  },
  jwtSecret: runtimeJwtSecret,
  jwtRefreshSecret: runtimeRefreshSecret,
  jwtExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshDays: Math.min(Math.max(Number(process.env.JWT_REFRESH_DAYS) || 7, 1), 90),
  cookieSameSite,
  allowedOrigins,
  clientOrigins: allowedOrigins,
  timezone: process.env.HOTEL_TIMEZONE || 'Asia/Karachi',
  adminEmail: String(process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  adminPassword: String(process.env.ADMIN_PASSWORD || ''),
  siteUrl: (process.env.SITE_URL || allowedOrigins[0] || 'http://localhost:3000').trim().replace(/\/$/, ''),
  adminUrl: (process.env.ADMIN_URL || process.env.FRONTEND_URL || allowedOrigins[0] || 'http://localhost:3000/admin').trim().replace(/\/$/, ''),
  storage: {
    provider: storageProvider,
    bucket: storageBucket,
    region: String(process.env.STORAGE_REGION || (storageProvider === 'r2' ? 'auto' : 'us-east-1')).trim(),
    endpoint: String(process.env.STORAGE_ENDPOINT || '').trim(),
    r2AccountId: String(process.env.R2_ACCOUNT_ID || '').trim(),
    accessKeyId: storageAccessKey,
    secretAccessKey: storageSecretKey,
    publicUrl: String(process.env.STORAGE_PUBLIC_URL || '').trim().replace(/\/$/, ''),
    prefix: String(process.env.STORAGE_KEY_PREFIX || '').trim().replace(/^\/+|\/+$/g, ''),
  },
  sms: {
    webhookUrl: String(process.env.SMS_WEBHOOK_URL || '').trim(),
    apiKey: String(process.env.SMS_API_KEY || '').trim(),
  },
  logLevel: String(process.env.LOG_LEVEL || (process.env.VITEST === 'true' ? 'silent' : 'info')).trim().toLowerCase(),
  sentry: {
    dsn: String(process.env.SENTRY_DSN || '').trim(),
    environment: String(process.env.SENTRY_ENVIRONMENT || (production ? 'production' : 'development')).trim(),
    tracesSampleRate: Math.min(Math.max(Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1, 0), 1),
  },
  monitoring: {
    alertWebhookUrl: String(process.env.UPTIME_ALERT_WEBHOOK_URL || '').trim(),
    alertMinIntervalMs: Math.max(Number(process.env.UPTIME_ALERT_MIN_INTERVAL_MIN) || 15, 1) * 60 * 1000,
    checkIntervalMs: Math.max(Number(process.env.UPTIME_CHECK_INTERVAL_SEC) || 60, 15) * 1000,
    errorSpikeThreshold: Math.max(Number(process.env.ERROR_SPIKE_THRESHOLD) || 10, 2),
  },
  backup: {
    enabled: process.env.BACKUP_ENABLED !== 'false' && process.env.VITEST !== 'true',
    intervalMs: Math.max(Number(process.env.BACKUP_INTERVAL_HOURS) || 24, 1) * 60 * 60 * 1000,
    retentionDays: Math.max(Number(process.env.BACKUP_RETENTION_DAYS) || 14, 1),
    dir: String(process.env.BACKUP_DIR || '').trim(),
  },
  mail: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || process.env.EMAIL_FROM || (process.env.SMTP_USER ? `Oasis Resort Skardu <${process.env.SMTP_USER}>` : 'Oasis Resort Skardu <no-reply@oasisresort.pk>'),
    adminTo: (process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || 'oasisresortskardu@gmail.com')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean),
  },
};
