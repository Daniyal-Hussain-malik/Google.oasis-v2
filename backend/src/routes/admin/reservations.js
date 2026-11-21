import { Router } from 'express';
import { Op } from 'sequelize';
import { env } from '../../config/env.js';
import { ACCESS, isSuperAdmin } from '../../config/roles.js';
import { requireRole } from '../../middleware/auth.js';
import { toId } from '../../models/_base.js';
import Reservation, { ReservationPayment, STATUSES } from '../../models/Reservation.js';
import RoomType from '../../models/RoomType.js';
import User from '../../models/User.js';
import Settings from '../../models/Settings.js';
import { changeStatus, createReservation, readStay, releaseNights } from '../../services/booking.js';
import { buildInvoice, invoicePdf } from '../../services/invoice.js';
import { bookingCancelled, bookingCreated, guestCheckedIn, guestCheckedOut } from '../../services/notifications.js';
import { addFolioEntry, reverseFolioEntry } from '../../services/restaurant.js';
import { todayIn } from '../../utils/dates.js';
import { badRequest, int, isEmail, notFound, phoneKey, text } from '../../utils/http.js';
import { contains, populate } from '../../utils/sql.js';

const router = Router();
const METHODS = ['cash', 'card', 'bank_transfer', 'jazzcash', 'easypaisa'];

router.get('/', async (req, res) => {
  const where = {};
  if (STATUSES.includes(req.query.status)) where.status = req.query.status;
  // Stays that overlap the range [from, to].
  if (req.query.from) where.checkOut = { [Op.gt]: String(req.query.from) };
  if (req.query.to) where.checkIn = { [Op.lte]: String(req.query.to) };
  if (req.query.q) {
    const q = contains(text(req.query.q, 60));
    const key = phoneKey(req.query.q);
    where[Op.or] = [
      { bookingNumber: q },
      { guest_firstName: q },
      { guest_lastName: q },
      { guest_email: q },
      ...(key.length >= 4 ? [{ guest_phoneKey: contains(key) }] : []),
    ];
  }
  const limit = Math.min(Math.max(int(req.query.limit, 50), 1), 200);
  const page = Math.max(int(req.query.page, 1), 1);
  const [items, total] = await Promise.all([
    Reservation.findAll({ where, order: [['checkIn', 'DESC'], ['createdAt', 'DESC']], offset: (page - 1) * limit, limit }),
    Reservation.count({ where }),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

// The booking with staff names and the room type name filled in, as the detail screens expect.
async function detail(id) {
  const reservation = await Reservation.findByPk(toId(id));
  if (!reservation) return null;
  const json = reservation.toJSON();
  await populate(json, 'roomType', RoomType);
  for (const path of ['history.by', 'payments.by', 'folio.by']) await populate(json, path, User);
  return json;
}

router.get('/:id', async (req, res) => {
  const reservation = await detail(req.params.id);
  if (!reservation) throw notFound('Reservation not found.');
  res.json(reservation);
});

// Phone, walk-in and WhatsApp bookings entered by the desk.
router.post('/', async (req, res) => {
  const body = req.body || {};
  const settings = await Settings.current();
  const stay = readStay(body, settings, todayIn(env.timezone));
  const guest = {
    firstName: text(body.firstName, 60),
    lastName: text(body.lastName, 60),
    phone: text(body.phone, 30),
    email: text(body.email, 120).toLowerCase(),
  };
  guest.phoneKey = phoneKey(guest.phone);
  if (!guest.firstName || !guest.lastName) throw badRequest('Guest first and last name are required.');
  if (guest.phoneKey.length < 10) throw badRequest('Enter the guest phone number.');
  if (!isEmail(guest.email)) throw badRequest('Enter a valid guest email.');

  const reservation = await createReservation({
    stay,
    roomTypeId: body.roomTypeId,
    guest,
    specialRequests: text(body.specialRequests, 1000),
    offer: text(body.offer, 120),
    source: ['desk', 'phone', 'whatsapp', 'agency', 'booking_com', 'airbnb', 'ota'].includes(body.source) ? body.source : 'desk',
    by: req.user._id,
  });
  bookingCreated(reservation);
  res.status(201).json(reservation);
});

router.patch('/:id', async (req, res) => {
  const reservation = await Reservation.findByPk(toId(req.params.id));
  if (!reservation) throw notFound('Reservation not found.');
  const body = req.body || {};
  if (body.specialRequests !== undefined) reservation.specialRequests = text(body.specialRequests, 1000);
  if (body.internalNotes !== undefined) reservation.internalNotes = text(body.internalNotes, 2000);
  if (body.phone !== undefined) {
    reservation.guest.phone = text(body.phone, 30);
    reservation.guest.phoneKey = phoneKey(body.phone);
  }
  if (body.email !== undefined) {
    if (!isEmail(text(body.email, 120))) throw badRequest('Enter a valid email.');
    reservation.guest.email = text(body.email, 120).toLowerCase();
  }
  await reservation.save();
  res.json(reservation);
});

router.post('/:id/status', async (req, res) => {
  const status = String(req.body?.status || '');
  if (!STATUSES.includes(status)) throw badRequest('Unknown status.');
  const reservation = await Reservation.findByPk(toId(req.params.id));
  if (!reservation) throw notFound('Reservation not found.');
  await changeStatus(reservation, status, { note: text(req.body?.note, 300), by: req.user._id, today: todayIn(env.timezone) });
  // Checkout may have added restaurant charges to the folio behind this copy.
  const fresh = await Reservation.findByPk(reservation.id);
  if (status === 'cancelled') bookingCancelled(fresh);
  if (status === 'checked_in') guestCheckedIn(fresh);
  if (status === 'checked_out') guestCheckedOut(fresh);
  res.json(fresh);
});

router.post('/:id/payments', async (req, res) => {
  const reservation = await Reservation.findByPk(toId(req.params.id));
  if (!reservation) throw notFound('Reservation not found.');
  const amount = Number(req.body?.amount);
  const method = String(req.body?.method || '');
  if (!Number.isFinite(amount) || amount <= 0) throw badRequest('Enter an amount above zero.');
  if (![...METHODS, 'refund'].includes(method)) throw badRequest(`Method must be one of: ${METHODS.join(', ')}, refund.`);
  // Refunds are approved by a manager, as the refund policy promises.
  if (method === 'refund') {
    if (!isSuperAdmin(req.user.role)) throw badRequest('Only a super admin can approve a refund.');
    if (amount > reservation.paid) throw badRequest('A refund cannot be more than what was paid.');
  }
  await ReservationPayment.create({ reservationId: reservation.id, amount, method, reference: text(req.body?.reference, 80), note: text(req.body?.note, 300), by: req.user._id });
  res.status(201).json(await Reservation.findByPk(reservation.id));
});

// Folio: services, discounts and adjustments are added here. Restaurant charges
// arrive on their own when an order is served. Nothing is deleted; a posted
// charge is undone with a reversal.
router.post('/:id/folio', async (req, res) => {
  const { department, description, amount, reason } = req.body || {};
  await addFolioEntry(req.params.id, { department, description, amount, reason }, req.user._id, req.user.role);
  res.status(201).json(await detail(req.params.id));
});

router.post('/:id/folio/:entryId/reverse', requireRole(...ACCESS.superAdmin), async (req, res) => {
  await reverseFolioEntry(req.params.id, req.params.entryId, req.body?.reason, req.user._id);
  res.json(await detail(req.params.id));
});

router.get('/:id/invoice', async (req, res) => {
  const invoice = await buildInvoice(req.params.id);
  if (!invoice) throw notFound('Reservation not found.');
  res.json(invoice);
});

router.get('/:id/invoice.pdf', async (req, res) => {
  const invoice = await buildInvoice(req.params.id);
  if (!invoice) throw notFound('Reservation not found.');
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"` });
  res.send(invoicePdf(invoice));
});

// Night audit: arrivals from before today that never checked in become no-shows.
router.post('/night-audit', requireRole(...ACCESS.superAdmin), async (req, res) => {
  const today = todayIn(env.timezone);
  const missed = await Reservation.findAll({ where: { status: 'confirmed', checkIn: { [Op.lt]: today } } });
  for (const reservation of missed) {
    reservation.status = 'no_show';
    reservation.history.push({ status: 'no_show', note: 'Night audit', by: req.user._id });
    await releaseNights(reservation.id);
    await reservation.save();
  }
  res.json({ businessDate: today, noShows: missed.map((reservation) => reservation.bookingNumber) });
});

export default router;
