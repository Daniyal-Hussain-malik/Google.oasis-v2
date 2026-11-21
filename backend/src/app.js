import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import { sequelize } from './config/db.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { createCorsMiddleware, createHelmetMiddleware, verifyCookieCsrf } from './middleware/security.js';
import { UPLOAD_DIR } from './middleware/upload.js';
import { createHttpLogger } from './services/logger.js';
import admin from './routes/admin/index.js';
import auth from './routes/auth.js';
import blog from './routes/blog.js';
import guestRestaurant from './routes/guestRestaurant.js';
import paymentClaims from './routes/paymentClaims.js';
import publicRoutes from './routes/public.js';

// Production layout: the built website in public/site, the built admin portal in public/admin.
const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Behind Nginx, Render, Railway, Cloud Run etc. the client IP and HTTPS protocol come from X-Forwarded-*.
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

  app.use(createHelmetMiddleware());
  app.use(createCorsMiddleware());
  app.use(createHttpLogger());
  app.use(cookieParser());
  app.use(express.json({
    limit: '200kb',
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  }));
  app.use(verifyCookieCsrf);

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  app.use('/uploads', express.static(UPLOAD_DIR, {
    maxAge: '30d',
    setHeaders: (res) => res.set('Cross-Origin-Resource-Policy', 'cross-origin'),
  }));

  app.get('/api/health/live', (_req, res) => {
    res.status(200).json({ ok: true, uptimeSeconds: Math.round(process.uptime()) });
  });

  app.get('/api/health', async (_req, res) => {
    const start = Date.now();
    const db = await sequelize.authenticate().then(() => 'connected', () => 'disconnected');
    res.status(db === 'connected' ? 200 : 503).json({
      ok: db === 'connected',
      db,
      latencyMs: Date.now() - start,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });
  // Opening the API address in a browser: say what this is instead of a 404.
  const index = async (req, res) => {
    const db = await sequelize.authenticate().then(() => 'connected', () => 'disconnected');
    res.json({
      name: 'Oasis Resort API',
      status: db === 'connected' ? 'running' : 'database not reachable',
      database: db,
      health: '/api/health',
      public: ['/api/public/hotel', '/api/public/site', '/api/public/room-types', '/api/public/menu', '/api/public/availability'],
      staff: 'Sign in at /api/auth/login, then use /api/admin/*',
      website: env.siteUrl,
      admin: env.adminUrl,
    });
  };
  app.get('/api', index);
  app.use('/api/public/restaurant', guestRestaurant);
  app.use('/api/public/blog', blog);
  app.use('/api/public/payments', paymentClaims);
  app.use('/api/public', publicRoutes);
  app.use('/api/auth', auth);
  app.use('/api/admin', admin);
  app.use('/api', notFoundHandler);

  // A missing upload is a 404, never the website page.
  app.use('/uploads', notFoundHandler);

  if (!fs.existsSync(path.join(PUBLIC_DIR, 'site'))) app.get('/', index);

  // One process serves everything: /admin is the staff portal, everything else is the website.
  const adminDir = path.join(PUBLIC_DIR, 'admin');
  const siteDir = path.join(PUBLIC_DIR, 'site');
  const page = (dir) => (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.sendFile(path.join(dir, 'index.html'), (error) => error && next());
  };
  if (fs.existsSync(adminDir)) {
    app.use('/admin', express.static(adminDir, { index: false, maxAge: '1h' }));
    app.use('/admin', page(adminDir));
  }
  if (fs.existsSync(siteDir)) {
    app.use(express.static(siteDir, { index: false, maxAge: '1h' }));
    app.use(page(siteDir));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
