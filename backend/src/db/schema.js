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
  if (!force) await migrateRoomNightsSchema(query, sqlite);
  await sequelize.sync({ force });
  if (!force) {
    await migrateReservationSourceEnum(query, sqlite);
    await migrateFeedbackSchema(query, sqlite);
    await migratePaymentClaimsSchema(query, sqlite);
  }
  await ensureRoomNightUniqueIndex(query, sqlite);
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

async function migrateRoomNightsSchema(query, sqlite) {
  const { OtaCalendarBlock, OtaIcalSource } = await import('../models/OtaSync.js');
  if (sqlite) {
    const [cols] = await sequelize.query(`PRAGMA table_info('room_nights')`);
    if (!Array.isArray(cols) || cols.length === 0) return;
    const resCol = cols.find((c) => c.name === 'reservation');
    const hasOtaBlock = cols.some((c) => c.name === 'otaBlock');
    if (resCol && resCol.notnull === 0 && hasOtaBlock) return;

    await OtaIcalSource.sync();
    await OtaCalendarBlock.sync();
    const { default: RoomNight } = await import('../models/RoomNight.js');
    await sequelize.query(`PRAGMA foreign_keys = OFF`);
    try {
      await sequelize.query(`DROP TABLE IF EXISTS room_nights_legacy_tmp`);
      await sequelize.query(`ALTER TABLE room_nights RENAME TO room_nights_legacy_tmp`);
      try {
        const [legacyIdxs] = await sequelize.query(`PRAGMA index_list('room_nights_legacy_tmp')`);
        for (const idx of legacyIdxs || []) {
          if (idx.origin === 'pk' || String(idx.name || '').startsWith('sqlite_autoindex_')) continue;
          const safeIdx = String(idx.name || '').replace(/`/g, '');
          if (safeIdx) await sequelize.query(`DROP INDEX IF EXISTS \`${safeIdx}\``);
        }
        await RoomNight.sync();
        const [legacyCols] = await sequelize.query(`PRAGMA table_info('room_nights_legacy_tmp')`);
        const legacyNames = new Set((legacyCols || []).map((c) => c.name));
        const otaExpr = legacyNames.has('otaBlock') ? 'otaBlock' : 'NULL';
        await sequelize.query(
          `INSERT INTO room_nights (id, room, date, reservation, otaBlock)
           SELECT id, room, date, reservation, ${otaExpr}
           FROM room_nights_legacy_tmp`,
        );
        await sequelize.query(`DROP TABLE room_nights_legacy_tmp`);
      } catch (err) {
        await sequelize.query(`DROP TABLE IF EXISTS room_nights`).catch(() => {});
        await sequelize.query(`ALTER TABLE room_nights_legacy_tmp RENAME TO room_nights`).catch(() => {});
        throw err;
      }
    } finally {
      await sequelize.query(`PRAGMA foreign_keys = ON`).catch(() => {});
    }
    return;
  }

  const desc = await query.describeTable('room_nights').catch(() => null);
  if (!desc) return;
  if (!desc.otaBlock) {
    await OtaIcalSource.sync();
    await OtaCalendarBlock.sync();
    await query.addColumn('room_nights', 'otaBlock', {
      type: sequelize.Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'ota_calendar_blocks', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  }
  if (desc.reservation && desc.reservation.allowNull === false) {
    await query.changeColumn('room_nights', 'reservation', {
      type: sequelize.Sequelize.INTEGER,
      allowNull: true,
    });
  }
}

async function migrateReservationSourceEnum(query, sqlite) {
  if (sqlite) return;
  const desc = await query.describeTable('reservations').catch(() => null);
  if (!desc?.source) return;
  const { SOURCES } = await import('../models/Reservation.js');
  await query.changeColumn('reservations', 'source', {
    type: sequelize.Sequelize.ENUM(...SOURCES),
    allowNull: false,
    defaultValue: 'website',
  });
}

async function ensureRoomNightUniqueIndex(query, sqlite) {
  if (sqlite) {
    const [indexes] = await sequelize.query(`PRAGMA index_list('room_nights')`);
    for (const idx of indexes || []) {
      if (!idx.unique) continue;
      const safeName = String(idx.name || '').replace(/'/g, "''");
      const [cols] = await sequelize.query(`PRAGMA index_info('${safeName}')`);
      const names = (cols || []).map((col) => col.name);
      if (names.length === 2 && names[0] === 'room' && names[1] === 'date') return;
    }
    await query.addIndex('room_nights', {
      name: 'uniq_room_nights_room_date',
      unique: true,
      fields: ['room', 'date'],
    });
    return;
  }

  const indexes = await query.showIndex('room_nights').catch(() => []);
  const hasUnique = (indexes || []).some((idx) => {
    if (!idx.unique) return false;
    const names = (idx.fields || []).map((field) => field.attribute);
    return names.length === 2 && names[0] === 'room' && names[1] === 'date';
  });
  if (!hasUnique) {
    await query.addIndex('room_nights', {
      name: 'uniq_room_nights_room_date',
      unique: true,
      fields: ['room', 'date'],
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

async function migratePaymentClaimsSchema(query, sqlite) {
  if (sqlite) {
    const [cols] = await sequelize.query(`PRAGMA table_info('payment_claims')`);
    if (!Array.isArray(cols) || cols.length === 0) return;
    if (!cols.some((c) => c.name === 'proofImageUrl')) {
      await sequelize.query(`ALTER TABLE payment_claims ADD COLUMN proofImageUrl VARCHAR(500) NOT NULL DEFAULT ''`);
    }
    return;
  }
  const desc = await query.describeTable('payment_claims').catch(() => null);
  if (desc && !desc.proofImageUrl) {
    await query.addColumn('payment_claims', 'proofImageUrl', {
      type: sequelize.Sequelize.STRING(500),
      allowNull: false,
      defaultValue: '',
    });
  }
}

export { LATE_FK };
