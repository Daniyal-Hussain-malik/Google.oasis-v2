import { Router } from 'express';
import { formLimit } from '../middleware/limits.js';
import { upload } from '../middleware/upload.js';
import PaymentClaim, { CLAIM_METHODS } from '../models/PaymentClaim.js';
import Settings from '../models/Settings.js';
import { requireGuestSession } from '../services/guestAuth.js';
import { paymentProofSubmitted } from '../services/notifications.js';
import { uploadImageObject } from '../services/storage.js';
import { badRequest, conflict, text } from '../utils/http.js';
import { isDuplicate } from '../utils/sql.js';

const router = Router();

const MAX_AMOUNT = 10000000;
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9\-_.]{5,39}$/;

function cleanProofUrl(raw) {
  const value = text(raw, 500);
  if (!value) return '';
  if (value.startsWith('/api/public/media/') || value.startsWith('/uploads/')) return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:') return value;
  } catch {
    /* ignore */
  }
  throw badRequest('Invalid payment proof image URL.');
}

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
  const proofImageUrl = cleanProofUrl(body?.proofImageUrl);
  return { method, amount, reference, senderName: text(body?.senderName, 80), proofImageUrl };
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

// Upload receipt screenshot to Cloud Object Storage for OTP-verified guests.
router.post('/proof-upload', formLimit, upload.single('image'), async (req, res) => {
  await requireGuestSession(req);
  if (!req.file) throw badRequest('Attach an image in the "image" field.');
  const uploaded = await uploadImageObject({
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
    folder: 'payment-proofs',
  });
  res.status(201).json(uploaded);
});

// "I have paid": requires OTP-verified guest session pinned to the booking.
router.post('/claim', formLimit, async (req, res) => {
  const body = req.body || {};
  const reservation = await requireGuestSession(req, { expectedBookingNumber: body.bookingNumber });
  if (!['confirmed', 'checked_in', 'checked_out'].includes(reservation.status)) {
    throw badRequest('This booking is not open for payments.');
  }
  const data = await readClaim(body);
  const claim = await saveClaim({
    ...data,
    target: 'reservation',
    reservation: reservation.id,
    bookingNumber: reservation.bookingNumber,
    guestName: reservation.guestName,
  });
  paymentProofSubmitted(claim, reservation);
  res.status(201).json({ ok: true, status: claim.status, proofImageUrl: claim.proofImageUrl });
});

// Where each proof stands, for the OTP-verified guest.
router.post('/mine', formLimit, async (req, res) => {
  const reservation = await requireGuestSession(req, { expectedBookingNumber: req.body?.bookingNumber });
  const claims = await PaymentClaim.findAll({ where: { reservation: reservation.id }, order: [['createdAt', 'DESC']] });
  res.json(
    claims.map((claim) => ({
      method: claim.method,
      amount: claim.amount,
      reference: claim.reference,
      proofImageUrl: claim.proofImageUrl || '',
      orderNumber: claim.orderNumber,
      status: claim.status,
      rejectReason: claim.status === 'rejected' ? claim.rejectReason : '',
      at: claim.createdAt,
    })),
  );
});

export default router;
