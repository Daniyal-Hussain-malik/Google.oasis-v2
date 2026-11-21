import { Base, D, dt, enumCol, fk, int, text } from './_base.js';

export const OTP_CHANNELS = ['whatsapp', 'email', 'sms'];

// One-time passcodes for verifying Guest Lookup & Portal sessions.
export class GuestOtp extends Base {}
GuestOtp.setup(
  {
    reservationId: fk('reservations', { required: true, onDelete: 'CASCADE' }),
    bookingNumber: text({ len: 20, required: true }),
    channel: enumCol(OTP_CHANNELS, 'whatsapp'),
    destinationMasked: text({ len: 120 }),
    codeHash: { type: D.STRING(128), allowNull: false },
    attempts: int(0),
    expiresAt: dt({ required: true }),
    consumedAt: dt(),
  },
  {
    table: 'guest_otps',
    indexes: [
      { fields: ['reservationId'] },
      { fields: ['bookingNumber'] },
      { fields: ['expiresAt'] },
    ],
  },
);

export default GuestOtp;
