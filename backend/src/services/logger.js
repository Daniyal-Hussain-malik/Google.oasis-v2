import crypto from 'node:crypto';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { env } from '../config/env.js';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-settings-token"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.currentPassword',
  '*.newPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.webhookSecret',
  '*.apiKey',
  '*.code',
];

export const logger = pino({
  name: 'oasis-resort-api',
  level: env.logLevel || 'info',
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createHttpLogger() {
  return pinoHttp({
    logger,
    genReqId(req, res) {
      const existing = req.get('x-request-id');
      const id = existing && /^[a-zA-Z0-9._-]{8,64}$/.test(existing) ? existing : crypto.randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    customLogLevel(_req, res, err) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    autoLogging: {
      ignore(req) {
        return req.url === '/api/health' || req.url === '/api/health/live' || req.url?.startsWith('/assets/') || req.url?.startsWith('/photos/');
      },
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.ip || req.remoteAddress,
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    customSuccessMessage(req, res) {
      return `${req.method} ${req.url} -> ${res.statusCode}`;
    },
    customErrorMessage(req, res, err) {
      return `${req.method} ${req.url} -> ${res.statusCode}: ${err?.message || 'error'}`;
    },
  });
}

const SENSITIVE_KEY_RE = /(password|token|secret|cookie|authorization|apikey|otp|code)/i;

export function redactSensitiveObject(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactSensitiveObject(item, depth + 1));
  if (typeof value !== 'object') return value;

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEY_RE.test(k) ? '[REDACTED]' : redactSensitiveObject(v, depth + 1);
  }
  return out;
}
