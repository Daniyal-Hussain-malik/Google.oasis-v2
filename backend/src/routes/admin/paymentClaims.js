import { Router } from 'express';
import { col, fn, Op } from 'sequelize';
import { toId } from '../../models/_base.js';
import PaymentClaim from '../../models/PaymentClaim.js';
import { ReservationPayment } from '../../models/Reservation.js';
import User from '../../models/User.js';
import { paymentProofDecided } from '../../services/notifications.js';
import { recordPayment } from '../../services/restaurant.js';
import { badRequest, int, notFound, text } from '../../utils/http.js';
import { contains, populate } from '../../utils/sql.js';

// Mounted behind the front-office roles. Staff check the money in the Easypaisa or
// bank account first, then confirm here; only then does it count on the bill.
const router = Router();

router.get('/', async (req, res) => {
  const where = {};
  if (['pending', 'confirmed', 'rejected'].includes(req.query.status)) where.status = req.query.status;
  if (req.query.q) {
    const pattern = contains(text(req.query.q, 60));
    where[Op.or] = [{ bookingNumber: pattern }, { orderNumber: pattern }, { guestName: pattern }, { reference: pattern }];
  }
  const limit = Math.min(Math.max(int(req.query.limit, 50), 1), 200);
  const [rows, counts] = await Promise.all([
    PaymentClaim.findAll({ where, order: [['createdAt', 'DESC']], limit }),
    PaymentClaim.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
  ]);
  const items = await populate(rows.map((row) => row.toJSON()), 'reviewedBy', User);
  res.json({ items, counts: Object.fromEntries(counts.map((row) => [row.status, Number(row.count)])) });
});

// Confirming adds the money to the booking or the food order. The claim is taken
// first, so pressing the button twice cannot add it twice.
router.post('/:id/confirm', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw notFound('Payment proof not found.');
  const [taken] = await PaymentClaim.update({ status: 'confirmed', reviewedBy: toId(req.user.id), reviewedAt: new Date() }, { where: { id, status: 'pending' } });
  if (!taken) throw badRequest('This proof was already reviewed.');
  const claim = await PaymentClaim.findByPk(id);

  try {
    if (claim.target === 'reservation') {
      await ReservationPayment.create({
        reservationId: claim.reservation,
        amount: claim.amount,
        method: claim.method,
        reference: claim.reference,
        note: `Confirmed from the guest's payment proof${claim.senderName ? ` (sender ${claim.senderName})` : ''}`,
        by: req.user._id,
      });
    } else {
      await recordPayment(claim.order, { amount: claim.amount, method: claim.method, reference: claim.reference, note: 'Confirmed from the guest\'s payment proof', requestId: `claim:${claim.id}` }, req.user._id);
    }
  } catch (error) {
    // The money could not be applied (for example the order is already paid): put the proof back.
    await PaymentClaim.update({ status: 'pending', reviewedBy: null, reviewedAt: null }, { where: { id: claim.id } });
    throw error;
  }
  paymentProofDecided(claim);
  res.json(claim);
});

router.post('/:id/reject', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw notFound('Payment proof not found.');
  // The reason is optional; the guest's email already says the payment was not received.
  const reason = text(req.body?.reason, 300);
  const [taken] = await PaymentClaim.update(
    { status: 'rejected', rejectReason: reason, reviewedBy: toId(req.user.id), reviewedAt: new Date(), dupKey: null },
    { where: { id, status: 'pending' } },
  );
  if (!taken) throw badRequest('This proof was already reviewed.');
  const claim = await PaymentClaim.findByPk(id);
  paymentProofDecided(claim);
  res.json(claim);
});

export default router;
