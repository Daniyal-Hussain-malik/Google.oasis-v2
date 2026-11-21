import { Base, D, Row, bool, dt, enumCol, fk, int, money, rowColumns, text } from './_base.js';

export const ORDER_TYPES = ['dine_in', 'takeaway', 'room_service'];
export const ORDER_STATUSES = ['new', 'accepted', 'preparing', 'ready', 'served', 'cancelled'];
const parent = () => fk('restaurant_orders', { required: true, onDelete: 'CASCADE' });

class OrderItemAddOn extends Row {}
OrderItemAddOn.setup(
  { itemId: fk('restaurant_order_items', { required: true, onDelete: 'CASCADE' }), name: text({ len: 120 }), price: money(0), ...rowColumns },
  { table: 'restaurant_order_item_addons', timestamps: false },
);

class OrderItem extends Row {}
OrderItem.setup(
  {
    orderId: parent(),
    // Orders keep their own copy of name and price, so a dish can be removed from the menu later.
    menuItem: fk('menu_items'),
    name: text({ len: 160, required: true }),
    category: text({ len: 120 }),
    station: text({ len: 60, def: 'Kitchen' }),
    variation: text({ len: 120 }),
    unitPrice: money(0, { validate: { min: 0 } }),
    quantity: int(1, { validate: { min: 1 } }),
    note: text({ len: 400 }),
    lineTotal: money(0, { validate: { min: 0 } }),
    status: enumCol(['active', 'cancelled'], 'active'),
    kot: fk('kots'),
    cancelReason: text({ len: 400, allowNull: true }),
    cancelledBy: fk('users'),
    cancelledAt: dt(),
    ...rowColumns,
  },
  { table: 'restaurant_order_items', timestamps: false, indexes: [{ fields: ['kot'] }], rowChildren: { addOns: { model: () => OrderItemAddOn, fk: 'itemId' } } },
);

class OrderHistory extends Row {}
OrderHistory.setup(
  { orderId: parent(), event: text({ len: 40, allowNull: true }), note: text({ len: 600, allowNull: true }), by: fk('users'), at: { type: D.DATE(3), allowNull: false, defaultValue: D.NOW }, ...rowColumns },
  { table: 'restaurant_order_history', timestamps: false },
);

export class RestaurantOrder extends Base {
  get balance() {
    if (this.status === 'cancelled' || this.paymentMode === 'room_charge') return 0;
    return Math.max(this.total - this.paidAmount, 0);
  }

  get paymentStatus() {
    if (this.paymentMode === 'room_charge') {
      if (this.billing?.reversed) return 'reversed';
      if (this.status === 'cancelled') return 'cancelled';
      return this.billing?.posted ? 'charged_to_room' : 'room_charge_pending';
    }
    if (this.status === 'cancelled') return this.paidAmount > 0 ? 'refund_due' : 'cancelled';
    if (this.paidAmount <= 0) return 'unpaid';
    return this.paidAmount >= this.total ? 'paid' : 'partial';
  }
}

RestaurantOrder.setup(
  {
    orderNumber: { ...text({ len: 30, required: true }), unique: true },
    type: enumCol(ORDER_TYPES),
    source: enumCol(['staff', 'guest'], 'staff'),
    status: enumCol(ORDER_STATUSES, 'new'),
    reservation: fk('reservations'),
    bookingNumber: text({ len: 20 }),
    guestName: text({ len: 120 }),
    phone: text({ len: 30 }),
    roomNo: text({ len: 20 }),
    table: text({ len: 40 }),
    notes: text({ big: true }),
    paymentMode: enumCol(['room_charge', 'pay_now']),
    subtotal: money(0),
    taxRate: money(0),
    taxAmount: money(0),
    serviceRate: money(0),
    serviceAmount: money(0),
    total: money(0),
    paidAmount: money(0, { validate: { min: 0 } }),
    billing_posted: bool(false),
    billing_postedAt: dt(),
    billing_postedBy: fk('users'),
    // Points at the entry on the room bill. The foreign key is added after both tables exist (see db/schema.js).
    billing_folioEntry: { type: D.INTEGER, allowNull: true, _idColumn: true },
    billing_reversed: bool(false),
    clientRequestId: { type: D.STRING(120), allowNull: true, unique: true },
    businessDate: { type: D.STRING(10), allowNull: true },
    servedAt: dt(),
    cancel_reason: text({ len: 400, allowNull: true }),
    cancel_by: fk('users'),
    cancel_at: dt(),
    cancel_byGuest: bool(false),
    createdBy: fk('users'),
  },
  {
    table: 'restaurant_orders',
    exposeId: true,
    virtuals: ['balance', 'paymentStatus'],
    nested: {
      billing: ['posted', 'postedAt', 'postedBy', 'folioEntry', 'reversed'],
      cancel: ['reason', 'by', 'at', 'byGuest'],
    },
    children: {
      items: { model: () => OrderItem, fk: 'orderId' },
      history: { model: () => OrderHistory, fk: 'orderId' },
    },
    indexes: [{ fields: ['status'] }, { fields: ['reservation'] }, { fields: ['businessDate'] }],
  },
);

export { OrderHistory, OrderItem, OrderItemAddOn };
export default RestaurantOrder;
