import cors from 'cors';
import helmet from 'helmet';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';

function storageOrigin() {
  if (!env.storage.publicUrl) return '';
  try {
    return new URL(env.storage.publicUrl).origin;
  } catch {
    return '';
  }
}

export function createHelmetMiddleware() {
  const mediaOrigin = storageOrigin();
  const imgSources = ["'self'", 'data:', 'blob:', 'https:', ...(mediaOrigin ? [mediaOrigin] : [])];

  return helmet({
    // Allow embedding inside AI Studio / Cloud Run preview frames when needed;
    // production deployments can restrict via CSP_FRAME_ANCESTORS.
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: env.production
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    contentSecurityPolicy: env.production
      ? {
          useDefaults: true,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
            imgSrc: imgSources,
            connectSrc: ["'self'", ...env.allowedOrigins],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            ...(process.env.CSP_FRAME_ANCESTORS
              ? {
                  frameAncestors: process.env.CSP_FRAME_ANCESTORS.split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }
              : {}),
          },
        }
      : false,
  });
}

function isOriginAllowedForRequest(origin, req) {
  if (!origin) return true;
  if (env.allowedOrigins.includes(origin)) return true;

  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    // Allow exact same-host origin (supports Cloud Run / custom proxy hosts without hardcoding)
    const forwardedHost = String(req.get('x-forwarded-host') || req.get('host') || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    if (forwardedHost && parsed.host.toLowerCase() === forwardedHost) {
      return true;
    }

    // In local development, permit localhost / 127.0.0.1 Vite & API ports
    if (!env.production && ['localhost', '127.0.0.1'].includes(parsed.hostname)) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function createCorsMiddleware() {
  return (req, res, next) => {
    const delegate = cors({
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Settings-Token'],
      maxAge: 600,
      origin(origin, done) {
        if (!origin) return done(null, true);
        if (isOriginAllowedForRequest(origin, req)) return done(null, true);
        return done(new HttpError(403, 'Origin not permitted by CORS policy.'));
      },
    });
    delegate(req, res, next);
  };
}

// Protects cookie-authenticated state-changing endpoints against CSRF by checking
// Origin/Referer against the request host/allowlist or requiring the custom X-Requested-With header.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT_PREFIXES = ['/api/public/whatsapp/webhook', '/api/public/ota/webhook'];

export function verifyCookieCsrf(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (CSRF_EXEMPT_PREFIXES.some((prefix) => req.path.startsWith(prefix))) return next();

  const hasAuthCookie = Boolean(
    req.cookies?.oasis_access || req.cookies?.oasis_refresh || req.cookies?.oasis_guest,
  );
  if (!hasAuthCookie) return next();

  const origin = req.get('origin');
  if (origin) {
    if (!isOriginAllowedForRequest(origin, req)) {
      return next(new HttpError(403, 'Cross-site request blocked.'));
    }
    return next();
  }

  const referer = req.get('referer');
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (!isOriginAllowedForRequest(refOrigin, req)) {
        return next(new HttpError(403, 'Cross-site request blocked.'));
      }
      return next();
    } catch {
      return next(new HttpError(403, 'Invalid request referer.'));
    }
  }

  if (req.get('x-requested-with')) return next();

  return next(new HttpError(403, 'Missing origin verification for cookie-authenticated request.'));
}
