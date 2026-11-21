// Creates every missing table in the MySQL database named in .env.   npm run db:setup
// Existing tables and their data are never changed. The server does the same on start.
import { connectDb, disconnectDb, sequelize } from '../config/db.js';
import { createSchema } from '../db/schema.js';

try {
  await connectDb();
  await createSchema();
  const tables = await sequelize.getQueryInterface().showAllTables();
  console.log(`Database ready: ${tables.length} tables.`);
  console.log('Next: npm run seed   (rooms, menu, website text and the first admin account)');
} catch (error) {
  console.error(`Could not set up the database: ${error.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDb().catch(() => {});
}
