import { Base, D, Row, enumCol, fk, int, money, rowColumns, text } from './_base.js';

export const STATUSES = ['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];
export const SOURCES = ['website', 'desk', 'phone', 'whatsapp', 'agency', 'booking_com', 'airbnb', 'ota'];
export const HOLDING = ['confirmed', 'checked_in'];
export const FOLIO_DEPARTMENTS = ['restaurant', 'service', 'adjustment', 'discount'];
const PAYMENT_METHODS = ['online_demo', 'cash', 'card', 'bank_transfer', 'jazzcash', 'easypaisa', 'refund'];
const parent = () => fk('reservations', { required: true, onDelete: 'CASCADE' });
const now = () => ({ type: D.DATE(3), allowNull: false, defaultValue: D.NOW });

class ReservationRoom extends Row {}
ReservationRoom.setup(
  { reservationId: parent(), room: fk('rooms'), roomNo: text({ len: 20 }), type: text({ len: 120 }), ...rowColumns },
  { table: 'reservation_rooms', timestamps: false },
);

class ReservationNight extends Row {}
ReservationNight.setup(
  { reservationId: parent(), date: { type: D.STRING(10), allowNull: false }, label: text({ len: 160 }), rate: money(0), ...rowColumns },
  { table: 'reservation_nights', timestamps: false },
);

class ReservationPayment extends Row {}
ReservationPayment.setup(
  {
    reservationId: parent(),
    amount: money(0, { validate: { min: 0 } }),
    method: enumCol(PAYMENT_METHODS),
    reference: text({ len: 120 }),
    note: text({ len: 400 }),
    by: fk('users'),
    at: now(),
    ...rowColumns,
  },
  { table: 'reservation_payments', timestamps: false },
);

class ReservationFolio extends Row {}
ReservationFolio.setup(
  {
    reservationId: parent(),
    kind: enumCol(['charge', 'credit']),
    department: enumCol(FOLIO_DEPARTMENTS),
    description: text({ len: 255, required: true }),
    amount: money(0, { validate: { min: 0 } }),
    taxAmount: money(0),
    serviceAmount: money(0),
    ref: fk('restaurant_orders'),
    refNumber: text({ len: 40 }),
    refKey: text({ len: 80, allowNull: true }),
    reversalOf: fk('reservation_folio'),
    reversedBy: fk('reservation_folio'),
    reason: text({ len: 400 }),
    by: fk('users'),
    at: now(),
    ...rowColumns,
  },
  { table: 'reservation_folio', timestamps: false, indexes: [{ unique: true, fields: ['reservationId', 'refKey'] }] },
);

class ReservationHistory extends Row {}
ReservationHistory.setup(
  { reservationId: parent(), status: text({ len: 30, allowNull: true }), note: text({ len: 400, allowNull: true }), by: fk('users'), at: now(), ...rowColumns },
  { table: 'reservation_history', timestamps: false },
);

export class Reservation extends Base {
  get guestName() {
    return `${this.guest.firstName} ${this.guest.lastName}`.trim();
  }

  get paid() {
    return (this.payments || []).reduce((sum, payment) => sum + (payment.method === 'refund' ? -payment.amount : payment.amount), 0);
  }

  get folioTotal() {
    return (this.folio || []).reduce((sum, entry) => sum + (entry.kind === 'credit' ? -entry.amount : entry.amount), 0);
  }

  get balance() {
    return this.totalAmount + this.folioTotal - this.paid;
  }

  toPublic() {
    return {
      bookingNumber: this.bookingNumber,
      status: this.status,
      guestName: this.guestName,
      rooms: this.rooms.map((room) => ({ type: room.type, roomNo: room.roomNo })),
      checkIn: this.checkIn,
      checkOut: this.checkOut,
      nights: this.nights,
      adults: this.adults,
      children: this.children,
      specialRequests: this.specialRequests,
      breakdown: this.breakdown.map(({ date, label, rate }) => ({ date, label, rate })),
      totalAmount: this.totalAmount,
      extras: this.folioTotal,
      paid: this.paid,
      balance: this.balance,
      payment: this.paymentChoice,
    };
  }
}

Reservation.setup(
  {
    bookingNumber: { ...text({ len: 20, required: true }), unique: true },
    status: enumCol(STATUSES, 'confirmed'),
    source: enumCol(SOURCES, 'website'),
    guest_firstName: text({ len: 60, required: true }),
    guest_lastName: text({ len: 60, required: true }),
    guest_phone: text({ len: 30, required: true }),
    guest_phoneKey: text({ len: 20, required: true }),
    guest_email: text({ len: 190, required: true, lower: true }),
    specialRequests: text({ big: true }),
    offer: text({ len: 160 }),
    checkIn: { type: D.STRING(10), allowNull: false },
    checkOut: { type: D.STRING(10), allowNull: false },
    nights: int(1, { validate: { min: 1 } }),
    adults: int(1, { validate: { min: 1 } }),
    children: int(0, { validate: { min: 0 } }),
    roomType: fk('room_types', { required: true }),
    totalAmount: money(0, { validate: { min: 0 } }),
    paymentChoice: enumCol(['hotel', 'online_demo'], 'hotel'),
    internalNotes: text({ big: true }),
  },
  {
    table: 'reservations',
    exposeId: true,
    virtuals: ['guestName', 'paid', 'folioTotal', 'balance'],
    nested: { guest: ['firstName', 'lastName', 'phone', 'phoneKey', 'email'] },
    children: {
      rooms: { model: () => ReservationRoom, fk: 'reservationId' },
      breakdown: { model: () => ReservationNight, fk: 'reservationId' },
      payments: { model: () => ReservationPayment, fk: 'reservationId' },
      folio: { model: () => ReservationFolio, fk: 'reservationId' },
      history: { model: () => ReservationHistory, fk: 'reservationId' },
    },
    indexes: [{ fields: ['status'] }, { fields: ['guest_phoneKey'] }, { fields: ['checkIn'] }, { fields: ['checkOut'] }, { fields: ['roomType'] }],
  },
);

export { ReservationFolio, ReservationHistory, ReservationNight, ReservationPayment, ReservationRoom };
export default Reservation;
