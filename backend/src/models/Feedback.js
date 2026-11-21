import { Base, D, bool, fk, text } from './_base.js';

// Reservation is optional so guests can submit general experience feedback from the HomePage
// as well as post-checkout stay ratings linked to a reservation.
export class Feedback extends Base {}
Feedback.setup(
  {
    reservation: { ...fk('reservations', { required: false, onDelete: 'CASCADE' }), unique: true },
    bookingNumber: text({ len: 20, def: 'HOMEPAGE' }),
    guestName: text({ len: 120, required: true }),
    email: text({ len: 120, lower: true }),
    stayTitle: text({ len: 120 }),
    rating: { type: D.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    comment: text({ big: true }),
    published: bool(false),
  },
  { table: 'feedback' },
);

export default Feedback;
