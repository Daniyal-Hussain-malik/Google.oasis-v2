import { Router } from 'express';
import { col, fn, Op } from 'sequelize';
import { env } from '../../config/env.js';
import { ACCESS } from '../../config/roles.js';
import { requireRole } from '../../middleware/auth.js';
import Enquiry from '../../models/Enquiry.js';
import Insight from '../../models/Insight.js';
import Reservation, { HOLDING, ReservationNight } from '../../models/Reservation.js';
import Room from '../../models/Room.js';
import RoomNight from '../../models/RoomNight.js';
import { addDays, todayIn } from '../../utils/dates.js';
import { int } from '../../utils/http.js';

const router = Router();
const n = (value) => Number(value) || 0;

// The front desk's morning screen.
router.get('/dashboard', async (req, res) => {
  const today = todayIn(env.timezone);
  const [arrivals, departures, inHouse, rooms, soldTonight, newEnquiries, upcoming] = await Promise.all([
    Reservation.findAll({ where: { checkIn: today, status: 'confirmed' }, order: [['createdAt', 'ASC']] }),
    Reservation.findAll({ where: { checkOut: today, status: 'checked_in' }, order: [['createdAt', 'ASC']] }),
    Reservation.count({ where: { status: 'checked_in' } }),
    Room.count({ where: { status: 'active' } }),
    RoomNight.count({ where: { date: today } }),
    Enquiry.count({ where: { status: 'new' } }),
    Reservation.count({ where: { status: 'confirmed', checkIn: { [Op.gt]: today, [Op.lte]: addDays(today, 7) } } }),
  ]);
  res.json({
    businessDate: today,
    arrivals,
    departures,
    inHouse,
    rooms,
    soldTonight,
    occupancy: rooms ? Math.round((soldTonight / rooms) * 100) : 0,
    newEnquiries,
    arrivalsNext7Days: upcoming,
  });
});

// Occupancy and room revenue by night, for a range of up to 92 days.
router.get('/occupancy', async (req, res) => {
  const today = todayIn(env.timezone);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : today;
  const days = Math.min(Math.max(int(req.query.days, 30), 1), 92);
  const to = addDays(from, days);
  const stays = await Reservation.findAll({
    attributes: ['id'],
    where: { status: [...HOLDING, 'checked_out'], checkOut: { [Op.gt]: from }, checkIn: { [Op.lt]: to } },
    raw: true,
  });
  const [rooms, nights, revenue] = await Promise.all([
    Room.count({ where: { status: 'active' } }),
    RoomNight.findAll({ attributes: ['date', [fn('COUNT', col('id')), 'sold']], where: { date: { [Op.gte]: from, [Op.lt]: to } }, group: ['date'], raw: true }),
    stays.length
      ? ReservationNight.findAll({
        attributes: ['date', [fn('SUM', col('rate')), 'revenue']],
        where: { reservationId: stays.map((stay) => stay.id), date: { [Op.gte]: from, [Op.lt]: to } },
        group: ['date'],
        raw: true,
      })
      : [],
  ]);
  const sold = new Map(nights.map((row) => [row.date, n(row.sold)]));
  const money = new Map(revenue.map((row) => [row.date, n(row.revenue)]));
  const series = Array.from({ length: days }, (_, index) => {
    const date = addDays(from, index);
    const count = sold.get(date) || 0;
    return { date, sold: count, rooms, occupancy: rooms ? Math.round((count / rooms) * 100) : 0, revenue: money.get(date) || 0 };
  });
  res.json({ from, to, series });
});

// Website behaviour: where people look, where the booking form loses them, and why they leave.
router.get('/insights', requireRole(...ACCESS.superAdmin), async (req, res) => {
  const days = Math.min(Math.max(int(req.query.days, 30), 1), 180);
  const since = new Date(Date.now() - days * 86400000);
  const match = { at: { [Op.gte]: since } };
  const [byType, topPages, rooms, reasonRows, sessions, bookings] = await Promise.all([
    Insight.findAll({ attributes: ['type', [fn('COUNT', col('id')), 'count']], where: match, group: ['type'], raw: true }),
    Insight.findAll({ attributes: ['path', [fn('COUNT', col('id')), 'views']], where: { ...match, type: 'view' }, group: ['path'], order: [[fn('COUNT', col('id')), 'DESC']], limit: 15, raw: true }),
    Insight.findAll({ attributes: ['roomName', [fn('COUNT', col('id')), 'views']], where: { ...match, type: 'room_view', roomName: { [Op.ne]: '' } }, group: ['roomName'], order: [[fn('COUNT', col('id')), 'DESC']], raw: true }),
    Insight.findAll({ attributes: ['reason', 'note'], where: { ...match, type: 'exit_reason' }, order: [['id', 'ASC']], raw: true }),
    Insight.count({ distinct: true, col: 'sessionId', where: match }),
    Reservation.count({ where: { source: 'website', createdAt: { [Op.gte]: since } } }),
  ]);
  const counts = Object.fromEntries(byType.map((row) => [row.type, n(row.count)]));
  const reasons = new Map();
  for (const row of reasonRows) {
    const entry = reasons.get(row.reason) || { reason: row.reason, count: 0, notes: [] };
    entry.count += 1;
    entry.notes.push(row.note);
    reasons.set(row.reason, entry);
  }
  res.json({
    days,
    sessions,
    counts,
    bookings,
    conversion: sessions ? Number(((bookings / sessions) * 100).toFixed(2)) : 0,
    bookingDropRate: counts.book_open ? Math.round(((counts.book_drop || 0) / counts.book_open) * 100) : 0,
    topPages: topPages.map((row) => ({ _id: row.path, views: n(row.views) })),
    rooms: rooms.map((row) => ({ _id: row.roomName, views: n(row.views) })),
    exitReasons: [...reasons.values()]
      .sort((a, b) => b.count - a.count)
      .map((row) => ({ reason: row.reason, count: row.count, notes: row.notes.filter(Boolean).slice(0, 20) })),
  });
});

export default router;
