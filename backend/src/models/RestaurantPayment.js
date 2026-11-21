import { Base, D, enumCol, fk, money, text } from './_base.js';

export const PAY_METHODS = ['cash', 'card', 'jazzcash', 'easypaisa', 'bank_transfer', 'online_demo'];

export class RestaurantPayment extends Base {}
RestaurantPayment.setup(
  {
    receiptNumber: { ...text({ len: 30, required: true }), unique: true },
    kind: enumCol(['payment', 'refund'], 'payment'),
    order: fk('restaurant_orders', { required: true, onDelete: 'CASCADE' }),
    orderNumber: text({ len: 30, allowNull: true }),
    guestName: text({ len: 120 }),
    amount: money(1, { validate: { min: 1 } }),
    method: enumCol(PAY_METHODS),
    reference: text({ len: 120 }),
    note: text({ len: 400 }),
    requestId: { type: D.STRING(120), allowNull: true, unique: true },
    businessDate: { type: D.STRING(10), allowNull: true },
    by: fk('users'),
  },
  { table: 'restaurant_payments', indexes: [{ fields: ['order'] }, { fields: ['businessDate'] }] },
);

export default RestaurantPayment;
