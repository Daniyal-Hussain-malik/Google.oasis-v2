import { AsyncLocalStorage } from 'node:async_hooks';
import { Sequelize, Transaction } from 'sequelize';
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

const activeTx = new AsyncLocalStorage();
let sqliteTxQueue = Promise.resolve();

export function currentTx() {
  return activeTx.getStore();
}

// Row-level pessimistic lock (SELECT ... FOR UPDATE) for dialects that support it
// (MySQL / MariaDB / Postgres). SQLite relies on serialized BEGIN IMMEDIATE transactions.
export function lockForUpdate(transaction) {
  return !isSqlite() && transaction?.LOCK?.UPDATE ? { lock: transaction.LOCK.UPDATE } : {};
}

// Runs `fn(transaction)` inside a database transaction.
// Re-entrant calls within the same async execution reuse the active transaction.
// On SQLite's single shared connection, transactions are serialized in-process and
// started with BEGIN IMMEDIATE so concurrent bookings cannot interleave or race.
export function tx(fn) {
  const existing = activeTx.getStore();
  if (existing) return fn(existing);

  if (!isSqlite()) {
    return sequelize.transaction((transaction) => activeTx.run(transaction, () => fn(transaction)));
  }

  const run = sqliteTxQueue.then(() =>
    sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE }, (transaction) =>
      activeTx.run(transaction, () => fn(transaction)),
    ),
  );
  sqliteTxQueue = run.catch(() => {});
  return run;
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
