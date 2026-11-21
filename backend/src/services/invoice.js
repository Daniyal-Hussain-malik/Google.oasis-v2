import { Op } from 'sequelize';
import { sequelize, toId } from '../models/_base.js';
import Reservation from '../models/Reservation.js';
import RestaurantOrder from '../models/RestaurantOrder.js';
import Settings from '../models/Settings.js';
import { PAGE, PdfDoc, textWidth } from './pdf.js';

const sum = (list, pick) => list.reduce((total, entry) => total + pick(entry), 0);
const signed = (entry) => (entry.kind === 'credit' ? -entry.amount : entry.amount);
const rs = (value) => `${value < 0 ? '-' : ''}Rs ${Math.round(Math.abs(value)).toLocaleString('en-PK')}`;

function pretty(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// Everything the final bill shows, assembled from the booking, its folio and
// its payments. Restaurant orders paid at the till are listed for reference
// but are not part of the totals, so they are never charged twice.
export async function buildInvoice(reservationOrId) {
  const reservation = reservationOrId instanceof Reservation ? reservationOrId : await Reservation.findByPk(toId(reservationOrId));
  if (!reservation) return null;
  const [settings, paidDirect, payLater] = await Promise.all([
    Settings.current(),
    RestaurantOrder.findAll({ where: { reservation: reservation.id, paymentMode: 'pay_now', status: { [Op.ne]: 'cancelled' }, paidAmount: { [Op.gt]: 0 } }, order: [['createdAt', 'ASC']] }),
    // "Pay later" orders: not yet on the folio, so they are added here until checkout posts them.
    RestaurantOrder.findAll({
      where: {
        reservation: reservation.id,
        paymentMode: 'pay_now',
        status: { [Op.ne]: 'cancelled' },
        billing_posted: false,
        [Op.and]: [sequelize.literal('`total` > `paidAmount`')],
      },
      order: [['createdAt', 'ASC']],
    }),
  ]);

  const roomLines = reservation.breakdown.map((night) => ({ description: `${pretty(night.date)} - ${night.label}`, amount: night.rate }));
  const roomTotal = reservation.totalAmount;

  const section = (department) => {
    const entries = reservation.folio.filter((entry) => entry.department === department);
    return {
      lines: entries.map((entry) => ({
        description: entry.description + (entry.reversedBy ? ' (reversed)' : ''),
        amount: signed(entry),
        reversed: Boolean(entry.reversedBy) || Boolean(entry.reversalOf),
      })),
      total: sum(entries, signed),
    };
  };
  const restaurant = section('restaurant');
  let pendingTax = 0;
  let pendingService = 0;
  for (const order of payLater) {
    const due = order.total - order.paidAmount;
    const ratio = order.total ? due / order.total : 1;
    restaurant.lines.push({ description: `Restaurant ${order.orderNumber} - pay later${order.paidAmount ? ' (balance)' : ''}`, amount: due, reversed: false });
    restaurant.total += due;
    pendingTax += Math.round(order.taxAmount * ratio);
    pendingService += Math.round(order.serviceAmount * ratio);
  }
  const services = section('service');
  const adjustments = section('adjustment');
  const discounts = section('discount');

  const restaurantEntries = reservation.folio.filter((entry) => entry.department === 'restaurant');
  const restaurantTax = pendingTax + sum(restaurantEntries, (entry) => (entry.kind === 'credit' ? -entry.taxAmount : entry.taxAmount));
  const restaurantService = pendingService + sum(restaurantEntries, (entry) => (entry.kind === 'credit' ? -entry.serviceAmount : entry.serviceAmount));

  const grandTotal = roomTotal + reservation.folioTotal + sum(payLater, (order) => order.total - order.paidAmount);
  return {
    invoiceNumber: `INV-${reservation.bookingNumber}`,
    issuedAt: new Date(),
    hotel: { name: settings.name, address: settings.address, phone: settings.phone, email: settings.email, currency: settings.currency },
    guest: { name: reservation.guestName, phone: reservation.guest.phone, email: reservation.guest.email },
    stay: {
      bookingNumber: reservation.bookingNumber,
      status: reservation.status,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      nights: reservation.nights,
      rooms: reservation.rooms.map((room) => `${room.type} ${room.roomNo}`),
    },
    room: { lines: roomLines, total: roomTotal },
    restaurant: { ...restaurant, tax: restaurantTax, service: restaurantService },
    services,
    adjustments,
    discounts,
    payments: reservation.payments.map((payment) => ({
      method: payment.method.replace(/_/g, ' '),
      reference: payment.reference,
      at: payment.at,
      amount: payment.method === 'refund' ? -payment.amount : payment.amount,
    })),
    paidDirect: paidDirect.map((order) => ({ orderNumber: order.orderNumber, total: order.total, paid: order.paidAmount })),
    totals: {
      room: roomTotal,
      restaurant: restaurant.total,
      services: services.total,
      adjustments: adjustments.total,
      discounts: discounts.total,
      grandTotal,
      paid: reservation.paid,
      balance: grandTotal - reservation.paid,
    },
  };
}

export function invoicePdf(invoice) {
  const doc = new PdfDoc();
  const { margin, width, height } = PAGE;
  const right = width - margin;
  const navy = [0.1, 0.15, 0.27];
  const muted = [0.42, 0.45, 0.5];
  let y = margin;

  const header = () => {
    doc.bar(0, 0, width, 70, navy);
    doc.text(margin, 34, invoice.hotel.name, { size: 18, bold: true, color: [1, 1, 1] });
    doc.text(margin, 52, invoice.hotel.address, { size: 8, color: [0.85, 0.88, 0.94] });
    doc.text(right, 34, 'FINAL INVOICE', { size: 12, bold: true, align: 'right', color: [0.91, 0.58, 0.23] });
    doc.text(right, 52, invoice.invoiceNumber, { size: 9, align: 'right', color: [1, 1, 1] });
    y = 96;
  };
  const room = (needed) => {
    if (y + needed <= height - 60) return;
    doc.addPage();
    header();
  };
  header();

  const label = (text, x, at, options = {}) => doc.text(x, at, text, { size: 8, color: muted, ...options });
  label('BILLED TO', margin, y);
  label('STAY', 300, y);
  y += 14;
  doc.text(margin, y, invoice.guest.name, { size: 11, bold: true });
  doc.text(300, y, `${invoice.stay.bookingNumber} - ${invoice.stay.status.replace(/_/g, ' ')}`, { size: 10, bold: true });
  y += 13;
  doc.text(margin, y, [invoice.guest.phone, invoice.guest.email].filter(Boolean).join('  |  '), { size: 9, color: muted });
  doc.text(300, y, `${pretty(invoice.stay.checkIn)} to ${pretty(invoice.stay.checkOut)} (${invoice.stay.nights} night${invoice.stay.nights === 1 ? '' : 's'})`, { size: 9 });
  y += 13;
  doc.text(300, y, invoice.stay.rooms.join(', '), { size: 9, color: muted });
  doc.text(margin, y, `Issued ${new Date(invoice.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, { size: 9, color: muted });
  y += 26;

  const heading = (title) => {
    room(60);
    doc.bar(margin, y - 11, right - margin, 18, [0.95, 0.96, 0.97]);
    doc.text(margin + 6, y + 2, title.toUpperCase(), { size: 8.5, bold: true, color: navy });
    y += 22;
  };
  const row = (description, amount, { bold = false, muted: dim = false } = {}) => {
    room(18);
    const max = right - margin - 110;
    let text = description;
    while (text.length > 4 && textWidth(text, 9.5, bold) > max) text = `${text.slice(0, -2)}`;
    if (text !== description) text = `${text.trim()}...`;
    doc.text(margin + 6, y, text, { size: 9.5, bold, color: dim ? muted : [0.1, 0.12, 0.2] });
    if (amount !== null) doc.text(right - 6, y, rs(amount), { size: 9.5, bold, align: 'right', color: dim ? muted : [0.1, 0.12, 0.2] });
    y += 15;
  };
  const rule = () => {
    doc.line(margin, y - 8, right);
    y += 2;
  };

  heading('Room charges');
  invoice.room.lines.forEach((line) => row(line.description, line.amount));
  rule();
  row('Room charges', invoice.room.total, { bold: true });
  y += 8;

  const block = (title, part, extra) => {
    if (!part.lines.length) return;
    heading(title);
    part.lines.forEach((line) => row(line.description, line.amount, { muted: line.reversed }));
    rule();
    extra?.();
    row(title, part.total, { bold: true });
    y += 8;
  };
  block('Restaurant charges', invoice.restaurant, () => {
    if (invoice.restaurant.tax) row('Includes sales tax', invoice.restaurant.tax, { muted: true });
    if (invoice.restaurant.service) row('Includes service charge', invoice.restaurant.service, { muted: true });
  });
  block('Other resort services', invoice.services);
  block('Adjustments', invoice.adjustments);
  block('Discounts', invoice.discounts);

  if (invoice.paidDirect.length) {
    heading('Restaurant orders paid at the restaurant (not billed here)');
    invoice.paidDirect.forEach((order) => row(`${order.orderNumber} - paid ${rs(order.paid)} of ${rs(order.total)}`, null, { muted: true }));
    y += 8;
  }

  heading('Summary');
  const t = invoice.totals;
  row('Room charges', t.room);
  row('Restaurant charges', t.restaurant);
  if (t.services) row('Other resort services', t.services);
  if (t.adjustments) row('Adjustments', t.adjustments);
  if (t.discounts) row('Discounts', t.discounts);
  rule();
  row('Total', t.grandTotal, { bold: true });
  row('Advance payments and payments received', -t.paid);
  rule();
  room(50);
  doc.bar(margin, y - 8, right - margin, 26, navy);
  doc.text(margin + 8, y + 9, t.balance > 0 ? 'BALANCE DUE' : 'BALANCE', { size: 10, bold: true, color: [1, 1, 1] });
  doc.text(right - 8, y + 9, rs(t.balance), { size: 12, bold: true, align: 'right', color: [0.91, 0.58, 0.23] });
  y += 40;
  doc.text(margin, y, `${invoice.hotel.name}  |  ${invoice.hotel.phone}  |  ${invoice.hotel.email}`, { size: 8, color: muted });
  return doc.build();
}
