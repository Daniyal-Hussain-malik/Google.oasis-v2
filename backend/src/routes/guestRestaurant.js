import { Router } from 'express';
import { formLimit } from '../middleware/limits.js';
import { toId } from '../models/_base.js';
import MenuItem from '../models/MenuItem.js';
import RestaurantCategory from '../models/RestaurantCategory.js';
import RestaurantOrder from '../models/RestaurantOrder.js';
import Settings from '../models/Settings.js';
import { getVerifiedGuestReservation, requireGuestSession } from '../services/guestAuth.js';
import { paymentProofSubmitted } from '../services/notifications.js';
import { cancelItems, createOrder, ensureCategories } from '../services/restaurant.js';
import { badRequest, HttpError, notFound, text } from '../utils/http.js';
import { readClaim, saveClaim } from './paymentClaims.js';

const router = Router();

// Guests authenticate via OTP-verified httpOnly cookie (or verified Bearer guest token).
async function requireGuest(req, res, next) {
  const reservation = await getVerifiedGuestReservation(req);
  if (!reservation) throw new HttpError(401, 'Verify your booking with a one-time passcode to order food.');
  if (!['confirmed', 'checked_in'].includes(reservation.status)) {
    throw new HttpError(401, 'This booking is not open for ordering.');
  }
  req.reservation = reservation;
  next();
}

function requireInHouse(req, res, next) {
  if (req.reservation.status !== 'checked_in') {
    throw new HttpError(403, 'Food ordering opens once you have checked in at the desk.');
  }
  next();
}

// What a guest may see of an order: no staff names, no internal history.
function publicOrder(order) {
  return {
    id: order._id,
    orderNumber: order.orderNumber,
    type: order.type,
    status: order.status,
    roomNo: order.roomNo,
    table: order.table,
    notes: order.notes,
    items: order.items.map((line) => ({
      name: line.name,
      variation: line.variation,
      addOns: line.addOns.map((addOn) => addOn.name),
      quantity: line.quantity,
      note: line.note,
      lineTotal: line.lineTotal,
      status: line.status,
    })),
    subtotal: order.subtotal,
    taxAmount: order.taxAmount,
    serviceAmount: order.serviceAmount,
    total: order.total,
    paymentMode: order.paymentMode,
    paymentStatus: order.paymentStatus,
    paidAmount: order.paidAmount,
    balance: order.balance,
    createdAt: order.createdAt,
    servedAt: order.servedAt,
    cancelReason: order.cancel?.reason || '',
  };
}

router.get('/menu', async (req, res) => {
  await ensureCategories();
  const [categories, items, settings] = await Promise.all([
    RestaurantCategory.findAll({ where: { active: true }, order: [['sortOrder', 'ASC'], ['name', 'ASC']] }),
    MenuItem.findAll({ where: { available: true }, order: [['sortOrder', 'ASC'], ['name', 'ASC']] }),
    Settings.current(),
  ]);
  const open = new Set(categories.map((category) => category.name));
  res.json({
    categories: categories.map((category) => ({ _id: category._id, name: category.name, description: category.description })),
    items: items
      .map((item) => item.toJSON())
      .filter((item) => open.has(item.category))
      .map(({ _id, name, category, description, price, image, variations = [], addOns = [], prepMinutes = 15 }) => ({ _id, name, category, description, price, image, variations, addOns, prepMinutes })),
    rates: { tax: settings.restaurantTaxRate, service: settings.restaurantServiceRate },
    currency: settings.currency,
  });
});

router.post('/session', formLimit, async (req, res) => {
  const reservation = await requireGuestSession(req, { expectedBookingNumber: req.body?.bookingNumber });
  if (!['confirmed', 'checked_in'].includes(reservation.status)) throw badRequest('This booking is not open for ordering.');
  res.json({
    guest: {
      name: reservation.guestName,
      bookingNumber: reservation.bookingNumber,
      status: reservation.status,
      rooms: reservation.rooms.map((room) => ({ roomNo: room.roomNo, type: room.type })),
    },
    canOrder: reservation.status === 'checked_in',
  });
});

router.get('/orders', requireGuest, async (req, res) => {
  const orders = await RestaurantOrder.findAll({ where: { reservation: req.reservation.id }, order: [['createdAt', 'DESC']], limit: 30 });
  res.json(orders.map(publicOrder));
});

async function ownOrder(req) {
  const order = await RestaurantOrder.findOne({ where: { id: toId(req.params.id), reservation: req.reservation.id } });
  if (!order) throw notFound('Order not found.');
  return order;
}

router.get('/orders/:id', requireGuest, async (req, res) => {
  res.json(publicOrder(await ownOrder(req)));
});

router.post('/orders', formLimit, requireGuest, requireInHouse, async (req, res) => {
  const body = req.body || {};
  const payNow = body.paymentMode === 'pay_now';
  const { order, duplicate } = await createOrder({
    type: body.type,
    paymentMode: payNow ? 'pay_now' : 'room_charge',
    items: body.items,
    notes: body.notes,
    table: body.table,
    reservation: req.reservation,
    roomNo: body.roomNo,
    clientRequestId: text(body.clientRequestId, 80) ? `g:${req.reservation.id}:${text(body.clientRequestId, 60)}` : undefined,
    source: 'guest',
  });
  res.status(duplicate ? 200 : 201).json(publicOrder(order));
});

// "I have paid this order by Easypaisa or bank transfer." Staff confirm it before it counts.
router.post('/orders/:id/payment-claim', formLimit, requireGuest, async (req, res) => {
  const order = await ownOrder(req);
  if (order.paymentMode !== 'pay_now' || order.status === 'cancelled') throw badRequest('This order cannot take a payment this way.');
  const data = await readClaim(req.body);
  if (data.amount > order.balance) throw badRequest(`Only Rs ${order.balance} is still due on this order.`);
  const claim = await saveClaim({
    ...data,
    target: 'order',
    order: order.id,
    orderNumber: order.orderNumber,
    reservation: order.reservation,
    bookingNumber: order.bookingNumber,
    guestName: order.guestName,
  });
  paymentProofSubmitted(claim, req.reservation);
  res.status(201).json({ ok: true, status: claim.status });
});

router.post('/orders/:id/cancel', requireGuest, async (req, res) => {
  const order = await ownOrder(req);
  const updated = await cancelItems(order.id, { reason: req.body?.reason || 'Cancelled by guest', by: undefined, role: 'guest', byGuest: true });
  res.json(publicOrder(updated));
});

export default router;
