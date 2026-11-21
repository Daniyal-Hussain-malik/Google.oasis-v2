import * as Sentry from '@sentry/react';

let initialized = false;

export function initFrontendSentry() {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        const clean = { ...event.request.headers };
        delete clean.cookie;
        delete clean.authorization;
        event.request.headers = clean;
      }
      if (event.request?.cookies) delete event.request.cookies;
      return event;
    },
  });

  initialized = true;
}

export { Sentry };
