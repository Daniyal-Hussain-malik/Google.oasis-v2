import * as Sentry from '@sentry/node';
import { env } from '../config/env.js';
import { logger, redactSensitiveObject } from './logger.js';

let initialized = false;

export function initBackendSentry() {
  if (initialized) return true;
  if (!env.sentry.dsn) return false;

  Sentry.init({
    dsn: env.sentry.dsn,
    environment: env.sentry.environment,
    tracesSampleRate: env.sentry.tracesSampleRate,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        const cleanHeaders = { ...event.request.headers };
        delete cleanHeaders.cookie;
        delete cleanHeaders.authorization;
        delete cleanHeaders['x-settings-token'];
        event.request.headers = cleanHeaders;
      }
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.data && typeof event.request.data === 'object') {
        event.request.data = redactSensitiveObject(event.request.data);
      }
      if (event.extra) {
        event.extra = redactSensitiveObject(event.extra);
      }
      return event;
    },
  });

  initialized = true;
  logger.info({ environment: env.sentry.environment }, 'Backend Sentry crash tracking initialized');
  return true;
}

export function captureBackendException(error, context = {}) {
  if (!initialized) return null;
  return Sentry.withScope((scope) => {
    if (context.requestId) scope.setTag('requestId', String(context.requestId));
    if (context.method) scope.setTag('http.method', String(context.method));
    if (context.path) scope.setTag('http.path', String(context.path));
    if (context.userId) scope.setUser({ id: String(context.userId), role: context.userRole });
    if (context.extra) scope.setExtras(redactSensitiveObject(context.extra));
    return Sentry.captureException(error);
  });
}

export function getSentryStatus() {
  return {
    configured: Boolean(env.sentry.dsn),
    initialized,
    environment: env.sentry.environment,
  };
}
