import { Router } from 'express';
import { formLimit } from '../middleware/limits.js';
import PaymentClaim, { CLAIM_METHODS } from '../models/PaymentClaim.js';
import Reservation from '../models/Reservation.js';
import Settings from '../models/Settings.js';
import { paymentProofSubmitted } from '../services/notifications.js';
import { badRequest, conflict, text } from '../utils/http.js';
import { isDuplicate } from '../utils/sql.js';
import { findGuestBooking } from './public.js';

const router = Router();

const MAX_AMOUNT = 10000000;
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9\-_.]{5,39}$/;

// Checks what the guest typed. Shared by the booking and the food-order versions.
export async function readClaim(body) {
  const method = String(body?.method || '');
  if (!CLAIM_METHODS.includes(method)) throw badRequest('Choose Easypaisa or bank transfer.');
  const settings = await Settings.current();
  const account = method === 'easypaisa' ? settings.payments.easypaisa : settings.payments.bank;
  if (!account.enabled) throw badRequest('That payment method is not available right now.');

  const amount = Math.round(Number(body?.amount));
  if (!Number.isFinite(amount) || amount < 1 || amount > MAX_AMOUNT) throw badRequest('Enter the amount you sent.');
  const reference = text(body?.reference, 40);
  if (!REFERENCE.test(reference)) throw badRequest('Enter the transaction ID from your receipt (6 to 40 letters and numbers).');
  return { method, amount, reference, senderName: text(body?.senderName, 80) };
}

// Saves a claim, refusing a transaction ID that is already on file.
export async function saveClaim(data) {
  const dupKey = `${data.method}:${data.reference.toUpperCase()}`;
  try {
    return await PaymentClaim.create({ ...data, dupKey });
  } catch (error) {
    if (isDuplicate(error)) throw conflict('That transaction ID has already been submitted. If this is a mistake, call the desk.');
    throw error;
  }
}

// "I have paid": a booking number and phone identify the stay, as everywhere else on the site.
router.post('/claim', formLimit, async (req, res) => {
  const reservation = await findGuestBooking(req.body || {});
  if (!['confirmed', 'checked_in', 'checked_out'].includes(reservation.status)) throw badRequest('This booking is not open for payments.');
  const data = await readClaim(req.body);
  const claim = await saveClaim({
    ...data,
    target: 'reservation',
    reservation: reservation.id,
    bookingNumber: reservation.bookingNumber,
    guestName: reservation.guestName,
  });
  paymentProofSubmitted(claim, reservation);
  res.status(201).json({ ok: true, status: claim.status });
});

// Where each proof stands, for the guest who sent it.
router.post('/mine', formLimit, async (req, res) => {
  const reservation = await findGuestBooking(req.body || {});
  const claims = await PaymentClaim.findAll({ where: { reservation: reservation.id }, order: [['createdAt', 'DESC']] });
  res.json(claims.map((claim) => ({
    method: claim.method,
    amount: claim.amount,
    reference: claim.reference,
    orderNumber: claim.orderNumber,
    status: claim.status,
    rejectReason: claim.status === 'rejected' ? claim.rejectReason : '',
    at: claim.createdAt,
  })));
});

export default router;
