import { Sequelize } from 'sequelize';
import { env } from './env.js';
import nodeSqliteDialect from './nodeSqliteDialect.js';

const { db } = env;
const common = {
  logging: false,
  define: { underscored: false, freezeTableName: true },
  timezone: '+00:00',
};

function create(overrides = {}) {
  const o = { ...db, ...overrides };
  if (o.dialect === 'sqlite') {
    return new Sequelize({ ...common, dialect: 'sqlite', storage: o.storage, dialectModule: nodeSqliteDialect });
  }
  const options = { ...common, dialect: 'mysql', dialectOptions: o.ssl ? { ssl: { rejectUnauthorized: true } } : {}, pool: { max: 10, min: 0, idle: 10000 } };
  if (o.url) return new Sequelize(o.url, options);
  return new Sequelize(o.name, o.user, o.password, { ...options, host: o.host, port: o.port });
}

export const sequelize = create();
export const isSqlite = () => sequelize.getDialect() === 'sqlite';

// Runs `fn(transaction)` in a transaction on MySQL. The SQLite used by the tests
// has one connection, so there the work simply runs.
export function tx(fn) {
  return isSqlite() ? fn(undefined) : sequelize.transaction(fn);
}

// Models are imported for their side effect of registering on `sequelize`.
export async function connectDb() {
  await import('../models/index.js');
  await sequelize.authenticate();
  return sequelize;
}

export async function disconnectDb() {
  await sequelize.close();
}
