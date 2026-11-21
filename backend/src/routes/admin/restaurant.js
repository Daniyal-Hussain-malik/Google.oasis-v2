import { Router } from 'express';
import { fn, col, literal, Op } from 'sequelize';
import { env } from '../../config/env.js';
import { ACCESS } from '../../config/roles.js';
import { requireRole } from '../../middleware/auth.js';
import { toId } from '../../models/_base.js';
import Kot from '../../models/Kot.js';
import MenuItem from '../../models/MenuItem.js';
import Reservation, { ReservationFolio } from '../../models/Reservation.js';
import RestaurantCategory from '../../models/RestaurantCategory.js';
import RestaurantOrder, { ORDER_STATUSES, ORDER_TYPES, OrderItem } from '../../models/RestaurantOrder.js';
import RestaurantPayment from '../../models/RestaurantPayment.js';
import Settings from '../../models/Settings.js';
import User from '../../models/User.js';
import { addDays, isIsoDate, todayIn } from '../../utils/dates.js';
import { badRequest, conflict, int, notFound, text } from '../../utils/http.js';
import { contains, populate, roomNoMatches } from '../../utils/sql.js';
import { bus } from '../../services/events.js';
import {
  addItems,
  advanceKot,
  cancelItems,
  createOrder,
  ensureCategories,
  linkMenuCategories,
  OPEN_STATUSES,
  recordPayment,
  refundPayment,
} from '../../services/restaurant.js';

const router = Router();
const staff = requireRole(...ACCESS.frontOffice);
const floor = requireRole(...ACCESS.kitchen);
const managers = requireRole(...ACCESS.superAdmin);
const page = (query) => ({ limit: Math.min(Math.max(int(query.limit, 30), 1), 200), page: Math.max(int(query.page, 1), 1) });
const ne = (value) => ({ [Op.ne]: value });
const n = (value) => Number(value) || 0;
const sumBy = (rows, pick) => rows.reduce((total, row) => total + n(pick(row)), 0);

function range(query, defaultDays = 30) {
  const to = isIsoDate(query.to) ? query.to : todayIn(env.timezone);
  const from = isIsoDate(query.from) ? query.from : addDays(to, -(defaultDays - 1));
  return { from, to };
}

// { gte: from, lte: to } on a YYYY-MM-DD column, using whichever ends were given.
function between(from, to) {
  const part = {};
  if (isIsoDate(from)) part[Op.gte] = from;
  if (isIsoDate(to)) part[Op.lte] = to;
  return Reflect.ownKeys(part).length ? part : undefined;
}

// Live updates

// Server-sent events: the kitchen display and order lists reload when this fires.
router.get('/stream', floor, (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  bus.on('event', send);
  const beat = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(beat);
    bus.off('event', send);
  });
});

// Tax and service charge for restaurant orders (shown on Menu management).
router.get('/rates', staff, async (req, res) => {
  const settings = await Settings.current();
  res.json({ tax: settings.restaurantTaxRate, service: settings.restaurantServiceRate });
});

router.put('/rates', managers, async (req, res) => {
  const tax = Number(req.body?.tax);
  const service = Number(req.body?.service);
  if (![tax, service].every((rate) => Number.isFinite(rate) && rate >= 0 && rate <= 100)) throw badRequest('Rates must be between 0 and 100.');
  const settings = await Settings.current();
  settings.restaurantTaxRate = tax;
  settings.restaurantServiceRate = service;
  await settings.save();
  res.json({ tax, service });
});

// The kitchen's sold-out list: names only, so a chef can switch a dish off without seeing prices.
router.get('/dishes', floor, async (req, res) => {
  const items = await MenuItem.findAll({ attributes: ['id', 'name', 'category', 'available'], order: [['category', 'ASC'], ['name', 'ASC']], light: true });
  res.json(items.map((item) => ({ _id: item._id, name: item.name, category: item.category, available: item.available })));
});

// Menu board for the till

router.get('/board', staff, async (req, res) => {
  await ensureCategories();
  const [categories, items, settings] = await Promise.all([
    RestaurantCategory.findAll({ where: { active: true }, order: [['sortOrder', 'ASC'], ['name', 'ASC']] }),
    MenuItem.findAll({ order: [['sortOrder', 'ASC'], ['name', 'ASC']] }),
    Settings.current(),
  ]);
  const open = new Set(categories.map((category) => category.name));
  res.json({
    categories,
    items: items.filter((item) => open.has(item.category)),
    rates: { tax: settings.restaurantTaxRate, service: settings.restaurantServiceRate },
  });
});

// In-house guests, found by name, room number or booking number.
router.get('/guests', staff, async (req, res) => {
  const where = { status: 'checked_in' };
  const q = text(req.query.q, 60);
  if (q) {
    const pattern = contains(q);
    where[Op.or] = [{ bookingNumber: pattern }, { guest_firstName: pattern }, { guest_lastName: pattern }, { id: { [Op.in]: roomNoMatches(q) } }];
  }
  const found = await Reservation.findAll({ where, order: [['checkIn', 'DESC']], limit: 20 });
  res.json(found.map((r) => ({
    _id: r._id,
    bookingNumber: r.bookingNumber,
    guestName: r.guestName,
    phone: r.guest.phone,
    rooms: r.rooms.map((room) => room.roomNo),
    checkOut: r.checkOut,
    balance: r.balance,
  })));
});

// Orders

function orderFilter(query) {
  const where = {};
  if (ORDER_STATUSES.includes(query.status)) where.status = query.status;
  if (query.status === 'open') where.status = OPEN_STATUSES;
  if (ORDER_TYPES.includes(query.type)) where.type = query.type;
  if (['room_charge', 'pay_now'].includes(query.paymentMode)) where.paymentMode = query.paymentMode;
  const dates = between(query.from, query.to);
  if (dates) where.businessDate = dates;
  if (query.q) {
    const pattern = contains(text(query.q, 60));
    where[Op.or] = [{ orderNumber: pattern }, { guestName: pattern }, { roomNo: pattern }, { bookingNumber: pattern }];
  }
  return where;
}

router.get('/orders', staff, async (req, res) => {
  const where = orderFilter(req.query);
  const { limit, page: number } = page(req.query);
  const [items, total] = await Promise.all([
    RestaurantOrder.findAll({ where, order: [['createdAt', 'DESC'], ['id', 'DESC']], offset: (number - 1) * limit, limit }),
    RestaurantOrder.count({ where }),
  ]);
  res.json({ items, total, page: number, pages: Math.ceil(total / limit) });
});

async function orderDetail(id) {
  const order = await RestaurantOrder.findByPk(toId(id));
  if (!order) throw notFound('Order not found.');
  const [kots, payments] = await Promise.all([
    Kot.findAll({ where: { order: order.id }, order: [['createdAt', 'ASC'], ['id', 'ASC']] }),
    RestaurantPayment.findAll({ where: { order: order.id }, order: [['createdAt', 'ASC'], ['id', 'ASC']] }),
  ]);
  const detail = { order: order.toJSON(), kots: kots.map((kot) => kot.toJSON()), payments: payments.map((payment) => payment.toJSON()) };
  await populate(detail.order, 'history.by', User);
  await populate(detail.order, 'items.cancelledBy', User);
  await populate(detail.payments, 'by', User);
  return detail;
}

router.get('/orders/:id', staff, async (req, res) => {
  res.json(await orderDetail(req.params.id));
});

router.post('/orders', staff, async (req, res) => {
  const body = req.body || {};
  let reservation = null;
  if (body.reservationId) {
    if (!toId(body.reservationId)) throw badRequest('Unknown guest booking.');
    reservation = await Reservation.findByPk(toId(body.reservationId));
    if (!reservation) throw notFound('Guest booking not found.');
  }
  const { order, duplicate } = await createOrder({
    type: body.type,
    paymentMode: body.paymentMode,
    items: body.items,
    notes: body.notes,
    table: body.table,
    reservation,
    roomNo: body.roomNo,
    guestName: body.guestName,
    phone: body.phone,
    payment: body.payment,
    clientRequestId: text(body.clientRequestId, 80) || undefined,
    source: 'staff',
    by: req.user._id,
  });
  res.status(duplicate ? 200 : 201).json({ ...(await orderDetail(order.id)), duplicate });
});

router.post('/orders/:id/items', staff, async (req, res) => {
  await addItems(req.params.id, req.body?.items, req.user._id);
  res.status(201).json(await orderDetail(req.params.id));
});

router.post('/orders/:id/cancel', staff, async (req, res) => {
  await cancelItems(req.params.id, { lineIds: req.body?.lineIds, reason: req.body?.reason, by: req.user._id, role: req.user.role });
  res.json(await orderDetail(req.params.id));
});

router.post('/orders/:id/payments', staff, async (req, res) => {
  const result = await recordPayment(req.params.id, req.body || {}, req.user._id);
  res.status(result.duplicate ? 200 : 201).json({ ...(await orderDetail(req.params.id)), payment: result.payment });
});

router.post('/orders/:id/refunds', managers, async (req, res) => {
  const result = await refundPayment(req.params.id, req.body || {}, req.user._id);
  res.status(result.duplicate ? 200 : 201).json({ ...(await orderDetail(req.params.id)), payment: result.payment });
});

// KOTs

router.get('/kots', floor, async (req, res) => {
  const where = {};
  const and = [];
  // `active` is what the kitchen display shows: work in progress and unread cancellations.
  if (req.query.view === 'active') {
    and.push({ [Op.or]: [{ type: ne('cancellation'), status: ['new', 'accepted', 'preparing', 'ready'] }, { type: 'cancellation', status: 'new' }] });
  } else if (req.query.status) {
    where.status = text(req.query.status, 20);
  }
  if (['original', 'supplementary', 'cancellation'].includes(req.query.type)) where.type = req.query.type;
  const dates = between(req.query.from, req.query.to);
  if (dates) where.businessDate = dates;
  if (req.query.q) {
    const pattern = contains(text(req.query.q, 60));
    and.push({ [Op.or]: [{ kotNumber: pattern }, { orderNumber: pattern }, { guestName: pattern }, { roomNo: pattern }] });
  }
  if (and.length) where[Op.and] = and;
  const { limit, page: number } = page(req.query);
  const direction = req.query.view === 'active' ? 'ASC' : 'DESC';
  const [items, total] = await Promise.all([
    Kot.findAll({ where, order: [['createdAt', direction], ['id', direction]], offset: (number - 1) * limit, limit }),
    Kot.count({ where }),
  ]);
  res.json({ items, total, page: number, pages: Math.ceil(total / limit) });
});

router.post('/kots/:id/status', floor, async (req, res) => {
  if (!toId(req.params.id)) throw notFound('Ticket not found.');
  res.json(await advanceKot(req.params.id, String(req.body?.to || ''), req.user._id));
});

router.post('/kots/:id/print', floor, async (req, res) => {
  const kot = await Kot.findByPk(toId(req.params.id), { light: true });
  if (!kot) throw notFound('Ticket not found.');
  await Kot.update({ printCount: literal('`printCount` + 1') }, { where: { id: kot.id } });
  res.json(await Kot.findByPk(kot.id));
});

// Menu

async function ensureCategory(name) {
  if (!(await RestaurantCategory.count({ where: { name } }))) {
    await RestaurantCategory.create({ name, sortOrder: await RestaurantCategory.count() });
  }
}

function options(list, label) {
  if (list === undefined) return undefined;
  if (!Array.isArray(list)) throw badRequest(`${label} must be a list.`);
  return list.map((entry) => {
    const name = text(entry?.name, 60);
    const price = Number(entry?.price);
    if (!name) throw badRequest(`Every ${label} needs a name.`);
    if (!Number.isFinite(price) || price < 0) throw badRequest(`Enter a valid price for ${name}.`);
    return { ...(toId(entry?._id) ? { _id: String(toId(entry._id)) } : {}), name, price };
  });
}

function menuData(body) {
  const data = {};
  for (const field of ['name', 'category', 'station']) if (body[field] !== undefined) data[field] = text(body[field], 80);
  if (body.description !== undefined) data.description = text(body.description, 600);
  if (body.image !== undefined) data.image = text(body.image, 300);
  if (body.available !== undefined) data.available = Boolean(body.available);
  for (const field of ['price', 'sortOrder', 'prepMinutes']) if (body[field] !== undefined) data[field] = Number(body[field]);
  const variations = options(body.variations, 'variation');
  const addOns = options(body.addOns, 'add-on');
  if (variations) data.variations = variations;
  if (addOns) data.addOns = addOns;
  return data;
}

router.get('/menu', staff, async (req, res) => {
  await ensureCategories();
  res.json(await MenuItem.findAll({ order: [['sortOrder', 'ASC'], ['category', 'ASC'], ['name', 'ASC']] }));
});

router.post('/menu', managers, async (req, res) => {
  const data = menuData(req.body || {});
  if (data.category) await ensureCategory(data.category);
  const created = await MenuItem.create(data);
  await linkMenuCategories();
  res.status(201).json(await MenuItem.findByPk(created.id));
});

router.patch('/menu/:id', managers, async (req, res) => {
  const item = await MenuItem.findByPk(toId(req.params.id));
  if (!item) throw notFound('Menu item not found.');
  const data = menuData(req.body || {});
  if (data.category) await ensureCategory(data.category);
  Object.assign(item, data);
  await item.save();
  await linkMenuCategories();
  res.json(await MenuItem.findByPk(item.id));
});

// The kitchen can mark a dish sold out without being able to edit the menu.
router.post('/menu/:id/availability', floor, async (req, res) => {
  const item = await MenuItem.findByPk(toId(req.params.id));
  if (!item) throw notFound('Menu item not found.');
  item.available = Boolean(req.body?.available);
  await item.save();
  res.json(item);
});

// Orders keep their own copy of name and price, so removing a dish is safe.
router.delete('/menu/:id', managers, async (req, res) => {
  if (!(await MenuItem.destroy({ where: { id: toId(req.params.id) } }))) throw notFound('Menu item not found.');
  res.status(204).end();
});

// Categories

router.get('/categories', staff, async (req, res) => {
  await ensureCategories();
  const [categories, counts] = await Promise.all([
    RestaurantCategory.findAll({ order: [['sortOrder', 'ASC'], ['name', 'ASC']] }),
    MenuItem.findAll({ attributes: ['category', [fn('COUNT', col('id')), 'count']], group: ['category'], raw: true }),
  ]);
  const byName = new Map(counts.map((row) => [row.category, n(row.count)]));
  res.json(categories.map((category) => ({ ...category.toJSON(), items: byName.get(category.name) || 0 })));
});

router.post('/categories', managers, async (req, res) => {
  const name = text(req.body?.name, 60);
  if (!name) throw badRequest('Give the category a name.');
  const category = await RestaurantCategory.create({
    name,
    description: text(req.body?.description, 300),
    sortOrder: Number(req.body?.sortOrder) || (await RestaurantCategory.count()),
    active: req.body?.active !== false,
  });
  res.status(201).json(category);
});

router.patch('/categories/:id', managers, async (req, res) => {
  const category = await RestaurantCategory.findByPk(toId(req.params.id));
  if (!category) throw notFound('Category not found.');
  const before = category.name;
  if (req.body?.name !== undefined) {
    const name = text(req.body.name, 60);
    if (!name) throw badRequest('Give the category a name.');
    category.name = name;
  }
  if (req.body?.description !== undefined) category.description = text(req.body.description, 300);
  if (req.body?.sortOrder !== undefined) category.sortOrder = Number(req.body.sortOrder) || 0;
  if (req.body?.active !== undefined) category.active = Boolean(req.body.active);
  await category.save();
  if (category.name !== before) await MenuItem.update({ category: category.name, categoryId: category.id }, { where: { category: before } });
  res.json(category);
});

router.delete('/categories/:id', managers, async (req, res) => {
  const category = await RestaurantCategory.findByPk(toId(req.params.id));
  if (!category) throw notFound('Category not found.');
  if (await MenuItem.count({ where: { category: category.name } })) throw conflict('Move or delete the dishes in this category first, or hide it instead.');
  await category.destroy();
  res.status(204).end();
});

// Payments

router.get('/payments', staff, async (req, res) => {
  const { from, to } = range(req.query, 7);
  const where = { businessDate: { [Op.gte]: from, [Op.lte]: to } };
  if (req.query.q) {
    const pattern = contains(text(req.query.q, 60));
    where[Op.or] = [{ receiptNumber: pattern }, { orderNumber: pattern }, { guestName: pattern }];
  }
  const { limit, page: number } = page(req.query);
  const [rows, total, totals] = await Promise.all([
    RestaurantPayment.findAll({ where, order: [['createdAt', 'DESC'], ['id', 'DESC']], offset: (number - 1) * limit, limit }),
    RestaurantPayment.count({ where }),
    RestaurantPayment.findAll({ attributes: ['kind', [fn('SUM', col('amount')), 'amount']], where, group: ['kind'], raw: true }),
  ]);
  const items = await populate(rows.map((row) => row.toJSON()), 'by', User);
  const sum = Object.fromEntries(totals.map((row) => [row.kind, n(row.amount)]));
  res.json({ items, total, page: number, pages: Math.ceil(total / limit), from, to, received: sum.payment || 0, refunded: sum.refund || 0 });
});

router.get('/payments/:id/receipt', staff, async (req, res) => {
  const row = await RestaurantPayment.findByPk(toId(req.params.id));
  if (!row) throw notFound('Receipt not found.');
  const payment = await populate(row.toJSON(), 'by', User);
  const [order, settings] = await Promise.all([RestaurantOrder.findByPk(row.order), Settings.current()]);
  res.json({ payment, order, hotel: { name: settings.name, address: settings.address, phone: settings.phone } });
});

// Money still to collect: pay-now orders with a balance, and in-house guests
// whose restaurant charges are sitting on an unpaid folio.
async function outstanding() {
  const restaurantFolios = await ReservationFolio.findAll({ attributes: ['reservationId'], where: { department: 'restaurant' }, group: ['reservationId'], raw: true });
  const [unpaidOrders, folios] = await Promise.all([
    RestaurantOrder.findAll({
      where: { paymentMode: 'pay_now', status: ne('cancelled'), [Op.and]: [literal('`total` > `paidAmount`')] },
      order: [['createdAt', 'ASC']],
      limit: 200,
    }),
    restaurantFolios.length
      ? Reservation.findAll({ where: { status: 'checked_in', id: restaurantFolios.map((row) => row.reservationId) } })
      : [],
  ]);
  const guests = folios
    .map((r) => ({
      _id: r._id,
      bookingNumber: r.bookingNumber,
      guestName: r.guestName,
      rooms: r.rooms.map((room) => room.roomNo),
      restaurant: r.folio.filter((e) => e.department === 'restaurant').reduce((sum, e) => sum + (e.kind === 'credit' ? -e.amount : e.amount), 0),
      balance: r.balance,
    }))
    .filter((g) => g.restaurant > 0 && g.balance > 0);
  return { unpaidOrders, guests };
}

router.get('/outstanding', staff, async (req, res) => {
  res.json(await outstanding());
});

// Order lines of the given orders, grouped by dish name.
async function popularItems(orderIds, limit) {
  if (!orderIds.length) return [];
  const lines = await OrderItem.findAll({ attributes: ['name', 'category', 'quantity', 'lineTotal'], where: { orderId: orderIds, status: 'active' }, order: [['id', 'ASC']], raw: true });
  const byName = new Map();
  for (const line of lines) {
    const row = byName.get(line.name) || { _id: line.name, category: line.category, quantity: 0, revenue: 0 };
    row.quantity += n(line.quantity);
    row.revenue += n(line.lineTotal);
    byName.set(line.name, row);
  }
  return [...byName.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit);
}

// Overview

router.get('/overview', staff, async (req, res) => {
  const today = todayIn(env.timezone);
  const [todays, openRows, kots, recent, owed] = await Promise.all([
    RestaurantOrder.findAll({ attributes: ['id', 'total', 'paidAmount', 'paymentMode'], where: { businessDate: today, status: ne('cancelled') }, raw: true }),
    RestaurantOrder.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], where: { status: OPEN_STATUSES }, group: ['status'], raw: true }),
    Kot.count({ where: { type: ne('cancellation'), status: ['new', 'accepted', 'preparing', 'ready'] } }),
    RestaurantOrder.findAll({ order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: 8 }),
    outstanding(),
  ]);
  const topItems = (await popularItems(todays.map((order) => order.id), 5)).map(({ _id, quantity, revenue }) => ({ _id, quantity, revenue }));
  res.json({
    businessDate: today,
    orders: todays.length,
    sales: sumBy(todays, (o) => o.total),
    roomCharges: sumBy(todays.filter((o) => o.paymentMode === 'room_charge'), (o) => o.total),
    collected: sumBy(todays, (o) => o.paidAmount),
    open: Object.fromEntries(openRows.map((r) => [r.status, n(r.count)])),
    openTotal: sumBy(openRows, (r) => r.count),
    kotsInProgress: kots,
    unpaidOrders: owed.unpaidOrders.length,
    unpaidAmount: owed.unpaidOrders.reduce((sum, o) => sum + (o.total - o.paidAmount), 0),
    topItems,
    recent,
  });
});

// Reports

router.get('/reports', managers, async (req, res) => {
  const { from, to } = range(req.query, 30);
  const inRange = { businessDate: { [Op.gte]: from, [Op.lte]: to } };
  const live = { ...inRange, status: ne('cancelled') };
  const monthsFrom = `${addDays(to, -365).slice(0, 7)}-01`;

  const [liveOrders, monthOrders, payments, cancelled, kotRows, kotRecent, owed] = await Promise.all([
    RestaurantOrder.findAll({ attributes: ['id', 'businessDate', 'subtotal', 'taxAmount', 'serviceAmount', 'total', 'paymentMode', 'billing_posted'], where: live, raw: true }),
    RestaurantOrder.findAll({ attributes: ['businessDate', 'total'], where: { businessDate: { [Op.gte]: monthsFrom, [Op.lte]: to }, status: ne('cancelled') }, raw: true }),
    RestaurantPayment.findAll({ attributes: ['method', 'kind', 'amount'], where: inRange, raw: true }),
    RestaurantOrder.findAll({
      where: {
        ...inRange,
        [Op.or]: [{ status: 'cancelled' }, { id: { [Op.in]: literal("(SELECT `orderId` FROM `restaurant_order_items` WHERE `status` = 'cancelled')") } }],
      },
      order: [['createdAt', 'DESC']],
      limit: 100,
    }),
    Kot.findAll({ attributes: ['type', 'status', 'times_accepted', 'times_ready'], where: inRange, raw: true, light: true }),
    Kot.findAll({ where: inRange, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: 100 }),
    outstanding(),
  ]);

  const group = (rows, key, make, add) => {
    const map = new Map();
    for (const row of rows) {
      const id = key(row);
      const entry = map.get(id) || make(id);
      add(entry, row);
      map.set(id, entry);
    }
    return [...map.values()];
  };
  const daily = group(
    liveOrders,
    (o) => o.businessDate,
    (id) => ({ _id: id, orders: 0, subtotal: 0, tax: 0, service: 0, sales: 0 }),
    (d, o) => { d.orders += 1; d.subtotal += n(o.subtotal); d.tax += n(o.taxAmount); d.service += n(o.serviceAmount); d.sales += n(o.total); },
  ).sort((a, b) => a._id.localeCompare(b._id));
  const monthly = group(
    monthOrders,
    (o) => String(o.businessDate).slice(0, 7),
    (id) => ({ _id: id, orders: 0, sales: 0 }),
    (m, o) => { m.orders += 1; m.sales += n(o.total); },
  ).sort((a, b) => a._id.localeCompare(b._id));
  const popular = await popularItems(liveOrders.map((order) => order.id), 15);
  const methods = group(
    payments,
    (p) => p.method,
    (id) => ({ method: id, received: 0, refunded: 0 }),
    (m, p) => { if (p.kind === 'payment') m.received += n(p.amount); else if (p.kind === 'refund') m.refunded += n(p.amount); },
  ).sort((a, b) => b.received - a.received);
  const roomCharged = liveOrders.filter((o) => o.paymentMode === 'room_charge' && o.billing_posted);
  const kotStats = group(
    kotRows,
    (k) => `${k.type}|${k.status}`,
    (id) => ({ type: id.split('|')[0], status: id.split('|')[1], count: 0 }),
    (s) => { s.count += 1; },
  );
  // Average time from a ticket being accepted to being ready.
  const prep = kotRows
    .filter((k) => k.type !== 'cancellation' && k.times_ready && k.times_accepted)
    .map((k) => (new Date(k.times_ready) - new Date(k.times_accepted)) / 60000)
    .filter((m) => m >= 0);

  res.json({
    from,
    to,
    totals: {
      orders: sumBy(daily, (d) => d.orders),
      sales: sumBy(daily, (d) => d.sales),
      tax: sumBy(daily, (d) => d.tax),
      service: sumBy(daily, (d) => d.service),
    },
    daily,
    monthly,
    popular,
    paymentMethods: [
      ...methods,
      ...(roomCharged.length ? [{ method: 'room_charge', received: sumBy(roomCharged, (o) => o.total), refunded: 0, orders: roomCharged.length }] : []),
    ],
    cancelled,
    kots: {
      summary: kotStats,
      averagePrepMinutes: prep.length ? Math.round(prep.reduce((a, b) => a + b, 0) / prep.length) : null,
      recent: kotRecent,
    },
    outstanding: owed,
  });
});

export default router;
