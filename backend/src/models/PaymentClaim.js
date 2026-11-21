import { Base, D, dt, enumCol, fk, money, text } from './_base.js';

export const CLAIM_METHODS = ['easypaisa', 'bank_transfer'];

// A guest says "I have paid". It only counts on the bill after staff confirm it.
export class PaymentClaim extends Base {}
PaymentClaim.setup(
  {
    target: enumCol(['reservation', 'order']),
    reservation: fk('reservations'),
    order: fk('restaurant_orders'),
    bookingNumber: text({ len: 20 }),
    orderNumber: text({ len: 30 }),
    guestName: text({ len: 120 }),
    method: enumCol(CLAIM_METHODS),
    amount: money(1, { validate: { min: 1 } }),
    reference: text({ len: 80, required: true }),
    senderName: text({ len: 80 }),
    status: enumCol(['pending', 'confirmed', 'rejected'], 'pending'),
    rejectReason: text({ len: 400 }),
    reviewedBy: fk('users'),
    reviewedAt: dt(),
    // method:REFERENCE, unique, so one transaction id cannot be claimed twice. Cleared when a proof is rejected.
    dupKey: { type: D.STRING(140), allowNull: true, unique: true },
  },
  { table: 'payment_claims', indexes: [{ fields: ['reservation'] }, { fields: ['order'] }, { fields: ['status'] }] },
);

export default PaymentClaim;
