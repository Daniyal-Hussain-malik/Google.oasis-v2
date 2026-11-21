import { Base, bool, dt, enumCol, fk, text } from './_base.js';

export const WHATSAPP_EVENTS = [
  'booking_confirmed',
  'booking_cancelled',
  'guest_checked_in',
  'guest_checked_out',
  'payment_confirmed',
  'payment_declined',
  'guest_update',
  'test',
  'inbound_reply',
];

export const WHATSAPP_STATUSES = ['queued', 'dry_run', 'sent', 'delivered', 'read', 'failed', 'received'];

export const DEFAULT_WHATSAPP_TEMPLATES = {
  booking_confirmed: 'oasis_booking_confirmation',
  booking_cancelled: 'oasis_booking_cancelled',
  guest_checked_in: 'oasis_checkin_welcome',
  guest_checked_out: 'oasis_checkout_thankyou',
  payment_confirmed: 'oasis_payment_confirmed',
  payment_declined: 'oasis_payment_declined',
  guest_update: 'oasis_guest_update',
};

// Singleton WhatsApp Business Cloud API configuration (key = 'default').
export class WhatsAppConfig extends Base {}
WhatsAppConfig.setup(
  {
    key: { ...text({ len: 40, required: true }), unique: true },
    enabled: bool(false),
    graphApiVersion: text({ len: 20, def: 'v21.0' }),
    phoneNumberId: text({ len: 80 }),
    businessAccountId: text({ len: 80 }),
    accessToken: text({ len: 500 }),
    appSecret: text({ len: 160 }),
    verifyToken: text({ len: 120 }),
    defaultCountryCode: text({ len: 10, def: '92' }),
    templateLanguage: text({ len: 20, def: 'en' }),
    useApprovedTemplates: bool(false),
    sendBookingConfirmation: bool(true),
    sendBookingCancellation: bool(true),
    sendCheckInWelcome: bool(true),
    sendCheckOutThanks: bool(true),
    sendPaymentUpdates: bool(true),
    templatesJson: text({ big: true }),
    lastTestedAt: dt(),
  },
  {
    table: 'whatsapp_configs',
    hide: ['accessToken', 'appSecret'],
  },
);

// Audit & delivery status log for outbound notifications and inbound guest replies.
export class WhatsAppMessageLog extends Base {}
WhatsAppMessageLog.setup(
  {
    direction: enumCol(['outbound', 'inbound'], 'outbound'),
    eventType: enumCol(WHATSAPP_EVENTS, 'booking_confirmed'),
    reservationId: fk('reservations', { required: false, onDelete: 'SET NULL' }),
    bookingNumber: text({ len: 20 }),
    recipientPhone: text({ len: 30, required: true }),
    recipientName: text({ len: 120 }),
    messageMode: enumCol(['template', 'text'], 'text'),
    templateName: text({ len: 120 }),
    bodyPreview: text({ big: true }),
    metaMessageId: text({ len: 160 }),
    status: enumCol(WHATSAPP_STATUSES, 'queued'),
    errorMessage: text({ len: 500 }),
    deliveredAt: dt(),
    readAt: dt(),
  },
  {
    table: 'whatsapp_message_logs',
    indexes: [
      { fields: ['reservationId'] },
      { fields: ['metaMessageId'] },
      { fields: ['status'] },
      { fields: ['createdAt'] },
    ],
  },
);
