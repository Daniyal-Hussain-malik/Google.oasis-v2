import { Base, D, enumCol, text } from './_base.js';

export const INSIGHT_TYPES = ['view', 'dwell', 'book_open', 'book_drop', 'room_view', 'exit_reason'];
// Rows older than this are deleted by purgeInsights() (MySQL has no automatic expiry).
export const INSIGHT_DAYS = 180;

export class Insight extends Base {}
Insight.setup(
  {
    sessionId: text({ len: 64, required: true }),
    type: enumCol(INSIGHT_TYPES),
    path: text({ len: 200 }),
    roomName: text({ len: 120 }),
    dwellMs: { type: D.INTEGER, allowNull: true, validate: { min: 0 } },
    reason: text({ len: 40 }),
    note: text({ len: 300 }),
    at: { type: D.DATE(3), allowNull: false, defaultValue: D.NOW },
  },
  { table: 'insights', timestamps: false, indexes: [{ fields: ['sessionId'] }, { fields: ['type'] }, { fields: ['at'] }] },
);

export async function purgeInsights() {
  const { Op } = await import('sequelize');
  return Insight.destroy({ where: { at: { [Op.lt]: new Date(Date.now() - INSIGHT_DAYS * 86400000) } } });
}

export default Insight;
