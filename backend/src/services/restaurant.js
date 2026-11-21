import { Op } from 'sequelize';
import { tx } from '../config/db.js';
import { env } from '../config/env.js';
import { isSuperAdmin } from '../config/roles.js';
import { sequelize, toId } from '../models/_base.js';
import { nextSequence } from '../models/Counter.js';
import Kot, { KotItem } from '../models/Kot.js';
import MenuItem from '../models/MenuItem.js';
import Reservation, { ReservationFolio } from '../models/Reservation.js';
import RestaurantCategory from '../models/RestaurantCategory.js';
import RestaurantOrder, { ORDER_TYPES, OrderHistory } from '../models/RestaurantOrder.js';
import RestaurantPayment, { PAY_METHODS } from '../models/RestaurantPayment.js';
import Settings from '../models/Settings.js';
import { todayIn } from '../utils/dates.js';
import { badRequest, conflict, HttpError, int, notFound, text } from '../utils/http.js';
import { isDuplicate } from '../utils/sql.js';
import { publish } from './events.js';

export const OPEN_STATUSES = ['new', 'accepted', 'preparing', 'ready'];
const RANK = { new: 0, accepted: 1, preparing: 2, ready: 3, served: 4 };
const NEXT = { new: 'accepted', accepted: 'preparing', preparing: 'ready', ready: 'served' };
const TYPE_LABEL = { dine_in: 'Dine-in', takeaway: 'Takeaway', room_service: 'Room service' };
const isManager = isSuperAdmin;
const ne = (value) => ({ [Op.ne]: value });

// Pricing

export function totalsFor(lines, taxRate, serviceRate) {
  const subtotal = lines.filter((line) => line.status !== 'cancelled').reduce((sum, line) => sum + line.lineTotal, 0);
  const serviceAmount = Math.round((subtotal * serviceRate) / 100);
  const taxAmount = Math.round((subtotal * taxRate) / 100);
  return { subtotal, serviceAmount, taxAmount, total: subtotal + serviceAmount + taxAmount };
}

// Turns what the till or the guest sent into priced order lines. Prices are
// always read from the menu here, never taken from the request.
export async function priceLines(input) {
  if (!Array.isArray(input) || input.length === 0) throw badRequest('Add at least one item to the order.');
  if (input.length > 60) throw badRequest('An order can hold up to 60 lines.');

  const ids = input.map((entry) => toId(entry?.menuItemId));
  if (ids.some((id) => !id)) throw badRequest('One of the items is not on the menu.');
  const [items, hidden] = await Promise.all([
    MenuItem.findAll({ where: { id: ids } }),
    RestaurantCategory.findAll({ where: { active: false }, attributes: ['name'], raw: true }),
  ]);
  const byId = new Map(items.map((item) => [String(item.id), item]));
  const hiddenCategories = new Set(hidden.map((row) => row.name));

  return input.map((entry) => {
    const item = byId.get(String(toId(entry.menuItemId)));
    if (!item) throw badRequest('One of the items is no longer on the menu.');
    if (!item.available || hiddenCategories.has(item.category)) throw badRequest(`${item.name} is not available right now.`);

    const quantity = int(entry.quantity, 0);
    if (quantity < 1 || quantity > 50) throw badRequest(`Choose a quantity from 1 to 50 for ${item.name}.`);

    let unitPrice = item.price;
    let variation = '';
    if (item.variations.length) {
      const chosen = item.variations.find((option) => String(option.id) === String(entry.variationId));
      if (!chosen) throw badRequest(`Choose an option for ${item.name}.`);
      unitPrice = chosen.price;
      variation = chosen.name;
    }

    const wanted = [...new Set((Array.isArray(entry.addOnIds) ? entry.addOnIds : []).map(String))];
    const addOns = wanted.map((id) => {
      const found = item.addOns.find((option) => String(option.id) === id);
      if (!found) throw badRequest(`An add-on for ${item.name} is not available.`);
      return { name: found.name, price: found.price };
    });
    const each = unitPrice + addOns.reduce((sum, addOn) => sum + addOn.price, 0);

    return {
      menuItem: item.id,
      name: item.name,
      category: item.category,
      station: item.station || 'Kitchen',
      variation,
      addOns,
      unitPrice,
      quantity,
      note: text(entry.note, 200),
      lineTotal: each * quantity,
    };
  });
}

// Numbers

async function nextOrderNumber(date) {
  const seq = await nextSequence(`rst-order-${date}`);
  return `R${date.slice(2).replaceAll('-', '')}-${String(seq).padStart(3, '0')}`;
}

async function nextKotNumber() {
  return `KOT-${String(await nextSequence('rst-kot')).padStart(5, '0')}`;
}

async function nextReceiptNumber(date) {
  const seq = await nextSequence(`rst-receipt-${date}`);
  return `RC${date.slice(2).replaceAll('-', '')}-${String(seq).padStart(4, '0')}`;
}

// Guests and rooms

export function assertInHouse(reservation) {
  if (!reservation) throw badRequest('Choose the guest for this order.');
  if (reservation.status !== 'checked_in') {
    throw badRequest(`${reservation.guestName} is not checked in, so charges cannot go to a room.`);
  }
}

function pickRoom(reservation, requested) {
  const rooms = reservation.rooms.map((room) => room.roomNo);
  if (requested && rooms.includes(String(requested))) return String(requested);
  if (requested) throw badRequest('That room is not on this booking.');
  if (rooms.length > 1) throw badRequest('This booking has several rooms. Choose the room for the order.');
  return rooms[0] || '';
}

// KOTs

function kotItemsFrom(lines) {
  return lines.map((line) => ({
    line: line.id,
    name: line.name,
    variation: line.variation,
    addOns: line.addOns.map((addOn) => addOn.name),
    quantity: line.quantity,
    note: line.note,
    station: line.station,
  }));
}

function kotFor(order, { type, sequence, lines, reason = '', cancels, by }) {
  return {
    type,
    sequence,
    order: order.id,
    orderNumber: order.orderNumber,
    orderType: order.type,
    guestName: order.guestName,
    roomNo: order.roomNo,
    table: order.table,
    items: kotItemsFrom(lines),
    notes: order.notes,
    reason,
    cancels,
    status: 'new',
    businessDate: todayIn(env.timezone),
    by,
  };
}

async function createKot(data) {
  return Kot.create({ ...data, kotNumber: await nextKotNumber() });
}

// Points the given order lines at their ticket. Done after the ticket exists
// because the line -> ticket link is a real foreign key.
async function linkLines(order, lines, kot) {
  for (const line of lines) line.kot = kot.id;
  await order.save();
}

// Orders

function history(order, event, note, by) {
  order.history.push({ event, note, by });
}

export async function createOrder(input) {
  const { type, paymentMode, reservation, source = 'staff', by, clientRequestId } = input;
  if (!ORDER_TYPES.includes(type)) throw badRequest('Choose dine-in, takeaway or room service.');
  if (!['room_charge', 'pay_now'].includes(paymentMode)) throw badRequest('Choose Room Charge or Pay Now.');

  if (clientRequestId) {
    const existing = await RestaurantOrder.findOne({ where: { clientRequestId } });
    if (existing) return { order: existing, duplicate: true };
  }

  if (paymentMode === 'room_charge' || type === 'room_service') assertInHouse(reservation);
  const roomNo = reservation ? pickRoom(reservation, input.roomNo) : '';
  if (type === 'room_service' && !roomNo) throw badRequest('Room service needs a room number.');

  const guestName = reservation ? reservation.guestName : text(input.guestName, 80);
  if (!reservation && paymentMode === 'room_charge') throw badRequest('Only a checked-in guest can charge to a room.');

  const settings = await Settings.current();
  const lines = await priceLines(input.items);
  const totals = totalsFor(lines, settings.restaurantTaxRate, settings.restaurantServiceRate);

  // Check the opening payment before anything is written.
  const payment = input.payment ? { ...input.payment } : null;
  if (payment) {
    if (paymentMode !== 'pay_now') throw badRequest('Only Pay Now orders take a payment.');
    if (!PAY_METHODS.includes(payment.method)) throw badRequest('Choose how the guest is paying.');
    if (payment.amount === 'full') payment.amount = totals.total;
    if (!(Number(payment.amount) > 0) || Number(payment.amount) > totals.total) throw badRequest('The payment cannot be more than the order total.');
  }

  const date = todayIn(env.timezone);
  const order = RestaurantOrder.make({
    orderNumber: await nextOrderNumber(date),
    type,
    source,
    reservation: reservation?.id,
    bookingNumber: reservation?.bookingNumber || '',
    guestName,
    phone: reservation ? reservation.guest.phone : text(input.phone, 30),
    roomNo,
    table: type === 'dine_in' ? text(input.table, 20) : '',
    items: lines,
    notes: text(input.notes, 500),
    paymentMode,
    taxRate: settings.restaurantTaxRate,
    serviceRate: settings.restaurantServiceRate,
    ...totals,
    clientRequestId,
    businessDate: date,
    createdBy: source === 'staff' ? by : undefined,
  });
  history(order, 'created', `${TYPE_LABEL[type]} order from ${source}`, source === 'staff' ? by : undefined);

  try {
    await order.save();
  } catch (error) {
    if (isDuplicate(error) && clientRequestId) {
      const existing = await RestaurantOrder.findOne({ where: { clientRequestId } });
      if (existing) return { order: existing, duplicate: true };
    }
    throw error;
  }
  try {
    const kot = await createKot(kotFor(order, { type: 'original', sequence: 1, lines: order.items, by: source === 'staff' ? by : undefined }));
    await linkLines(order, order.items, kot);
  } catch (error) {
    await RestaurantOrder.destroy({ where: { id: order.id } });
    throw error;
  }

  let paid = order;
  if (payment) paid = (await recordPayment(order.id, { ...payment, requestId: payment.requestId || (clientRequestId ? `${clientRequestId}:pay` : undefined) }, by)).order;
  publish('order', { id: String(order.id), orderNumber: order.orderNumber, status: 'new', created: true });
  return { order: paid, duplicate: false };
}

// Lowest progress of the live tickets decides the order's status. When the
// last ticket is served the order is served, and a room charge is posted.
export async function syncOrderStatus(orderId, by) {
  const order = await RestaurantOrder.findByPk(toId(orderId));
  if (!order || order.status === 'cancelled') return order;
  const tickets = await Kot.findAll({ where: { order: order.id, type: ne('cancellation'), status: Object.keys(RANK) }, light: true });
  if (!tickets.length) return order;

  const lowest = tickets.reduce((min, ticket) => (RANK[ticket.status] < RANK[min] ? ticket.status : min), 'served');
  if (lowest === order.status) return order;

  if (lowest === 'served' && order.paymentMode === 'room_charge') await postOrderToFolio(order.id, by);

  const set = { status: lowest };
  if (lowest === 'served') set.servedAt = new Date();
  const [changed] = await RestaurantOrder.update(set, { where: { id: order.id, status: ne('cancelled') } });
  if (changed) await OrderHistory.create({ orderId: order.id, event: lowest, by });
  publish('order', { id: String(order.id), orderNumber: order.orderNumber, status: lowest });
  return RestaurantOrder.findByPk(order.id);
}

export async function advanceKot(kotId, to, by) {
  const kot = await Kot.findByPk(toId(kotId));
  if (!kot) throw notFound('Ticket not found.');

  if (kot.type === 'cancellation') {
    if (to !== 'acknowledged') throw badRequest('A cancellation ticket can only be acknowledged.');
    const [done] = await Kot.update({ status: 'acknowledged', times_acknowledged: new Date() }, { where: { id: kot.id, status: 'new' } });
    if (!done) throw conflict('That cancellation was already acknowledged.');
    publish('kot', { id: String(kot.id), orderId: String(kot.order), status: 'acknowledged' });
    return Kot.findByPk(kot.id);
  }

  const from = kot.status;
  if (NEXT[from] !== to) {
    throw badRequest(NEXT[from] ? `A ${from} ticket moves to ${NEXT[from]}.` : `A ${from} ticket cannot be moved.`);
  }
  // The status in the WHERE clause is the guard: only one of two simultaneous requests changes a row.
  const [moved] = await Kot.update({ status: to, [`times_${to}`]: new Date() }, { where: { id: kot.id, status: from } });
  if (!moved) throw conflict('Someone else already moved this ticket. The screen has been refreshed.');
  try {
    await syncOrderStatus(kot.order, by);
  } catch (error) {
    // The charge could not be posted; put the ticket back so it can be retried.
    await Kot.update({ status: from, [`times_${to}`]: null }, { where: { id: kot.id, status: to } });
    throw error;
  }
  publish('kot', { id: String(kot.id), orderId: String(kot.order), status: to });
  return Kot.findByPk(kot.id);
}

export async function addItems(orderId, input, by) {
  const order = await RestaurantOrder.findByPk(toId(orderId));
  if (!order) throw notFound('Order not found.');
  if (!OPEN_STATUSES.includes(order.status)) throw badRequest(`A ${order.status} order cannot take more items. Start a new order.`);
  if (order.paymentMode === 'room_charge') assertInHouse(await Reservation.findByPk(order.reservation));

  const added = await priceLines(input);
  const sequence = (await Kot.count({ where: { order: order.id, type: ne('cancellation') } })) + 1;
  order.items.push(...added);
  Object.assign(order, totalsFor(order.items, order.taxRate, order.serviceRate));
  history(order, 'items_added', `Supplementary ticket with ${added.length} line${added.length === 1 ? '' : 's'}`, by);
  await order.save();
  const kot = await createKot(kotFor(order, { type: 'supplementary', sequence, lines: added, by }));
  await linkLines(order, added, kot);
  await syncOrderStatus(order.id, by);
  publish('order', { id: String(order.id), orderNumber: order.orderNumber, status: order.status, updated: true });
  return RestaurantOrder.findByPk(order.id);
}

// Cancels some lines or the whole order. The kitchen gets a cancellation ticket
// carrying the reason; the lines themselves stay on the order for the audit.
export async function cancelItems(orderId, { lineIds, reason, by, role, byGuest = false }) {
  const why = text(reason, 300);
  if (why.length < 3) throw badRequest('Give a reason for the cancellation.');

  const order = await RestaurantOrder.findByPk(toId(orderId));
  if (!order) throw notFound('Order not found.');
  if (order.status === 'cancelled') throw badRequest('This order is already cancelled.');
  if (order.status === 'served') throw badRequest('A served order cannot be cancelled. Refund or reverse the charge instead.');

  const wanted = Array.isArray(lineIds) && lineIds.length ? new Set(lineIds.map(String)) : null;
  const targets = order.items.filter((line) => line.status === 'active' && (!wanted || wanted.has(String(line._id))));
  if (!targets.length) throw badRequest('There is nothing left to cancel.');

  const tickets = await Kot.findAll({ where: { order: order.id, type: ne('cancellation') } });
  const ticketOf = new Map(tickets.map((ticket) => [String(ticket.id), ticket]));
  for (const line of targets) {
    const ticket = ticketOf.get(String(line.kot));
    if (!ticket) continue;
    if (ticket.status === 'served') throw badRequest(`${line.name} was already served. Use a refund or a folio reversal.`);
    if (byGuest && ticket.status !== 'new') throw badRequest('The kitchen has already started this order. Please call the restaurant to change it.');
    if (!byGuest && ['preparing', 'ready'].includes(ticket.status) && !isManager(role)) {
      throw new HttpError(403, `${line.name} is already being prepared. A manager must approve cancelling it.`);
    }
  }

  const stamp = new Date();
  for (const line of targets) {
    line.status = 'cancelled';
    line.cancelReason = why;
    line.cancelledBy = byGuest ? null : toId(by);
    line.cancelledAt = stamp;
  }
  const totals = totalsFor(order.items, order.taxRate, order.serviceRate);
  const everything = order.items.every((line) => line.status === 'cancelled');
  if (everything && order.paidAmount > 0) throw badRequest(`Refund the Rs ${order.paidAmount} already paid before cancelling this order.`);
  if (!everything && totals.total < order.paidAmount) throw badRequest('The new total is below what was paid. Refund the difference first.');

  Object.assign(order, totals);
  if (everything) {
    order.status = 'cancelled';
    order.cancel = { reason: why, by: byGuest ? null : by, at: stamp, byGuest };
  }
  history(order, everything ? 'cancelled' : 'items_cancelled', `${why} (${targets.map((line) => line.name).join(', ')})`, byGuest ? undefined : by);
  await order.save();

  // One cancellation ticket per original ticket affected.
  const targetIds = new Set(targets.map((line) => String(line.id)));
  for (const ticket of tickets) {
    const hit = targets.filter((line) => String(line.kot) === String(ticket.id));
    if (!hit.length) continue;
    const allGone = ticket.items.every((item) => item.cancelled || targetIds.has(String(item.line)));
    // Only touch the ticket if the kitchen has not moved it in the meantime.
    const guard = { id: ticket.id, status: ticket.status };
    const untouched = allGone
      ? (await Kot.update({ status: 'cancelled', times_cancelled: stamp }, { where: guard }))[0]
      : await Kot.count({ where: guard });
    if (untouched) await KotItem.update({ cancelled: true }, { where: { kotId: ticket.id, line: hit.map((line) => line.id) } });
    await createKot(kotFor(order, { type: 'cancellation', sequence: ticket.sequence, lines: hit, reason: why, cancels: ticket.id, by: byGuest ? undefined : by }));
  }
  if (!everything) await syncOrderStatus(order.id, by);
  publish('order', { id: String(order.id), orderNumber: order.orderNumber, status: everything ? 'cancelled' : order.status, updated: true });
  return RestaurantOrder.findByPk(order.id);
}

// Folio

const orderDescription = (order) => `Restaurant ${order.orderNumber} (${TYPE_LABEL[order.type]})`;

// Puts a room-charge order on the guest folio exactly once. `settleBalance`
// is used at checkout to move the unpaid balance of a pay-now order there.
export async function postOrderToFolio(orderId, by, { settleBalance = false } = {}) {
  const order = await RestaurantOrder.findByPk(toId(orderId));
  if (!order) throw notFound('Order not found.');
  if (order.billing.posted) return order;
  if (order.status === 'cancelled') throw badRequest('A cancelled order cannot be charged.');
  if (!order.reservation) throw badRequest('This order is not linked to a guest booking.');
  if (!settleBalance && order.paymentMode !== 'room_charge') throw badRequest('Only room-charge orders post to the folio.');
  if (!settleBalance && order.paidAmount > 0) throw badRequest('This order has already been paid directly and cannot also be charged to the room.');

  const amount = settleBalance ? order.total - order.paidAmount : order.total;
  if (amount <= 0) return order;

  // Claim first. Whoever flips `posted` owns the posting; a retry finds it done.
  const [claimed] = await RestaurantOrder.update(
    { billing_posted: true, billing_postedAt: new Date(), billing_postedBy: toId(by), paymentMode: 'room_charge' },
    { where: { id: order.id, billing_posted: false, status: ne('cancelled') } },
  );
  if (!claimed) return RestaurantOrder.findByPk(order.id);

  const ratio = order.total ? amount / order.total : 1;
  let entry = null;
  try {
    entry = await tx(async (transaction) => {
      const inHouse = await Reservation.count({ where: { id: order.reservation, status: 'checked_in' }, transaction });
      if (!inHouse) return null;
      // (reservationId, refKey) is unique, so the same order cannot be posted to the bill twice.
      return ReservationFolio.create({
        reservationId: order.reservation,
        kind: 'charge',
        department: 'restaurant',
        description: `${orderDescription(order)}${settleBalance && order.paidAmount ? ' — balance after part payment' : ''}`,
        amount,
        taxAmount: Math.round(order.taxAmount * ratio),
        serviceAmount: Math.round(order.serviceAmount * ratio),
        ref: order.id,
        refNumber: order.orderNumber,
        refKey: `restaurant-order:${order.id}`,
        by,
      }, { transaction });
    });
  } catch (error) {
    if (!isDuplicate(error)) throw error;
  }
  if (!entry) {
    await RestaurantOrder.update(
      { billing_posted: false, billing_postedAt: null, billing_postedBy: null, paymentMode: order.paymentMode },
      { where: { id: order.id } },
    );
    throw conflict('The charge could not be posted to the guest folio. The guest may have checked out.');
  }
  await RestaurantOrder.update({ billing_folioEntry: entry.id }, { where: { id: order.id } });
  await OrderHistory.create({ orderId: order.id, event: 'posted', note: `Rs ${amount} to the guest folio`, by });
  return RestaurantOrder.findByPk(order.id);
}

// Called when a guest is checked out: nothing may still be in the kitchen, and
// every served order that was not paid goes onto the final bill.
export async function settleForCheckout(reservation, by) {
  const open = await RestaurantOrder.findAll({ where: { reservation: reservation.id, status: OPEN_STATUSES } });
  const blocking = open.filter((order) => order.paymentMode === 'room_charge' || order.balance > 0);
  if (blocking.length) {
    throw badRequest(`Restaurant order ${blocking.map((order) => order.orderNumber).join(', ')} is still in progress. Finish or cancel it before checkout.`);
  }
  const served = await RestaurantOrder.findAll({ where: { reservation: reservation.id, status: 'served', billing_posted: false } });
  for (const order of served) {
    if (order.paymentMode === 'room_charge') await postOrderToFolio(order.id, by);
    else if (order.balance > 0) await postOrderToFolio(order.id, by, { settleBalance: true });
  }
}

// Manual lines (jeep safari, laundry), discounts and adjustments.
export async function addFolioEntry(reservationId, { department, description, amount, reason }, by, role) {
  const reservation = await Reservation.findByPk(toId(reservationId));
  if (!reservation) throw notFound('Reservation not found.');
  if (!['checked_in'].includes(reservation.status)) throw badRequest('Charges can be added while the guest is checked in.');
  if (!['service', 'adjustment', 'discount'].includes(department)) throw badRequest('Choose service, adjustment or discount.');
  const value = Math.round(Number(amount));
  if (!Number.isFinite(value) || value <= 0) throw badRequest('Enter an amount above zero.');
  const label = text(description, 200);
  if (!label) throw badRequest('Describe the charge.');
  if (department !== 'service' && !isManager(role)) throw new HttpError(403, 'Only a manager can add discounts and adjustments.');
  if (department !== 'service' && text(reason, 300).length < 3) throw badRequest('Give a reason for the adjustment.');

  await ReservationFolio.create({
    reservationId: reservation.id,
    kind: department === 'discount' ? 'credit' : 'charge',
    department,
    description: label,
    amount: value,
    reason: text(reason, 300),
    by,
  });
  return Reservation.findByPk(reservation.id);
}

// Undoes a posted charge with a credit that points back at it.
export async function reverseFolioEntry(reservationId, entryId, reason, by) {
  const why = text(reason, 300);
  if (why.length < 3) throw badRequest('Give a reason for the reversal.');
  if (!toId(entryId)) throw badRequest('Unknown folio entry.');

  const reservation = await Reservation.findByPk(toId(reservationId));
  if (!reservation) throw notFound('Reservation not found.');
  if (reservation.status === 'checked_out') throw badRequest('The folio is closed after checkout.');
  const original = reservation.folio.find((entry) => String(entry.id) === String(entryId));
  if (!original || original.kind !== 'charge') throw badRequest('Only a charge can be reversed.');

  const credit = await ReservationFolio.create({
    reservationId: reservation.id,
    kind: 'credit',
    department: original.department,
    description: `Reversal: ${original.description}`,
    amount: original.amount,
    taxAmount: original.taxAmount,
    serviceAmount: original.serviceAmount,
    ref: original.ref,
    refNumber: original.refNumber,
    reversalOf: original.id,
    reason: why,
    by,
  });
  // Claim the charge: only one reversal can flip reversedBy from NULL.
  const [claimed] = await ReservationFolio.update({ reversedBy: credit.id }, { where: { id: original.id, kind: 'charge', reversedBy: null } });
  if (claimed !== 1) {
    await ReservationFolio.destroy({ where: { id: credit.id } });
    throw conflict('That charge was already reversed.');
  }

  if (original.department === 'restaurant' && original.ref) {
    await RestaurantOrder.update({ billing_reversed: true }, { where: { id: original.ref } });
    await OrderHistory.create({ orderId: original.ref, event: 'folio_reversed', note: why, by });
    publish('order', { id: String(original.ref), updated: true });
  }
  return Reservation.findByPk(reservation.id);
}

// Payments

export async function recordPayment(orderId, input, by) {
  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount < 1) throw badRequest('Enter an amount above zero.');
  if (!PAY_METHODS.includes(input.method)) throw badRequest(`Method must be one of: ${PAY_METHODS.join(', ')}.`);
  const requestId = text(input.requestId, 80) || undefined;

  if (requestId) {
    const repeat = await RestaurantPayment.findOne({ where: { requestId } });
    if (repeat) return { payment: repeat, order: await RestaurantOrder.findByPk(toId(orderId)), duplicate: true };
  }
  const order = await RestaurantOrder.findByPk(toId(orderId));
  if (!order) throw notFound('Order not found.');
  if (order.paymentMode !== 'pay_now') throw badRequest('This order is charged to the room. It cannot also be paid directly.');
  if (order.status === 'cancelled') throw badRequest('This order is cancelled.');

  // The guard lives in the UPDATE itself so two cashiers cannot overpay together.
  const [applied] = await RestaurantOrder.update(
    { paidAmount: sequelize.literal(`\`paidAmount\` + ${amount}`) },
    {
      where: {
        id: order.id,
        paymentMode: 'pay_now',
        status: ne('cancelled'),
        billing_posted: false,
        [Op.and]: [sequelize.literal(`\`paidAmount\` + ${amount} <= \`total\``)],
      },
    },
  );
  if (!applied) {
    const fresh = await RestaurantOrder.findByPk(order.id);
    if (fresh.billing.posted) throw badRequest('This order was already moved to the room bill.');
    throw badRequest(`Only Rs ${fresh.balance} is still due on this order.`);
  }
  await OrderHistory.create({ orderId: order.id, event: 'payment', note: `Rs ${amount} by ${input.method}`, by });
  try {
    const date = todayIn(env.timezone);
    const payment = await RestaurantPayment.create({
      receiptNumber: await nextReceiptNumber(date),
      kind: 'payment',
      order: order.id,
      orderNumber: order.orderNumber,
      guestName: order.guestName,
      amount,
      method: input.method,
      reference: text(input.reference, 80),
      note: text(input.note, 300),
      requestId,
      businessDate: date,
      by,
    });
    publish('payment', { orderId: String(order.id) });
    return { payment, order: await RestaurantOrder.findByPk(order.id), duplicate: false };
  } catch (error) {
    await RestaurantOrder.update({ paidAmount: sequelize.literal(`\`paidAmount\` - ${amount}`) }, { where: { id: order.id } });
    if (isDuplicate(error) && requestId) {
      const repeat = await RestaurantPayment.findOne({ where: { requestId } });
      if (repeat) return { payment: repeat, order: await RestaurantOrder.findByPk(order.id), duplicate: true };
    }
    throw error;
  }
}

export async function refundPayment(orderId, input, by) {
  const amount = Math.round(Number(input.amount));
  const why = text(input.reason, 300);
  if (!Number.isFinite(amount) || amount < 1) throw badRequest('Enter an amount above zero.');
  if (why.length < 3) throw badRequest('Give a reason for the refund.');
  if (!PAY_METHODS.includes(input.method)) throw badRequest('Choose how the refund is paid out.');
  const requestId = text(input.requestId, 80) || undefined;
  if (requestId) {
    const repeat = await RestaurantPayment.findOne({ where: { requestId } });
    if (repeat) return { payment: repeat, order: await RestaurantOrder.findByPk(toId(orderId)), duplicate: true };
  }

  const [applied] = await RestaurantOrder.update(
    { paidAmount: sequelize.literal(`\`paidAmount\` - ${amount}`) },
    { where: { id: toId(orderId), paidAmount: { [Op.gte]: amount } } },
  );
  if (!applied) throw badRequest('A refund cannot be more than what was paid.');
  const updated = await RestaurantOrder.findByPk(toId(orderId));
  await OrderHistory.create({ orderId: updated.id, event: 'refund', note: `Rs ${amount}: ${why}`, by });
  try {
    const date = todayIn(env.timezone);
    const payment = await RestaurantPayment.create({
      receiptNumber: await nextReceiptNumber(date),
      kind: 'refund',
      order: updated.id,
      orderNumber: updated.orderNumber,
      guestName: updated.guestName,
      amount,
      method: input.method,
      reference: text(input.reference, 80),
      note: why,
      requestId,
      businessDate: date,
      by,
    });
    publish('payment', { orderId: String(updated.id) });
    return { payment, order: updated, duplicate: false };
  } catch (error) {
    await RestaurantOrder.update({ paidAmount: sequelize.literal(`\`paidAmount\` + ${amount}`) }, { where: { id: updated.id } });
    throw error;
  }
}

// Categories

// Menu items created before categories existed carry only a name; make sure
// each name has a category row so it can be ordered and hidden.
export async function ensureCategories() {
  const names = (await MenuItem.findAll({ attributes: ['category'], group: ['category'], raw: true })).map((row) => row.category);
  if (!names.length) return;
  const known = new Set((await RestaurantCategory.findAll({ attributes: ['name'], raw: true })).map((row) => row.name));
  const missing = names.filter((name) => name && !known.has(name));
  if (missing.length) {
    const start = await RestaurantCategory.count();
    await RestaurantCategory.bulkCreate(missing.map((name, index) => ({ name, sortOrder: start + index })), { ignoreDuplicates: true });
  }
  await linkMenuCategories();
}

// Points every dish at its category by id (MenuItem.categoryId), so the two tables
// are really related and not only matched by name. Safe to run any number of times.
export async function linkMenuCategories() {
  const categories = await RestaurantCategory.findAll({ attributes: ['id', 'name'], raw: true });
  await Promise.all(categories.map((category) => MenuItem.update(
    { categoryId: category.id },
    { where: { category: category.name, [Op.or]: [{ categoryId: null }, { categoryId: ne(category.id) }] } },
  )));
}
