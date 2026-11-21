import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { cookieOptions } from '../middleware/auth.js';
import { toId } from '../models/_base.js';
import GuestOtp, { OTP_CHANNELS } from '../models/GuestOtp.js';
import Reservation from '../models/Reservation.js';
import Settings from '../models/Settings.js';
import { notify } from './mail.js';
import { normalizeWhatsAppPhone, sendWhatsAppMessage } from './whatsapp.js';
import { badRequest, HttpError, notFound, phoneKey, text } from '../utils/http.js';

export const GUEST_COOKIE = 'oasis_guest';
const GUEST_OTP_TTL_MS = 10 * 60 * 1000;
const GUEST_OTP_COOLDOWN_MS = 30 * 1000;
const GUEST_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const guestSecret = () => `${env.jwtSecret}:guest-otp`;

export const guestOtpOutbox = [];

function hashOtp(reservationId, code) {
  return crypto
    .createHmac('sha256', env.jwtSecret)
    .update(`guest-otp:${reservationId}:${String(code || '').trim()}`)
    .digest('hex');
}

function safeEqualHex(a, b) {
  const bufA = Buffer.from(String(a || ''), 'hex');
  const bufB = Buffer.from(String(b || ''), 'hex');
  return bufA.length > 0 && bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export function maskEmail(email) {
  const s = String(email || '').trim();
  const at = s.indexOf('@');
  if (at <= 1) return s ? '***@***' : '';
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
}

export function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `${'*'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
}

export async function lookupReservationByBookingAndPhone(body) {
  const bookingNumber = text(body?.bookingNumber, 20).toUpperCase().replace(/\s/g, '');
  const key = phoneKey(body?.phone);
  if (!bookingNumber || key.length < 10) {
    throw badRequest('Enter the booking number and the phone number on the reservation.');
  }
  const reservation = await Reservation.findOne({ where: { bookingNumber, guest_phoneKey: key } });
  if (!reservation) {
    throw notFound('We could not find a booking with that number and phone.');
  }
  return reservation;
}

export function signGuestToken(reservation) {
  return jwt.sign(
    {
      typ: 'guest_otp',
      rid: String(reservation.id),
      bn: reservation.bookingNumber,
    },
    guestSecret(),
    { expiresIn: '8h' },
  );
}

export function setGuestSessionCookie(req, res, reservation) {
  const token = signGuestToken(reservation);
  res.cookie(GUEST_COOKIE, token, cookieOptions(req, { path: '/api/public', maxAgeMs: GUEST_SESSION_TTL_MS }));
  return token;
}

export function clearGuestSessionCookie(req, res) {
  res.clearCookie(GUEST_COOKIE, cookieOptions(req, { path: '/api/public' }));
}

export async function getVerifiedGuestReservation(req, { expectedBookingNumber } = {}) {
  const cookieToken = req.cookies?.[GUEST_COOKIE] || '';
  const header = req.get('authorization') || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  const token = cookieToken || bearerToken;
  if (!token) return null;

  let payload;
  try {
    payload = jwt.verify(token, guestSecret());
  } catch {
    return null;
  }
  if (payload?.typ !== 'guest_otp') return null;

  const reservation = await Reservation.findByPk(toId(payload.rid));
  if (!reservation) return null;

  if (expectedBookingNumber) {
    const cleanExpected = text(expectedBookingNumber, 20).toUpperCase().replace(/\s/g, '');
    if (cleanExpected && reservation.bookingNumber !== cleanExpected) {
      return null;
    }
  }
  return reservation;
}

export async function requireGuestSession(req, { expectedBookingNumber } = {}) {
  const reservation = await getVerifiedGuestReservation(req, { expectedBookingNumber });
  if (!reservation) {
    throw new HttpError(401, 'Verify your booking with a one-time passcode (OTP) first.');
  }
  return reservation;
}

async function sendSmsOtp({ toPhone, message, bookingNumber }) {
  const normalized = normalizeWhatsAppPhone(toPhone);
  if (!normalized) throw badRequest('Guest phone number is not valid for SMS.');

  if (process.env.SMS_TRANSPORT === 'memory' || process.env.OTP_TRANSPORT === 'memory') {
    return { deliveryMode: 'memory' };
  }

  if (!env.sms.webhookUrl) {
    console.info(`[guest-otp sms dry-run] booking=${bookingNumber} to=${maskPhone(normalized)}`);
    return { deliveryMode: 'dry_run' };
  }

  const parsed = new URL(env.sms.webhookUrl);
  if (parsed.protocol !== 'https:' && env.production) {
    throw badRequest('SMS gateway URL must use HTTPS in production.');
  }

  const res = await fetch(parsed.toString(), {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: {
      'Content-Type': 'application/json',
      ...(env.sms.apiKey ? { Authorization: `Bearer ${env.sms.apiKey}` } : {}),
    },
    body: JSON.stringify({ to: `+${normalized}`, message, reference: bookingNumber }),
  });
  if (!res.ok) {
    throw new HttpError(502, 'Could not deliver SMS verification code.');
  }
  return { deliveryMode: 'live' };
}

export async function requestGuestOtp({ bookingNumber, phone, channel = 'whatsapp' }) {
  const reservation = await lookupReservationByBookingAndPhone({ bookingNumber, phone });
  const chosenChannel = OTP_CHANNELS.includes(String(channel || '').toLowerCase())
    ? String(channel).toLowerCase()
    : 'whatsapp';

  const latest = await GuestOtp.findOne({
    where: { reservationId: reservation.id },
    order: [['createdAt', 'DESC']],
  });
  if (latest && Date.now() - new Date(latest.createdAt).getTime() < GUEST_OTP_COOLDOWN_MS) {
    throw new HttpError(429, 'Please wait 30 seconds before requesting another verification code.');
  }

  // Invalidate prior active OTPs for this stay
  await GuestOtp.update(
    { consumedAt: new Date() },
    { where: { reservationId: reservation.id, consumedAt: null } },
  );

  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashOtp(reservation.id, code);
  const hotel = await Settings.current();

  let destinationMasked = '';
  let deliveryMode = 'dry_run';
  const otpText = `Your ${hotel.name} verification code for booking ${reservation.bookingNumber} is: ${code}. Valid for 10 minutes. Do not share this code.`;

  if (chosenChannel === 'email') {
    if (!reservation.guest?.email) throw badRequest('No email address is on file for this reservation.');
    destinationMasked = maskEmail(reservation.guest.email);
    const sent = await notify({
      to: reservation.guest.email,
      subject: `Verification code ${code} · ${reservation.bookingNumber}`,
      text: `Assalam-o-Alaikum ${reservation.guestName},\n\n${otpText}\n\n${hotel.name} · ${hotel.phone}`,
      html: `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px"><h2 style="margin:0 0 12px;color:#1a2744">${hotel.name}</h2><p>Assalam-o-Alaikum ${reservation.guestName},</p><p>Use this one-time verification code to access booking <strong>${reservation.bookingNumber}</strong>:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;font-family:monospace;background:#f3f4f6;padding:14px 18px;border-radius:8px;text-align:center">${code}</p><p style="color:#6b7280;font-size:13px">This code expires in 10 minutes.</p></div>`,
    });
    deliveryMode = sent ? 'live' : process.env.MAIL_TRANSPORT === 'memory' ? 'memory' : 'dry_run';
  } else if (chosenChannel === 'sms') {
    destinationMasked = maskPhone(reservation.guest?.phone);
    const smsRes = await sendSmsOtp({
      toPhone: reservation.guest?.phone,
      message: otpText,
      bookingNumber: reservation.bookingNumber,
    });
    deliveryMode = smsRes.deliveryMode;
  } else {
    destinationMasked = maskPhone(reservation.guest?.phone);
    const waRes = await sendWhatsAppMessage({
      toPhone: reservation.guest?.phone,
      recipientName: reservation.guestName,
      eventType: 'guest_update',
      reservationId: reservation.id,
      bookingNumber: reservation.bookingNumber,
      textBody: `*Verification Code · ${hotel.name}*\n${otpText}`,
      forceMode: 'text',
    });
    deliveryMode = waRes?.mode || 'dry_run';
  }

  await GuestOtp.create({
    reservationId: reservation.id,
    bookingNumber: reservation.bookingNumber,
    channel: chosenChannel,
    destinationMasked,
    codeHash,
    attempts: 0,
    expiresAt: new Date(Date.now() + GUEST_OTP_TTL_MS),
  });

  if (process.env.OTP_TRANSPORT === 'memory' || process.env.MAIL_TRANSPORT === 'memory') {
    guestOtpOutbox.push({
      reservationId: reservation.id,
      bookingNumber: reservation.bookingNumber,
      channel: chosenChannel,
      destinationMasked,
      code,
    });
  } else if (!env.production && deliveryMode === 'dry_run') {
    console.info(`[guest-otp preview] booking=${reservation.bookingNumber} channel=${chosenChannel} code=${code}`);
  }

  return {
    ok: true,
    channel: chosenChannel,
    destinationMasked,
    expiresInSeconds: Math.floor(GUEST_OTP_TTL_MS / 1000),
    deliveryMode,
  };
}

export async function verifyGuestOtp({ bookingNumber, phone, code }) {
  const reservation = await lookupReservationByBookingAndPhone({ bookingNumber, phone });
  const cleanCode = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) {
    throw badRequest('Enter the 6-digit verification code.');
  }

  const record = await GuestOtp.findOne({
    where: {
      reservationId: reservation.id,
      consumedAt: null,
      expiresAt: { [Op.gt]: new Date() },
    },
    order: [['createdAt', 'DESC']],
  });

  if (!record) {
    throw new HttpError(401, 'Verification code expired or not requested. Request a new code.');
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    record.consumedAt = new Date();
    await record.save();
    throw new HttpError(429, 'Too many incorrect attempts. Request a new verification code.');
  }

  const expectedHash = hashOtp(reservation.id, cleanCode);
  if (!safeEqualHex(record.codeHash, expectedHash)) {
    record.attempts += 1;
    await record.save();
    const remaining = Math.max(0, MAX_OTP_ATTEMPTS - record.attempts);
    throw new HttpError(
      401,
      remaining > 0
        ? `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
        : 'Too many incorrect attempts. Request a new verification code.',
    );
  }

  record.consumedAt = new Date();
  await record.save();
  return reservation;
}
