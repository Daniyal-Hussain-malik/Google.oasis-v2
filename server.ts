import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import { injectSeoHtml } from './src/lib/seoData.ts';

// Ensure SQLite local storage default before backend modules initialize
process.env.DB_DIALECT ||= 'sqlite';
process.env.DB_STORAGE ||= path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'oasis.sqlite');

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const ROOT = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const { initBackendSentry, captureBackendException } = await import('./backend/src/services/sentry.js');
  const { createHttpLogger, logger } = await import('./backend/src/services/logger.js');
  const { startBackupScheduler } = await import('./backend/src/services/backup.js');
  const { sendUptimeAlert, startUptimeWatchdog } = await import('./backend/src/services/monitoring.js');

  initBackendSentry();

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled Promise Rejection');
    captureBackendException(reason instanceof Error ? reason : new Error(String(reason)));
    sendUptimeAlert({
      key: 'unhandled_rejection',
      severity: 'critical',
      title: 'Unhandled Promise Rejection',
      message: reason instanceof Error ? reason.message : String(reason),
    }).catch(() => {});
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught Exception');
    captureBackendException(err);
  });

  const { bootstrapBackend } = await import('./backend/src/bootstrap.js');
  const { errorHandler, notFoundHandler } = await import('./backend/src/middleware/error.js');
  const { createCorsMiddleware, createHelmetMiddleware, verifyCookieCsrf } = await import('./backend/src/middleware/security.js');
  const { UPLOAD_DIR } = await import('./backend/src/middleware/upload.js');
  const { sequelize } = await import('./backend/src/config/db.js');
  const { default: adminRoutes } = await import('./backend/src/routes/admin/index.js');
  const { default: authRoutes } = await import('./backend/src/routes/auth.js');
  const { default: blogRoutes } = await import('./backend/src/routes/blog.js');
  const { default: guestRestaurantRoutes } = await import('./backend/src/routes/guestRestaurant.js');
  const { default: paymentClaimsRoutes } = await import('./backend/src/routes/paymentClaims.js');
  const { default: publicRoutes } = await import('./backend/src/routes/public.js');

  await bootstrapBackend();
  logger.info('Oasis Resort database initialized and seeded');

  startUptimeWatchdog();
  startBackupScheduler();

  // Background iCal sync every 15 minutes when enabled inbound feeds exist
  const { syncAllIcalSources } = await import('./backend/src/services/ical.js');
  setInterval(() => {
    syncAllIcalSources({ onlyAuto: true }).catch((err) => {
      logger.error({ err }, 'Background iCal auto-sync failed');
    });
  }, 15 * 60 * 1000).unref();

  const app = express();
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
  app.disable('x-powered-by');
  app.use(createHelmetMiddleware());
  app.use(createCorsMiddleware());
  app.use(createHttpLogger());
  app.use(cookieParser());
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    }),
  );
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

  app.use('/api/public/restaurant', guestRestaurantRoutes);
  app.use('/api/public/blog', blogRoutes);
  app.use('/api/public/payments', paymentClaimsRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', notFoundHandler);
  app.use('/uploads', notFoundHandler);

  const getBaseUrl = (req: express.Request) => {
    if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
    const safeHost = String(req.get('host') || 'localhost:3000').replace(/[^a-zA-Z0-9.:-]/g, '');
    const safeProto = req.protocol === 'https' ? 'https' : 'http';
    return `${safeProto}://${safeHost}`;
  };

  // Google Search Console verification file & crawl helpers
  app.get('/google4b4884c913b24aa5.html', (_req, res) => {
    res.type('text/html').send('google-site-verification: google4b4884c913b24aa5.html');
  });

  app.get('/robots.txt', (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nSitemap: ${baseUrl}/sitemap.xml\n`,
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = getBaseUrl(req);
    const pages = [
      '/',
      '/rooms',
      '/book',
      '/facilities',
      '/activities',
      '/experiences',
      '/dining',
      '/offers',
      '/around',
      '/gallery',
      '/blog',
      '/about',
      '/reviews',
      '/events',
      '/virtual-tour',
      '/directions',
      '/visit',
      '/faq',
      '/contact',
    ];
    const urls = pages
      .map(
        (p) =>
          `  <url>\n    <loc>${baseUrl}${p}</loc>\n    <changefreq>${p === '/' ? 'daily' : 'weekly'}</changefreq>\n    <priority>${p === '/' ? '1.0' : '0.8'}</priority>\n  </url>`,
      )
      .join('\n');
    res
      .type('application/xml')
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if ((req.method !== 'GET' && req.method !== 'HEAD') || path.extname(req.path)) return next();
      try {
        const rawTemplate = fs.readFileSync(path.resolve(ROOT, 'index.html'), 'utf-8');
        const seoTemplate = injectSeoHtml(rawTemplate, req.path, getBaseUrl(req));
        const html = await vite.transformIndexHtml(req.originalUrl, seoTemplate);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
  } else {
    const distDir = path.resolve(ROOT, 'dist');
    const distTemplate = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
    app.use(express.static(distDir, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if ((req.method !== 'GET' && req.method !== 'HEAD') || path.extname(req.path)) return next();
      const html = injectSeoHtml(distTemplate, req.path, getBaseUrl(req));
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    });
  }

  app.use(errorHandler);

  app.listen(PORT, HOST, () => {
    console.log(`Oasis Resort Skardu server running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Oasis Resort server:', err);
  process.exit(1);
});
