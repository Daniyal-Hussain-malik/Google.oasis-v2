import { Base, D, bool, dt, enumCol, fk, int, text } from './_base.js';

export const ICAL_PROVIDERS = ['airbnb', 'booking_com', 'vrbo', 'ical'];
export const CHANNEL_PROVIDERS = ['disabled', 'channex', 'beds24', 'siteminder', 'custom_webhook'];

// Private outbound .ics feed token per physical room/hut.
export class OtaRoomFeed extends Base {}
OtaRoomFeed.setup(
  {
    room: fk('rooms', { required: true, onDelete: 'CASCADE', extra: { unique: true } }),
    exportToken: { ...text({ len: 64, required: true }), unique: true },
    lastExportedAt: dt(),
  },
  { table: 'ota_room_feeds' },
);

// Inbound .ics calendar URLs from Airbnb, Booking.com, Vrbo, etc. per room/hut.
export class OtaIcalSource extends Base {}
OtaIcalSource.setup(
  {
    room: fk('rooms', { required: true, onDelete: 'CASCADE' }),
    provider: enumCol(ICAL_PROVIDERS, 'airbnb'),
    label: text({ len: 120, required: true }),
    url: text({ len: 600, required: true }),
    enabled: bool(true),
    autoSync: bool(true),
    lastSyncAt: dt(),
    lastStatus: enumCol(['idle', 'ok', 'conflict', 'error'], 'idle'),
    lastMessage: text({ len: 500 }),
    eventsCount: int(0),
    blockedNightsCount: int(0),
  },
  { table: 'ota_ical_sources', indexes: [{ fields: ['room'] }, { fields: ['enabled'] }] },
);

// External date blocks parsed from inbound .ics feeds.
export class OtaCalendarBlock extends Base {}
OtaCalendarBlock.setup(
  {
    sourceId: fk('ota_ical_sources', { required: true, onDelete: 'CASCADE' }),
    room: fk('rooms', { required: true, onDelete: 'CASCADE' }),
    provider: enumCol(ICAL_PROVIDERS, 'airbnb'),
    externalUid: text({ len: 240, required: true }),
    summary: text({ len: 240 }),
    checkIn: { type: D.STRING(10), allowNull: false },
    checkOut: { type: D.STRING(10), allowNull: false },
    status: enumCol(['active', 'conflict', 'cancelled'], 'active'),
    conflictNote: text({ len: 400 }),
    rawDescription: text({ big: true }),
    lastSeenAt: dt(),
  },
  {
    table: 'ota_calendar_blocks',
    indexes: [
      { name: 'uniq_ota_block_source_uid', unique: true, fields: ['sourceId', 'externalUid'] },
      { fields: ['room'] },
      { fields: ['status'] },
    ],
  },
);

// Phase 2 Channel Manager configuration (Channex, Beds24, SiteMinder, custom webhook).
export class OtaChannelConfig extends Base {}
OtaChannelConfig.setup(
  {
    key: { ...text({ len: 40, required: true }), unique: true },
    provider: enumCol(CHANNEL_PROVIDERS, 'disabled'),
    enabled: bool(false),
    autoSyncOnBooking: bool(true),
    syncIntervalMinutes: int(15, { validate: { min: 1, max: 1440 } }),
    horizonDays: int(90, { validate: { min: 7, max: 365 } }),
    propertyId: text({ len: 120 }),
    apiBaseUrl: text({ len: 300 }),
    apiKey: text({ len: 400 }),
    webhookSecret: text({ len: 160 }),
    lastPushAt: dt(),
    lastPushStatus: enumCol(['idle', 'success', 'dry_run', 'error'], 'idle'),
    lastPushMessage: text({ len: 500 }),
  },
  {
    table: 'ota_channel_configs',
    hide: ['apiKey', 'webhookSecret'],
  },
);

// RoomType <-> External OTA Room Type & Rate Plan mapping with OTA markup/restrictions.
export class OtaRoomMapping extends Base {}
OtaRoomMapping.setup(
  {
    roomType: fk('room_types', { required: true, onDelete: 'CASCADE', extra: { unique: true } }),
    externalRoomTypeId: text({ len: 120 }),
    externalRatePlanId: text({ len: 120 }),
    rateMarkupPct: { type: D.DOUBLE, allowNull: false, defaultValue: 0, validate: { min: -50, max: 200 } },
    minStay: int(1, { validate: { min: 1, max: 30 } }),
    maxStay: int(30, { validate: { min: 1, max: 90 } }),
    stopSell: bool(false),
    enabled: bool(true),
  },
  { table: 'ota_room_mappings' },
);

// Idempotency ledger for bookings arriving via Channel Manager webhooks.
export class OtaChannelReservation extends Base {}
OtaChannelReservation.setup(
  {
    provider: text({ len: 40, required: true }),
    externalId: text({ len: 120, required: true }),
    channelName: text({ len: 60 }),
    reservationId: fk('reservations', { required: false, onDelete: 'SET NULL' }),
    status: enumCol(['confirmed', 'modified', 'cancelled'], 'confirmed'),
    guestName: text({ len: 120 }),
    checkIn: { type: D.STRING(10), allowNull: false },
    checkOut: { type: D.STRING(10), allowNull: false },
    rawPayload: text({ big: true }),
  },
  {
    table: 'ota_channel_reservations',
    indexes: [
      { name: 'uniq_ota_resv_provider_ext', unique: true, fields: ['provider', 'externalId'] },
      { fields: ['reservationId'] },
    ],
  },
);

// Audit log for iCal exports/imports, ARI pushes, and OTA webhook deliveries.
export class OtaSyncLog extends Base {}
OtaSyncLog.setup(
  {
    kind: enumCol(['ical_import', 'ical_export', 'ari_push', 'ota_webhook'], 'ical_import'),
    provider: text({ len: 40, required: true }),
    direction: enumCol(['inbound', 'outbound'], 'inbound'),
    status: enumCol(['success', 'dry_run', 'conflict', 'error'], 'success'),
    summary: text({ len: 400, required: true }),
    details: text({ big: true }),
    itemsProcessed: int(0),
  },
  { table: 'ota_sync_logs', indexes: [{ fields: ['kind'] }, { fields: ['createdAt'] }] },
);
