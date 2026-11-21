import { Op, fn, col, where, literal as literalSql } from 'sequelize';
import { sequelize } from '../config/db.js';

// A "contains, ignoring case" filter. % and _ typed by a person are dropped so they
// cannot act as wildcards.
export const contains = (value) => ({ [Op.like]: `%${String(value).replace(/[%_\\]/g, '')}%` });

// Case-insensitive equality that behaves the same on MySQL and SQLite.
export const equalsNoCase = (column, value) => where(fn('LOWER', col(column)), String(value).toLowerCase());

export const isDuplicate = (error) => error?.name === 'SequelizeUniqueConstraintError';

// Reads rows that came back from a GROUP BY. SUM() can arrive as a string on MySQL.
export const num = (value) => Number(value) || 0;

// Replaces ids with { _id, ...fields } in API output, the way a populated reference
// used to look: populate(json, 'history.by', User). `path` may go through lists.
export async function populate(docs, path, Model, attrs = ['name']) {
  const list = Array.isArray(docs) ? docs : [docs];
  const parts = path.split('.');
  const key = parts.at(-1);
  const holders = [];
  const walk = (node, depth) => {
    if (node == null) return;
    if (depth === parts.length - 1) { holders.push(node); return; }
    for (const next of [].concat(node[parts[depth]] ?? [])) walk(next, depth + 1);
  };
  list.forEach((doc) => walk(doc, 0));
  const ids = [...new Set(holders.map((holder) => holder[key]).filter((value) => value != null && typeof value !== 'object'))].map(Number);
  if (!ids.length) return docs;
  const rows = await Model.findAll({ where: { id: ids }, attributes: ['id', ...attrs], raw: true });
  const byId = new Map(rows.map((row) => [String(row.id), { _id: String(row.id), ...Object.fromEntries(attrs.map((name) => [name, row[name]])) }]));
  for (const holder of holders) if (holder[key] != null && byId.has(String(holder[key]))) holder[key] = byId.get(String(holder[key]));
  return docs;
}

// Reservations whose assigned rooms match a room number (substring).
export const roomNoMatches = (value) => literalSql(
  `(SELECT \`reservationId\` FROM \`reservation_rooms\` WHERE \`roomNo\` LIKE ${sequelize.escape(`%${String(value).replace(/[%_\\]/g, '')}%`)})`,
);
