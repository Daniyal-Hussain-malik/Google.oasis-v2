import { Router } from 'express';
import { Op } from 'sequelize';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ACCESS } from '../../config/roles.js';
import { requireRole } from '../../middleware/auth.js';
import { loginLimit } from '../../middleware/limits.js';
import { upload } from '../../middleware/upload.js';
import { sendEnquiryReply } from '../../services/notifications.js';
import { deleteMediaObject, getStorageStatus, uploadImageObject } from '../../services/storage.js';
import { sequelize, toId } from '../../models/_base.js';
import Enquiry from '../../models/Enquiry.js';
import Feedback from '../../models/Feedback.js';
import Settings from '../../models/Settings.js';
import User from '../../models/User.js';
import { cleanIban, isValidIban } from '../../utils/iban.js';
import { badRequest, HttpError, int, isEmail, notFound, text } from '../../utils/http.js';

const router = Router();
const managers = requireRole(...ACCESS.superAdmin);

// Enquiries

router.get('/enquiries', async (req, res) => {
  const where = {};
  if (['new', 'replied', 'closed'].includes(req.query.status)) where.status = req.query.status;
  if (req.query.topic) where.topic = text(req.query.topic, 60);
  const limit = Math.min(Math.max(int(req.query.limit, 50), 1), 200);
  res.json(await Enquiry.findAll({ where, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit }));
});

// Changes the status (close, reopen). It never sends email: replying is its own action below.
router.patch('/enquiries/:id', async (req, res) => {
  const enquiry = await Enquiry.findByPk(toId(req.params.id));
  if (!enquiry) throw notFound('Enquiry not found.');
  enquiry.handledBy = req.user._id;
  if (['new', 'replied', 'closed'].includes(req.body?.status)) enquiry.status = req.body.status;
  await enquiry.save();
  res.json(enquiry);
});

// Emails a reply to the guest. The enquiry is marked replied only when the mail
// server accepts the message; a failed attempt keeps the text, records why, and
// can be retried. "Accepted" is not "in the inbox": the guest's mail provider
// and spam filters have the last word.
const SEND_LOCK_MS = 30 * 1000;
const attemptsPlusOne = () => sequelize.literal('`replyDelivery_attempts` + 1');

router.post('/enquiries/:id/reply', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw notFound('Enquiry not found.');
  const message = text(req.body?.message, 3000);
  if (message.length < 2) throw badRequest('Write a reply before sending.');

  const enquiry = await Enquiry.findByPk(id);
  if (!enquiry) throw notFound('Enquiry not found.');
  if (!isEmail(String(enquiry.email || ''))) {
    throw new HttpError(422, 'This enquiry has no valid email address, so a reply cannot be emailed. Contact the guest by phone instead.');
  }

  // The same reply, already accepted by the mail server, is not sent again.
  if (enquiry.replyDelivery?.status === 'sent' && enquiry.reply === message) {
    return res.json({ enquiry, delivery: { status: 'already_sent', to: enquiry.email, sentAt: enquiry.replyDelivery.sentAt } });
  }

  // Claim the send. A second request while one is running is turned away.
  const now = new Date();
  const [claimed] = await Enquiry.update(
    { replyDelivery_lockedAt: now },
    { where: { id, [Op.or]: [{ replyDelivery_lockedAt: null }, { replyDelivery_lockedAt: { [Op.lt]: new Date(now - SEND_LOCK_MS) } }] } },
  );
  if (!claimed) throw new HttpError(409, 'A reply to this enquiry is already being sent. Wait a moment.');

  let result;
  try {
    result = await sendEnquiryReply(enquiry, message);
  } catch (error) {
    await Enquiry.update({ replyDelivery_lockedAt: null }, { where: { id } });
    throw error;
  }

  const attempt = { replyDelivery_lastAttemptAt: now, handledBy: toId(req.user.id), reply: message, replyDelivery_attempts: attemptsPlusOne(), replyDelivery_lockedAt: null };
  if (result.ok) {
    await Enquiry.update(
      { ...attempt, status: 'replied', replyDelivery_status: 'sent', replyDelivery_sentAt: now, replyDelivery_sentTo: enquiry.email, replyDelivery_messageId: result.messageId || '', replyDelivery_failure: null },
      { where: { id } },
    );
    const saved = await Enquiry.findByPk(id);
    return res.json({ enquiry: saved, delivery: { status: 'accepted', to: enquiry.email, messageId: result.messageId, note: 'The mail server accepted the message. That does not guarantee it reached the inbox; ask the guest to check spam.' } });
  }

  // Not delivered: keep the text so it is not lost, but do not mark the enquiry replied.
  await Enquiry.update({ ...attempt, replyDelivery_status: 'failed', replyDelivery_failure: result.category }, { where: { id } });
  throw new HttpError(result.category === 'recipient' ? 422 : 502, result.userMessage, { category: result.category });
});

router.delete('/enquiries/:id', managers, async (req, res) => {
  if (!(await Enquiry.destroy({ where: { id: toId(req.params.id) } }))) throw notFound('Enquiry not found.');
  res.status(204).end();
});

// Guest feedback

router.get('/feedback', async (req, res) => {
  res.json(await Feedback.findAll({ order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: 200 }));
});

router.patch('/feedback/:id', managers, async (req, res) => {
  const feedback = await Feedback.findByPk(toId(req.params.id));
  if (!feedback) throw notFound('Feedback not found.');
  feedback.published = Boolean(req.body?.published);
  await feedback.save();
  res.json(feedback);
});

// The menu is managed with the restaurant (routes/admin/restaurant.js).

// Hotel settings and website copy

const settingFields = [
  'name', 'phone', 'phones', 'email', 'whatsapp', 'address', 'checkInTime', 'checkOutTime',
  'policies', 'childPolicy', 'currency', 'taxRate', 'restaurantTaxRate', 'restaurantServiceRate', 'maxAdvanceDays', 'maxNights', 'maxRoomsPerBooking',
  'heroTitle', 'heroLede', 'activities', 'facilities', 'experiences', 'payments',
];

// Content & settings sits behind the signed-in person's own password, the same
// one they log in with. Entering it returns a short-lived token that the page
// sends with every request; without it the API refuses, so the screen cannot
// be bypassed by calling the API directly.
const unlockSecret = `${env.jwtSecret}:settings`;
const UNLOCK_MINUTES = 30;

router.post('/settings/unlock', managers, loginLimit, async (req, res) => {
  const password = String(req.body?.password || '');
  if (!password) throw badRequest('Enter your password.');
  const user = await User.unscoped().findByPk(req.user.id);
  if (!user || !(await user.checkPassword(password))) throw new HttpError(403, 'That password is not correct.');
  const token = jwt.sign({ typ: 'settings', sub: String(user._id) }, unlockSecret, { expiresIn: `${UNLOCK_MINUTES}m` });
  res.json({ token, minutes: UNLOCK_MINUTES });
});

function requireUnlock(req, res, next) {
  const message = 'Enter your password to open Content & settings.';
  const token = req.get('x-settings-token') || req.get('x-settings-unlock') || '';
  try {
    const payload = jwt.verify(token, unlockSecret);
    if (payload.typ === 'settings' && payload.sub === String(req.user._id)) return next();
  } catch { /* missing, expired or tampered */ }
  throw new HttpError(403, message);
}

// Page addresses for experiences: lower-case words joined by dashes, unique in the list.
function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function cleanExperiences(list) {
  if (!Array.isArray(list)) throw badRequest('Experiences must be a list.');
  const used = new Set();
  return list.map((entry) => {
    const title = text(entry?.title, 100);
    if (!title) throw badRequest('Every experience needs a title.');
    const base = slugify(entry.slug) || slugify(title) || 'experience';
    let slug = base;
    for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;
    used.add(slug);
    return {
      ...(entry._id ? { _id: entry._id } : {}),
      slug,
      title,
      kicker: text(entry.kicker, 60),
      image: text(entry.image, 300),
      summary: text(entry.summary, 300),
      body: text(entry.body, 3000),
      active: entry.active !== false,
    };
  });
}

// The accounts guests send money to. A typo here sends money to a stranger, so the
// numbers are checked: an 11-digit mobile number, digits-only bank account, and an
// IBAN whose check digits add up.
function cleanPayments(input) {
  const raw = input || {};
  const easypaisa = raw.easypaisa || {};
  const bank = raw.bank || {};
  const out = {
    instructions: text(raw.instructions, 600),
    easypaisa: { enabled: easypaisa.enabled !== false, accountName: text(easypaisa.accountName, 80), number: String(easypaisa.number || '').replace(/[\s-]/g, '') },
    bank: {
      enabled: bank.enabled !== false,
      accountTitle: text(bank.accountTitle, 80),
      bankName: text(bank.bankName, 80),
      branchAddress: text(bank.branchAddress, 120),
      accountNumber: String(bank.accountNumber || '').replace(/[\s-]/g, ''),
      iban: cleanIban(bank.iban),
      swift: text(bank.swift, 20).toUpperCase(),
    },
  };
  if (out.easypaisa.enabled) {
    if (!out.easypaisa.accountName) throw badRequest('Enter the Easypaisa account holder name.');
    if (!/^03\d{9}$/.test(out.easypaisa.number)) throw badRequest('The Easypaisa number must be an 11-digit mobile number starting with 03, like 03001234567.');
  }
  if (out.bank.enabled) {
    if (!out.bank.accountTitle || !out.bank.bankName) throw badRequest('Enter the bank account title and the bank name.');
    if (!/^\d{8,20}$/.test(out.bank.accountNumber)) throw badRequest('The bank account number must be digits only (8 to 20).');
    if (out.bank.iban && !isValidIban(out.bank.iban)) throw badRequest('That IBAN is not valid. Check every character against the bank letter, because the check digits do not add up.');
  }
  return out;
}

router.get('/settings', managers, requireUnlock, async (req, res) => {
  res.json(await Settings.current());
});

router.put('/settings', managers, requireUnlock, async (req, res) => {
  const settings = await Settings.current();
  for (const field of settingFields) {
    if (req.body?.[field] === undefined) continue;
    settings[field] = field === 'experiences' ? cleanExperiences(req.body[field]) : field === 'payments' ? cleanPayments(req.body[field]) : req.body[field];
  }
  await settings.save();
  res.json(settings);
});

// Image uploads. Stored in Cloud Object Storage (AWS S3 / Cloudflare R2 / GCS) when configured.

router.get('/uploads/status', managers, (_req, res) => {
  res.json(getStorageStatus());
});

router.post('/uploads', managers, upload.single('image'), async (req, res) => {
  if (!req.file) throw badRequest('Attach an image in the "image" field.');
  const uploaded = await uploadImageObject({
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
    folder: 'media',
  });
  res.status(201).json(uploaded);
});

router.delete('/uploads/:name', managers, async (req, res) => {
  await deleteMediaObject(req.params.name);
  res.status(204).end();
});

export default router;
