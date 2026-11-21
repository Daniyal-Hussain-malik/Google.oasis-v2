import crypto from 'node:crypto';
import { toId } from '../models/_base.js';
import Reservation from '../models/Reservation.js';
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  WHATSAPP_EVENTS,
  WhatsAppConfig,
  WhatsAppMessageLog,
} from '../models/WhatsApp.js';
import { badRequest, HttpError, text } from '../utils/http.js';

export const whatsappOutbox = [];

function maskSecret(val) {
  const s = String(val || '');
  if (!s) return '';
  if (s.length <= 6) return '••••••';
  return `${s.slice(0, 4)}••••••${s.slice(-4)}`;
}

function pkrFormat(amount) {
  return `PKR ${Math.round(Number(amount) || 0).toLocaleString('en-PK')}`;
}

function parseTemplates(rawJson) {
  try {
    const parsed = rawJson ? JSON.parse(rawJson) : {};
    return { ...DEFAULT_WHATSAPP_TEMPLATES, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULT_WHATSAPP_TEMPLATES };
  }
}

export function normalizeWhatsAppPhone(rawPhone, defaultCountryCode = '92') {
  let digits = String(rawPhone || '').replace(/[^\d+]/g, '');
  if (!digits) return null;

  const cc = String(defaultCountryCode || '92').replace(/\D/g, '') || '92';
  if (digits.startsWith('+')) {
    digits = digits.slice(1).replace(/\D/g, '');
  } else {
    digits = digits.replace(/\D/g, '');
    if (digits.startsWith('00')) {
      digits = digits.slice(2);
    } else if (digits.startsWith('0')) {
      digits = `${cc}${digits.slice(1)}`;
    } else if (cc === '92' && digits.length === 10 && digits.startsWith('3')) {
      digits = `92${digits}`;
    } else if (!digits.startsWith(cc) && digits.length <= 10) {
      digits = `${cc}${digits}`;
    }
  }

  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

async function ensureConfigRow() {
  const existing = await WhatsAppConfig.findOne({ where: { key: 'default' } });
  if (existing) return existing;
  return WhatsAppConfig.create({
    key: 'default',
    enabled: false,
    graphApiVersion: 'v21.0',
    defaultCountryCode: '92',
    templateLanguage: 'en',
    useApprovedTemplates: false,
    sendBookingConfirmation: true,
    sendBookingCancellation: true,
    sendCheckInWelcome: true,
    sendCheckOutThanks: true,
    sendPaymentUpdates: true,
    verifyToken: crypto.randomBytes(18).toString('hex'),
    templatesJson: JSON.stringify(DEFAULT_WHATSAPP_TEMPLATES),
  });
}

export async function getWhatsAppConfig({ includeSecrets = false } = {}) {
  const row = await ensureConfigRow();
  const base = row.toJSON();

  const effectiveToken = process.env.WHATSAPP_ACCESS_TOKEN || row.accessToken || '';
  const effectiveAppSecret = process.env.WHATSAPP_APP_SECRET || row.appSecret || '';
  const effectivePhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || row.phoneNumberId || '';
  const effectiveVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || row.verifyToken || '';

  const out = {
    ...base,
    phoneNumberId: effectivePhoneId,
    verifyToken: effectiveVerifyToken,
    templates: parseTemplates(row.templatesJson),
    hasAccessToken: Boolean(effectiveToken),
    accessTokenMasked: maskSecret(effectiveToken),
    hasAppSecret: Boolean(effectiveAppSecret),
    appSecretMasked: maskSecret(effectiveAppSecret),
    envManagedToken: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
    envManagedSecret: Boolean(process.env.WHATSAPP_APP_SECRET),
    liveReady: Boolean(row.enabled && effectivePhoneId && effectiveToken),
  };
  delete out.templatesJson;

  if (includeSecrets) {
    out.accessToken = effectiveToken;
    out.appSecret = effectiveAppSecret;
  }
  return out;
}

export async function updateWhatsAppConfig(body = {}) {
  const row = await ensureConfigRow();
  if (body.enabled !== undefined) row.enabled = Boolean(body.enabled);
  if (body.graphApiVersion !== undefined) {
    const v = String(body.graphApiVersion || '').trim();
    if (!/^v\d+\.\d+$/.test(v)) throw badRequest('Graph API version must look like v21.0.');
    row.graphApiVersion = v;
  }
  if (body.phoneNumberId !== undefined) row.phoneNumberId = text(body.phoneNumberId, 80);
  if (body.businessAccountId !== undefined) row.businessAccountId = text(body.businessAccountId, 80);
  if (body.defaultCountryCode !== undefined) {
    const cc = String(body.defaultCountryCode || '').replace(/\D/g, '').slice(0, 6);
    if (!cc) throw badRequest('Enter a valid numeric country code (e.g. 92).');
    row.defaultCountryCode = cc;
  }
  if (body.templateLanguage !== undefined) {
    row.templateLanguage = text(body.templateLanguage, 20) || 'en';
  }
  if (body.useApprovedTemplates !== undefined) row.useApprovedTemplates = Boolean(body.useApprovedTemplates);
  if (body.sendBookingConfirmation !== undefined) row.sendBookingConfirmation = Boolean(body.sendBookingConfirmation);
  if (body.sendBookingCancellation !== undefined) row.sendBookingCancellation = Boolean(body.sendBookingCancellation);
  if (body.sendCheckInWelcome !== undefined) row.sendCheckInWelcome = Boolean(body.sendCheckInWelcome);
  if (body.sendCheckOutThanks !== undefined) row.sendCheckOutThanks = Boolean(body.sendCheckOutThanks);
  if (body.sendPaymentUpdates !== undefined) row.sendPaymentUpdates = Boolean(body.sendPaymentUpdates);

  if (body.accessToken !== undefined && String(body.accessToken).trim() && !String(body.accessToken).includes('••••')) {
    row.accessToken = String(body.accessToken).trim().slice(0, 500);
  }
  if (body.appSecret !== undefined && String(body.appSecret).trim() && !String(body.appSecret).includes('••••')) {
    row.appSecret = String(body.appSecret).trim().slice(0, 160);
  }
  if (body.rotateVerifyToken) {
    row.verifyToken = crypto.randomBytes(18).toString('hex');
  } else if (body.verifyToken !== undefined && String(body.verifyToken).trim()) {
    row.verifyToken = text(body.verifyToken, 120);
  }

  if (body.templates && typeof body.templates === 'object') {
    const current = parseTemplates(row.templatesJson);
    const merged = { ...current };
    for (const key of Object.keys(DEFAULT_WHATSAPP_TEMPLATES)) {
      if (body.templates[key] !== undefined) {
        const clean = String(body.templates[key] || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
        if (clean) merged[key] = clean;
      }
    }
    row.templatesJson = JSON.stringify(merged);
  }

  await row.save();
  return getWhatsAppConfig();
}

export async function sendWhatsAppMessage({
  toPhone,
  recipientName = '',
  eventType = 'guest_update',
  reservationId = null,
  bookingNumber = '',
  textBody,
  templateName = '',
  templateParams = [],
  forceMode,
}) {
  const cfg = await getWhatsAppConfig({ includeSecrets: true });
  const normalizedPhone = normalizeWhatsAppPhone(toPhone, cfg.defaultCountryCode);
  if (!normalizedPhone) {
    throw badRequest('Recipient phone number is not a valid WhatsApp number.');
  }

  const safeEvent = WHATSAPP_EVENTS.includes(eventType) ? eventType : 'guest_update';
  const useTemplate = forceMode
    ? forceMode === 'template'
    : Boolean(cfg.useApprovedTemplates && templateName);
  const resolvedTemplate = templateName || cfg.templates?.[safeEvent] || DEFAULT_WHATSAPP_TEMPLATES[safeEvent] || 'oasis_guest_update';

  const payload = useTemplate
    ? {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedPhone,
        type: 'template',
        template: {
          name: resolvedTemplate,
          language: { code: cfg.templateLanguage || 'en' },
          ...(templateParams.length
            ? {
                components: [
                  {
                    type: 'body',
                    parameters: templateParams.map((p) => ({
                      type: 'text',
                      text: String(p ?? '').slice(0, 1000),
                    })),
                  },
                ],
              }
            : {}),
        },
      }
    : {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedPhone,
        type: 'text',
        text: {
          preview_url: true,
          body: String(textBody || '').slice(0, 4096),
        },
      };

  const log = await WhatsAppMessageLog.create({
    direction: 'outbound',
    eventType: safeEvent,
    reservationId: toId(reservationId) || null,
    bookingNumber: text(bookingNumber, 20),
    recipientPhone: normalizedPhone,
    recipientName: text(recipientName, 120),
    messageMode: useTemplate ? 'template' : 'text',
    templateName: useTemplate ? resolvedTemplate : '',
    bodyPreview: String(textBody || templateParams.join(' · ')).slice(0, 2000),
    status: 'queued',
  });

  if (process.env.WHATSAPP_TRANSPORT === 'memory') {
    const fakeId = `wamid.mem_${crypto.randomBytes(8).toString('hex')}`;
    whatsappOutbox.push({ logId: log._id, payload, textBody });
    log.metaMessageId = fakeId;
    log.status = 'sent';
    await log.save();
    return { ok: true, mode: 'memory', status: 'sent', metaMessageId: fakeId, log: log.toJSON() };
  }

  if (!cfg.liveReady) {
    log.status = 'dry_run';
    log.errorMessage = 'Live Meta credentials inactive — message recorded in dry-run audit log.';
    await log.save();
    return { ok: true, mode: 'dry_run', status: 'dry_run', log: log.toJSON(), payload };
  }

  const endpoint = `https://graph.facebook.com/${cfg.graphApiVersion || 'v21.0'}/${encodeURIComponent(cfg.phoneNumberId)}/messages`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const metaErr = data?.error?.message || `Meta Graph API HTTP ${res.status}`;
      log.status = 'failed';
      log.errorMessage = String(metaErr).slice(0, 500);
      await log.save();
      return { ok: false, mode: 'live', status: 'failed', error: log.errorMessage, log: log.toJSON() };
    }

    const metaMessageId = String(data?.messages?.[0]?.id || '');
    log.metaMessageId = metaMessageId.slice(0, 160);
    log.status = 'sent';
    log.errorMessage = '';
    await log.save();

    return { ok: true, mode: 'live', status: 'sent', metaMessageId, log: log.toJSON() };
  } catch (err) {
    log.status = 'failed';
    log.errorMessage = String(err?.message || 'Network error reaching WhatsApp Cloud API').slice(0, 500);
    await log.save();
    return { ok: false, mode: 'live', status: 'failed', error: log.errorMessage, log: log.toJSON() };
  }
}

function roomsSummary(reservation) {
  const rooms = reservation?.rooms || [];
  if (!rooms.length) return 'Assigned Hut';
  return rooms.map((r) => (r.roomNo ? `${r.type || 'Hut'} (#${r.roomNo})` : r.type || 'Hut')).join(', ');
}

export async function sendBookingConfirmationWhatsApp(reservation, hotel) {
  const cfg = await getWhatsAppConfig();
  if (!cfg.sendBookingConfirmation) return null;

  const phone = reservation?.guest?.phone;
  if (!phone) return null;

  const roomLabel = roomsSummary(reservation);
  const hotelName = hotel?.name || 'Oasis Resort Skardu';
  const checkInTime = hotel?.checkInTime || '14:00';
  const total = pkrFormat(reservation.totalAmount);
  const balance = pkrFormat(reservation.balance ?? reservation.totalAmount);

  const textBody = [
    `*Booking Confirmed · ${hotelName}*`,
    `Assalam-o-Alaikum ${reservation.guestName || 'Guest'},`,
    `Your stay at Katpana Cold Desert is confirmed.`,
    ``,
    `• *Booking Ref:* ${reservation.bookingNumber}`,
    `• *Accommodation:* ${roomLabel}`,
    `• *Check-in:* ${reservation.checkIn} (from ${checkInTime})`,
    `• *Check-out:* ${reservation.checkOut} (${reservation.nights} night${reservation.nights > 1 ? 's' : ''})`,
    `• *Total:* ${total} | *Balance Due:* ${balance}`,
    ``,
    `Need airport pickup or early heater prep? Reply directly to this WhatsApp message.`,
  ].join('\n');

  return sendWhatsAppMessage({
    toPhone: phone,
    recipientName: reservation.guestName,
    eventType: 'booking_confirmed',
    reservationId: reservation.id || reservation._id,
    bookingNumber: reservation.bookingNumber,
    textBody,
    templateName: cfg.templates?.booking_confirmed,
    templateParams: [
      reservation.guestName || 'Guest',
      reservation.bookingNumber,
      roomLabel,
      reservation.checkIn,
      reservation.checkOut,
      total,
    ],
  });
}

export async function sendBookingCancellationWhatsApp(reservation, hotel) {
  const cfg = await getWhatsAppConfig();
  if (!cfg.sendBookingCancellation) return null;

  const phone = reservation?.guest?.phone;
  if (!phone) return null;

  const hotelName = hotel?.name || 'Oasis Resort Skardu';
  const textBody = [
    `*Reservation Cancelled · ${hotelName}*`,
    `Dear ${reservation.guestName || 'Guest'},`,
    `Booking *${reservation.bookingNumber}* (${reservation.checkIn} to ${reservation.checkOut}) has been marked cancelled.`,
    `If this was unintentional or you wish to re-book new dates in Skardu, please reply here or call ${hotel?.phone || ''}.`,
  ].join('\n');

  return sendWhatsAppMessage({
    toPhone: phone,
    recipientName: reservation.guestName,
    eventType: 'booking_cancelled',
    reservationId: reservation.id || reservation._id,
    bookingNumber: reservation.bookingNumber,
    textBody,
    templateName: cfg.templates?.booking_cancelled,
    templateParams: [reservation.guestName || 'Guest', reservation.bookingNumber, reservation.checkIn, reservation.checkOut],
  });
}

export async function sendCheckInWelcomeWhatsApp(reservation, hotel) {
  const cfg = await getWhatsAppConfig();
  if (!cfg.sendCheckInWelcome) return null;

  const phone = reservation?.guest?.phone;
  if (!phone) return null;

  const roomLabel = roomsSummary(reservation);
  const hotelName = hotel?.name || 'Oasis Resort Skardu';
  const textBody = [
    `*Welcome to ${hotelName}!*`,
    `Dear ${reservation.guestName || 'Guest'}, you are checked in to *${roomLabel}* (Ref: ${reservation.bookingNumber}).`,
    `• Check-out is at ${hotel?.checkOutTime || '12:00'} on ${reservation.checkOut}.`,
    `• Complementary Kashmiri chai & breakfast are served daily.`,
    `Message us anytime for room dining, bonfire setup, or jeep excursions.`,
  ].join('\n');

  return sendWhatsAppMessage({
    toPhone: phone,
    recipientName: reservation.guestName,
    eventType: 'guest_checked_in',
    reservationId: reservation.id || reservation._id,
    bookingNumber: reservation.bookingNumber,
    textBody,
    templateName: cfg.templates?.guest_checked_in,
    templateParams: [reservation.guestName || 'Guest', roomLabel, reservation.bookingNumber, reservation.checkOut],
  });
}

export async function sendCheckOutThankYouWhatsApp(reservation, hotel, invoiceNumber) {
  const cfg = await getWhatsAppConfig();
  if (!cfg.sendCheckOutThanks) return null;

  const phone = reservation?.guest?.phone;
  if (!phone) return null;

  const hotelName = hotel?.name || 'Oasis Resort Skardu';
  const textBody = [
    `*Thank You for Staying at ${hotelName}*`,
    `Dear ${reservation.guestName || 'Guest'}, safe travels from Skardu!`,
    `• Booking: ${reservation.bookingNumber}${invoiceNumber ? ` | Invoice: ${invoiceNumber}` : ''}`,
    `• Final Balance: ${pkrFormat(reservation.balance || 0)}`,
    `We hope to welcome you back to the Katpana dunes soon.`,
  ].join('\n');

  return sendWhatsAppMessage({
    toPhone: phone,
    recipientName: reservation.guestName,
    eventType: 'guest_checked_out',
    reservationId: reservation.id || reservation._id,
    bookingNumber: reservation.bookingNumber,
    textBody,
    templateName: cfg.templates?.guest_checked_out,
    templateParams: [reservation.guestName || 'Guest', reservation.bookingNumber, invoiceNumber || '-'],
  });
}

export async function sendPaymentDecisionWhatsApp(claim, guest, hotel) {
  const cfg = await getWhatsAppConfig();
  if (!cfg.sendPaymentUpdates) return null;

  const phone = guest?.phone;
  if (!phone) return null;

  const confirmed = claim.status === 'confirmed';
  const eventType = confirmed ? 'payment_confirmed' : 'payment_declined';
  const hotelName = hotel?.name || 'Oasis Resort Skardu';

  const textBody = confirmed
    ? [
        `*Payment Verified · ${hotelName}*`,
        `Dear ${guest.name || 'Guest'}, we verified your ${claim.method?.replaceAll('_', ' ') || 'transfer'} of *${pkrFormat(claim.amount)}* (TID: ${claim.reference}).`,
        `Your folio has been updated accordingly.`,
      ].join('\n')
    : [
        `*Payment Proof Update · ${hotelName}*`,
        `Dear ${guest.name || 'Guest'}, we could not verify TID *${claim.reference}* (${pkrFormat(claim.amount)}).`,
        claim.rejectReason ? `Note: ${claim.rejectReason}` : `Please double-check the transaction ID or message our desk here.`,
      ].join('\n');

  return sendWhatsAppMessage({
    toPhone: phone,
    recipientName: guest.name,
    eventType,
    reservationId: claim.reservation || null,
    bookingNumber: guest.bookingNumber || '',
    textBody,
    templateName: cfg.templates?.[eventType],
    templateParams: [guest.name || 'Guest', pkrFormat(claim.amount), claim.reference],
  });
}

export async function sendGuestUpdateWhatsApp({ reservationId, bookingNumber, phone, recipientName, message }) {
  const cleanMsg = text(message, 2000);
  if (!cleanMsg) throw badRequest('Enter a message to send.');

  let targetRes = null;
  if (reservationId) {
    targetRes = await Reservation.findByPk(toId(reservationId));
  } else if (bookingNumber) {
    targetRes = await Reservation.findOne({ where: { bookingNumber: String(bookingNumber).trim().toUpperCase() } });
  }

  const targetPhone = phone || targetRes?.guest?.phone;
  if (!targetPhone) throw badRequest('Provide a guest phone number or a valid reservation.');

  return sendWhatsAppMessage({
    toPhone: targetPhone,
    recipientName: recipientName || targetRes?.guestName || 'Guest',
    eventType: 'guest_update',
    reservationId: targetRes?.id || null,
    bookingNumber: targetRes?.bookingNumber || bookingNumber || '',
    textBody: cleanMsg,
    forceMode: 'text',
  });
}

function safeCompare(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  return bufA.length > 0 && bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export async function verifyWhatsAppWebhookChallenge(query = {}) {
  const mode = String(query['hub.mode'] || '');
  const token = String(query['hub.verify_token'] || '');
  const challenge = String(query['hub.challenge'] || '');

  const cfg = await getWhatsAppConfig({ includeSecrets: true });
  if (mode === 'subscribe' && cfg.verifyToken && safeCompare(cfg.verifyToken, token)) {
    return challenge;
  }
  throw new HttpError(403, 'Webhook verification failed.');
}

function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) return;
  const sig = String(signatureHeader || '');
  const cleanHex = sig.replace(/^sha256=/i, '');
  if (!cleanHex || !rawBody) {
    throw new HttpError(401, 'Missing Meta webhook signature.');
  }
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  if (!safeCompare(expected, cleanHex)) {
    throw new HttpError(401, 'Invalid Meta webhook signature.');
  }
}

export async function processWhatsAppWebhook({ body, rawBody, signature }) {
  const cfg = await getWhatsAppConfig({ includeSecrets: true });
  verifyMetaSignature(rawBody || JSON.stringify(body || {}), signature, cfg.appSecret);

  const entries = Array.isArray(body?.entry) ? body.entry : [];
  let statusUpdates = 0;
  let inboundMessages = 0;

  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};

      for (const st of value.statuses || []) {
        const wamid = String(st?.id || '');
        const nextStatus = String(st?.status || '').toLowerCase();
        if (!wamid || !['sent', 'delivered', 'read', 'failed'].includes(nextStatus)) continue;

        const row = await WhatsAppMessageLog.findOne({ where: { metaMessageId: wamid } });
        if (!row) continue;

        row.status = nextStatus;
        if (nextStatus === 'delivered') row.deliveredAt = new Date();
        if (nextStatus === 'read') {
          row.readAt = new Date();
          if (!row.deliveredAt) row.deliveredAt = row.readAt;
        }
        if (nextStatus === 'failed') {
          const errDetail = st?.errors?.[0]?.message || st?.errors?.[0]?.title || 'Delivery failed';
          row.errorMessage = String(errDetail).slice(0, 500);
        }
        await row.save();
        statusUpdates += 1;
      }

      const contacts = value.contacts || [];
      for (const msg of value.messages || []) {
        const from = String(msg?.from || '');
        if (!from) continue;
        const contactName = contacts.find((c) => c.wa_id === from)?.profile?.name || '';
        const textContent = msg?.text?.body || `[${msg?.type || 'message'}]`;

        const lastTen = from.replace(/\D/g, '').slice(-10);
        const matchingRes = lastTen.length >= 10
          ? await Reservation.findOne({ where: { guest_phoneKey: lastTen }, order: [['createdAt', 'DESC']] })
          : null;

        await WhatsAppMessageLog.create({
          direction: 'inbound',
          eventType: 'inbound_reply',
          reservationId: matchingRes?.id || null,
          bookingNumber: matchingRes?.bookingNumber || '',
          recipientPhone: from.slice(0, 30),
          recipientName: text(contactName || matchingRes?.guestName || 'Guest', 120),
          messageMode: 'text',
          bodyPreview: String(textContent).slice(0, 2000),
          metaMessageId: String(msg?.id || '').slice(0, 160),
          status: 'received',
        });
        inboundMessages += 1;
      }
    }
  }

  return { ok: true, statusUpdates, inboundMessages };
}
