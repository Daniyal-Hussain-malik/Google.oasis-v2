import { Base, D, enumCol, fk, money, text } from './_base.js';

export const LOYALTY_TYPES = ['earn', 'bonus', 'redeem'];
export const LOYALTY_STATUSES = ['posted', 'applied', 'issued'];

export class LoyaltyTransaction extends Base {}
LoyaltyTransaction.setup(
  {
    phoneKey: text({ len: 20, required: true }),
    guestName: text({ len: 120 }),
    reservationId: fk('reservations', { required: false, onDelete: 'SET NULL' }),
    bookingNumber: text({ len: 20 }),
    type: enumCol(LOYALTY_TYPES, 'earn'),
    rewardKey: text({ len: 60, required: true }),
    rewardTitle: text({ len: 140, required: true }),
    category: enumCol(['stay', 'dining', 'upgrade'], 'stay'),
    points: { type: D.INTEGER, allowNull: false },
    pkrValue: money(0),
    voucherCode: text({ len: 40 }),
    status: enumCol(LOYALTY_STATUSES, 'posted'),
    refKey: { ...text({ len: 100, allowNull: true }), unique: true },
    note: text({ len: 400 }),
  },
  {
    table: 'loyalty_transactions',
    indexes: [{ fields: ['phoneKey'] }, { fields: ['reservationId'] }],
  },
);

export default LoyaltyTransaction;
