// Creates the MySQL tables from the models (npm run db:setup) and adds the one
// foreign key that cannot be part of CREATE TABLE because two tables point at each
// other: restaurant_orders.billing_folioEntry -> reservation_folio.id.
import { sequelize } from '../config/db.js';
import '../models/index.js';

const LATE_FK = {
  table: 'restaurant_orders',
  field: 'billing_folioEntry',
  name: 'fk_orders_folio_entry',
  references: { table: 'reservation_folio', field: 'id' },
  onDelete: 'SET NULL',
};

export async function createSchema({ force = false } = {}) {
  const query = sequelize.getQueryInterface();
  const sqlite = sequelize.getDialect() === 'sqlite';
  // The cross link must go before the tables it joins are dropped.
  if (force && !sqlite) await query.removeConstraint(LATE_FK.table, LATE_FK.name).catch(() => {});
  await sequelize.sync({ force });
  if (!force) await migrateFeedbackSchema(query, sqlite);
  // SQLite (used only by the tests) cannot add a constraint to an existing table.
  if (sqlite) return;
  const existing = await query.getForeignKeyReferencesForTable(LATE_FK.table);
  if (!existing.some((row) => row.columnName === LATE_FK.field)) {
    await query.addConstraint(LATE_FK.table, {
      fields: [LATE_FK.field],
      type: 'foreign key',
      name: LATE_FK.name,
      references: LATE_FK.references,
      onDelete: LATE_FK.onDelete,
      onUpdate: 'CASCADE',
    });
  }
}

async function migrateFeedbackSchema(query, sqlite) {
  if (sqlite) {
    const [cols] = await sequelize.query(`PRAGMA table_info('feedback')`);
    if (!Array.isArray(cols) || cols.length === 0) return;
    const resCol = cols.find((c) => c.name === 'reservation');
    const hasEmail = cols.some((c) => c.name === 'email');
    const hasStayTitle = cols.some((c) => c.name === 'stayTitle');
    if (resCol && resCol.notnull === 0 && hasEmail && hasStayTitle) return;

    const { default: Feedback } = await import('../models/Feedback.js');
    await sequelize.query(`DROP TABLE IF EXISTS feedback_legacy_tmp`);
    await sequelize.query(`ALTER TABLE feedback RENAME TO feedback_legacy_tmp`);
    try {
      await Feedback.sync();
      const [legacyCols] = await sequelize.query(`PRAGMA table_info('feedback_legacy_tmp')`);
      const legacyNames = new Set((legacyCols || []).map((c) => c.name));
      const emailExpr = legacyNames.has('email') ? `COALESCE(email, '')` : `''`;
      const stayExpr = legacyNames.has('stayTitle') ? `COALESCE(stayTitle, '')` : `''`;
      await sequelize.query(
        `INSERT INTO feedback (id, reservation, bookingNumber, guestName, email, stayTitle, rating, comment, published, createdAt, updatedAt)
         SELECT id, reservation, COALESCE(bookingNumber, 'HOMEPAGE'), COALESCE(NULLIF(guestName, ''), 'Guest'), ${emailExpr}, ${stayExpr}, rating, COALESCE(comment, ''), COALESCE(published, 0), createdAt, updatedAt
         FROM feedback_legacy_tmp`,
      );
      await sequelize.query(`DROP TABLE feedback_legacy_tmp`);
    } catch (err) {
      await sequelize.query(`DROP TABLE IF EXISTS feedback`).catch(() => {});
      await sequelize.query(`ALTER TABLE feedback_legacy_tmp RENAME TO feedback`).catch(() => {});
      throw err;
    }
    return;
  }

  const desc = await query.describeTable('feedback').catch(() => null);
  if (!desc) return;
  if (!desc.email) {
    await query.addColumn('feedback', 'email', { type: sequelize.Sequelize.STRING(120), allowNull: false, defaultValue: '' });
  }
  if (!desc.stayTitle) {
    await query.addColumn('feedback', 'stayTitle', { type: sequelize.Sequelize.STRING(120), allowNull: false, defaultValue: '' });
  }
  if (desc.reservation && desc.reservation.allowNull === false) {
    await query.changeColumn('feedback', 'reservation', { type: sequelize.Sequelize.INTEGER, allowNull: true });
  }
}

export { LATE_FK };
