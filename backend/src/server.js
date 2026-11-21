import { createApp } from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createSchema } from './db/schema.js';
import { purgeInsights } from './models/Insight.js';
import { env } from './config/env.js';
import { mailMode, verifyMail } from './services/mail.js';
import { migrateRoles } from './services/rolesMigration.js';

try {
  await connectDb();
  console.log(`${env.db.dialect === 'sqlite' ? 'SQLite' : 'MySQL'} connected: ${env.db.url ? env.db.url.replace(/\/\/[^@]*@/, '//***@') : `${env.db.user}@${env.db.host}:${env.db.port}/${env.db.name}`}`);
  // Creates any table that does not exist yet. Existing tables and data are never touched.
  if (process.env.DB_AUTO_SYNC !== 'false') await createSchema();
  const converted = await migrateRoles();
  if (converted) console.log(`Staff roles updated for ${converted} account${converted === 1 ? '' : 's'} (admin/manager -> Super admin, desk -> Front desk, kitchen -> Kitchen chef).`);
} catch (error) {
  console.error(`Could not connect to MySQL at ${env.db.url ? '(DB_URL)' : `${env.db.host}:${env.db.port}/${env.db.name}`}. Check DB_HOST, DB_USER, DB_PASSWORD and DB_NAME in .env, and that MySQL is running.`);
  console.error(error.message);
  process.exit(1);
}

// Website visit records older than 180 days are removed once a day.
const sweep = () => purgeInsights().catch((error) => console.error(`Insight cleanup failed: ${error.message}`));
sweep();
setInterval(sweep, 24 * 60 * 60 * 1000).unref();

const mail = await verifyMail();
if (mail.ok && mailMode === 'smtp') console.log(`Email: connected to ${env.mail.host} as ${env.mail.user || '(no login)'}; sending from ${env.mail.from}`);
else if (!mail.ok) console.error(`Email: NOT working (${mail.category}). ${mail.error}`);
if (env.production && !env.adminUrl.startsWith('https://')) console.warn('Email: ADMIN_URL is not https, so password reset links will not be secure. Use an https URL in production.');

const server = createApp().listen(env.port, () => {
  console.log(`Oasis API listening on http://localhost:${env.port}/api`);
});
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') console.error(`Port ${env.port} is already in use. Stop the other server or set PORT in .env.`);
  else console.error(error);
  process.exit(1);
});

function shutdown(signal) {
  console.log(`${signal} received, closing.`);
  // Open browser connections (the kitchen's live stream, keep-alive tabs) must not hold the port,
  // or the next start (npm run dev restarts on every file change) fails with "port in use".
  server.close(async () => {
    await disconnectDb().catch(() => {});
    process.exit(0);
  });
  server.closeAllConnections?.();
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
