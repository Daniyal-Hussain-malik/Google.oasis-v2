import crypto from 'node:crypto';
import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { toId } from '../models/_base.js';
import {
  CHANNEL_PROVIDERS,
  OtaChannelConfig,
  OtaChannelReservation,
  OtaRoomMapping,
  OtaSyncLog,
} from '../models/OtaSync.js';
import Reservation from '../models/Reservation.js';
import Room from '../models/Room.js';
import RoomNight from '../models/RoomNight.js';
import RoomType from '../models/RoomType.js';
import Settings from '../models/Settings.js';
import { addDays, isIsoDate, stayNights, todayIn } from '../utils/dates.js';
import { badRequest, HttpError, int, phoneKey, text } from '../utils/http.js';
import { validateExternalIcalUrl } from './ical.js';
import { nightlyRate } from './pricing.js';

export const PROVIDER_DEFAULTS = {
  disabled: { label: 'Disabled', apiBaseUrl: '' },
  channex: { label: 'Channex.io', apiBaseUrl: 'https://app.channex.io/api/v1' },
  beds24: { label: 'Beds24', apiBaseUrl: 'https://beds24.com/api/v2' },
  siteminder: { label: 'SiteMinder', apiBaseUrl: 'https://connect.siteminder.com/pms/v1' },
  custom_webhook: { label: 'Custom Channel Bridge', apiBaseUrl: '' },
};

function maskSecret(val) {
  const s = String(val || '');
  if (!s) return '';
  if (s.length <= 6) return '••••••';
  return `${s.slice(0, 3)}••••••${s.slice(-3)}`;
}

async function ensureConfigRow() {
  const existing = await OtaChannelConfig.findOne({ where: { key: 'default' } });
  if (existing) return existing;
  return OtaChannelConfig.create({
    key: 'default',
    provider: 'disabled',
    enabled: false,
    autoSyncOnBooking: true,
    syncIntervalMinutes: 15,
    horizonDays: 90,
    webhookSecret: crypto.randomBytes(20).toString('hex'),
  });
}

export async function getChannelConfig({ includeSecrets = false } = {}) {
  const row = await ensureConfigRow();
  const base = row.toJSON();
  const effectiveApiKey = process.env.CHANNEL_MANAGER_API_KEY || row.apiKey || '';
  const effectiveWebhookSecret = process.env.CHANNEL_MANAGER_WEBHOOK_SECRET || row.webhookSecret || '';

  const out = {
    ...base,
    providerLabel: PROVIDER_DEFAULTS[row.provider]?.label || row.provider,
    defaultApiBaseUrl: PROVIDER_DEFAULTS[row.provider]?.apiBaseUrl || '',
    hasApiKey: Boolean(effectiveApiKey),
    apiKeyMasked: maskSecret(effectiveApiKey),
    hasWebhookSecret: Boolean(effectiveWebhookSecret),
    webhookSecretMasked: maskSecret(effectiveWebhookSecret),
    envManagedKey: Boolean(process.env.CHANNEL_MANAGER_API_KEY),
  };
  if (includeSecrets) {
    out.apiKey = effectiveApiKey;
    out.webhookSecret = effectiveWebhookSecret;
  }
  return out;
}

export async function updateChannelConfig(body = {}) {
  const row = await ensureConfigRow();
  if (body.provider !== undefined) {
    if (!CHANNEL_PROVIDERS.includes(body.provider)) {
      throw badRequest(`Unsupported channel manager provider. Choose: ${CHANNEL_PROVIDERS.join(', ')}.`);
    }
    row.provider = body.provider;
  }
  if (body.enabled !== undefined) row.enabled = Boolean(body.enabled);
  if (body.autoSyncOnBooking !== undefined) row.autoSyncOnBooking = Boolean(body.autoSyncOnBooking);
  if (body.syncIntervalMinutes !== undefined) {
    row.syncIntervalMinutes = Math.min(Math.max(int(body.syncIntervalMinutes, 15), 1), 1440);
  }
  if (body.horizonDays !== undefined) {
    row.horizonDays = Math.min(Math.max(int(body.horizonDays, 90), 7), 365);
  }
  if (body.propertyId !== undefined) row.propertyId = text(body.propertyId, 120);
  if (body.apiBaseUrl !== undefined) {
    const cleanUrl = String(body.apiBaseUrl || '').trim();
    if (cleanUrl) {
      await validateExternalIcalUrl(cleanUrl);
      row.apiBaseUrl = cleanUrl.replace(/\/$/, '').slice(0, 300);
    } else {
      row.apiBaseUrl = '';
    }
  }
  if (body.apiKey !== undefined && String(body.apiKey).trim() !== '' && !String(body.apiKey).includes('••••')) {
    row.apiKey = String(body.apiKey).trim().slice(0, 400);
  }
  if (body.rotateWebhookSecret) {
    row.webhookSecret = crypto.randomBytes(20).toString('hex');
  } else if (body.webhookSecret !== undefined && String(body.webhookSecret).trim() !== '' && !String(body.webhookSecret).includes('••••')) {
    row.webhookSecret = String(body.webhookSecret).trim().slice(0, 160);
  }

  await row.save();
  return getChannelConfig();
}

export async function listRoomMappings() {
  const [types, mappings, roomCounts] = await Promise.all([
    RoomType.findAll({ order: [['sortOrder', 'ASC'], ['baseRate', 'ASC']] }),
    OtaRoomMapping.findAll(),
    Room.findAll({ where: { status: 'active' }, attributes: ['roomType', 'id'], raw: true }),
  ]);

  const byType = new Map(mappings.map((m) => [String(m.roomType), m.toJSON()]));
  const activeCount = new Map();
  for (const r of roomCounts) {
    const k = String(r.roomType);
    activeCount.set(k, (activeCount.get(k) || 0) + 1);
  }

  return types.map((rt) => {
    const m = byType.get(String(rt.id));
    const markupPct = m ? Number(m.rateMarkupPct || 0) : 0;
    const otaBaseRate = Math.round(rt.baseRate * (1 + markupPct / 100));
    return {
      roomTypeId: rt._id,
      roomTypeName: rt.name,
      slug: rt.slug,
      activeRooms: activeCount.get(String(rt.id)) || 0,
      baseRate: rt.baseRate,
      weekendRate: rt.weekendRate || rt.baseRate,
      otaSampleRate: otaBaseRate,
      externalRoomTypeId: m?.externalRoomTypeId || '',
      externalRatePlanId: m?.externalRatePlanId || '',
      rateMarkupPct: markupPct,
      minStay: m?.minStay ?? 1,
      maxStay: m?.maxStay ?? 30,
      stopSell: Boolean(m?.stopSell),
      enabled: m ? Boolean(m.enabled) : true,
    };
  });
}

export async function upsertRoomMapping(roomTypeId, body = {}) {
  const id = toId(roomTypeId);
  const rt = await RoomType.findByPk(id);
  if (!rt) throw badRequest('Room type not found.');

  let mapping = await OtaRoomMapping.findOne({ where: { roomType: id } });
  if (!mapping) {
    mapping = OtaRoomMapping.make({ roomType: id });
  }

  if (body.externalRoomTypeId !== undefined) mapping.externalRoomTypeId = text(body.externalRoomTypeId, 120);
  if (body.externalRatePlanId !== undefined) mapping.externalRatePlanId = text(body.externalRatePlanId, 120);
  if (body.rateMarkupPct !== undefined) {
    const pct = Number(body.rateMarkupPct);
    if (!Number.isFinite(pct) || pct < -50 || pct > 200) throw badRequest('Markup % must be between -50 and 200.');
    mapping.rateMarkupPct = Math.round(pct * 100) / 100;
  }
  if (body.minStay !== undefined) mapping.minStay = Math.min(Math.max(int(body.minStay, 1), 1), 30);
  if (body.maxStay !== undefined) mapping.maxStay = Math.min(Math.max(int(body.maxStay, 30), mapping.minStay), 90);
  if (body.stopSell !== undefined) mapping.stopSell = Boolean(body.stopSell);
  if (body.enabled !== undefined) mapping.enabled = Boolean(body.enabled);

  await mapping.save();
  return mapping.toJSON();
}

export async function buildAriSnapshot({ roomTypeIds, fromDate, days = 30 } = {}) {
  const start = isIsoDate(fromDate) ? fromDate : todayIn(env.timezone);
  const span = Math.min(Math.max(int(days, 30), 1), 365);
  const end = addDays(start, span);
  const dates = stayNights(start, end);

  const typeWhere = { active: true };
  if (Array.isArray(roomTypeIds) && roomTypeIds.length) {
    typeWhere.id = roomTypeIds.map(toId).filter(Boolean);
  }

  const [types, mappings, rooms] = await Promise.all([
    RoomType.findAll({ where: typeWhere, order: [['sortOrder', 'ASC']] }),
    OtaRoomMapping.findAll(),
    Room.findAll({ where: { status: 'active' }, attributes: ['id', 'roomType'], raw: true }),
  ]);

  const mapByType = new Map(mappings.map((m) => [String(m.roomType), m]));
  const roomToType = new Map();
  const totalByType = new Map();
  const activeRoomIds = [];

  for (const r of rooms) {
    const rtKey = String(r.roomType);
    roomToType.set(String(r.id), rtKey);
    totalByType.set(rtKey, (totalByType.get(rtKey) || 0) + 1);
    activeRoomIds.push(r.id);
  }

  const soldRows = activeRoomIds.length
    ? await RoomNight.findAll({
        where: { room: activeRoomIds, date: { [Op.gte]: start, [Op.lt]: end } },
        attributes: ['room', 'date'],
        raw: true,
      })
    : [];

  const soldCounts = new Map();
  for (const row of soldRows) {
    const rtKey = roomToType.get(String(row.room));
    if (!rtKey) continue;
    const k = `${rtKey}:${row.date}`;
    soldCounts.set(k, (soldCounts.get(k) || 0) + 1);
  }

  const entries = [];
  for (const rt of types) {
    const mapping = mapByType.get(String(rt.id));
    if (mapping && !mapping.enabled) continue;
    const totalRooms = totalByType.get(String(rt.id)) || 0;
    const markupPct = mapping ? Number(mapping.rateMarkupPct || 0) : 0;
    const minStay = mapping?.minStay ?? 1;
    const maxStay = mapping?.maxStay ?? 30;
    const stopSell = Boolean(mapping?.stopSell);

    const daily = dates.map((date) => {
      const sold = soldCounts.get(`${rt.id}:${date}`) || 0;
      const free = stopSell ? 0 : Math.max(0, totalRooms - sold);
      const { rate } = nightlyRate(rt, date);
      const otaRate = Math.max(0, Math.round(rate * (1 + markupPct / 100)));
      return {
        date,
        availability: free,
        directRate: rate,
        otaRate,
        minStay,
        maxStay,
        stopSell,
      };
    });

    entries.push({
      roomTypeId: rt._id,
      roomTypeName: rt.name,
      externalRoomTypeId: mapping?.externalRoomTypeId || `oasis-rt-${rt._id}`,
      externalRatePlanId: mapping?.externalRatePlanId || `oasis-rp-${rt._id}`,
      totalRooms,
      mapped: Boolean(mapping?.externalRoomTypeId),
      daily,
    });
  }

  return { fromDate: start, toDate: end, days: span, entries };
}

function buildProviderPayload(provider, config, snapshot) {
  const propertyId = config.propertyId || 'oasis-resort-skardu';

  if (provider === 'channex') {
    const availabilityValues = [];
    const restrictionValues = [];
    for (const item of snapshot.entries) {
      for (const day of item.daily) {
        availabilityValues.push({
          property_id: propertyId,
          room_type_id: item.externalRoomTypeId,
          date: day.date,
          availability: day.availability,
        });
        restrictionValues.push({
          property_id: propertyId,
          rate_plan_id: item.externalRatePlanId,
          date: day.date,
          rate: day.otaRate,
          min_stay_arrival: day.minStay,
          max_stay: day.maxStay,
          stop_sell: day.stopSell,
        });
      }
    }
    return {
      provider: 'channex',
      endpoints: {
        availability: `${config.apiBaseUrl || PROVIDER_DEFAULTS.channex.apiBaseUrl}/availability`,
        restrictions: `${config.apiBaseUrl || PROVIDER_DEFAULTS.channex.apiBaseUrl}/restrictions`,
      },
      availability: { values: availabilityValues },
      restrictions: { values: restrictionValues },
    };
  }

  if (provider === 'beds24') {
    return {
      provider: 'beds24',
      endpoint: `${config.apiBaseUrl || PROVIDER_DEFAULTS.beds24.apiBaseUrl}/inventory/rooms/calendar`,
      rooms: snapshot.entries.map((item) => ({
        roomId: item.externalRoomTypeId,
        calendar: item.daily.map((day) => ({
          from: day.date,
          to: day.date,
          numAvail: day.availability,
          price1: day.otaRate,
          minStay: day.minStay,
          maxStay: day.maxStay,
          override: day.stopSell ? 'blackout' : 'none',
        })),
      })),
    };
  }

  if (provider === 'siteminder') {
    return {
      provider: 'siteminder',
      endpoint: `${config.apiBaseUrl || PROVIDER_DEFAULTS.siteminder.apiBaseUrl}/ari`,
      OTA_HotelAvailNotifRQ: {
        HotelCode: propertyId,
        AvailStatusMessages: snapshot.entries.flatMap((item) =>
          item.daily.map((day) => ({
            StatusApplicationControl: {
              Start: day.date,
              End: day.date,
              InvTypeCode: item.externalRoomTypeId,
              RatePlanCode: item.externalRatePlanId,
            },
            BookingLimit: day.availability,
            RestrictionStatus: day.stopSell ? 'Close' : 'Open',
            LengthsOfStay: [{ Time: day.minStay, MinMaxMessageType: 'SetMinLOS' }],
          })),
        ),
      },
      OTA_HotelRateAmountNotifRQ: {
        HotelCode: propertyId,
        RateAmountMessages: snapshot.entries.flatMap((item) =>
          item.daily.map((day) => ({
            StatusApplicationControl: {
              Start: day.date,
              End: day.date,
              InvTypeCode: item.externalRoomTypeId,
              RatePlanCode: item.externalRatePlanId,
            },
            Rates: [{ BaseByGuestAmts: [{ AmountAfterTax: day.otaRate, CurrencyCode: 'PKR' }] }],
          })),
        ),
      },
    };
  }

  return {
    provider: provider || 'custom_webhook',
    endpoint: config.apiBaseUrl || '',
    propertyId,
    generatedAt: new Date().toISOString(),
    fromDate: snapshot.fromDate,
    toDate: snapshot.toDate,
    inventory: snapshot.entries,
  };
}

export async function previewAriSync({ roomTypeIds, fromDate, days } = {}) {
  const config = await getChannelConfig({ includeSecrets: false });
  const targetDays = days ?? Math.min(config.horizonDays || 30, 14);
  const snapshot = await buildAriSnapshot({ roomTypeIds, fromDate, days: targetDays });
  const provider = config.provider === 'disabled' ? 'channex' : config.provider;
  const payload = buildProviderPayload(provider, config, snapshot);
  return { config, snapshot, payload };
}

async function dispatchJson(url, headers, payload) {
  await validateExternalIcalUrl(url);
  const res = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'OasisResortChannelSync/1.0',
      ...headers,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Channel Manager HTTP ${res.status}${errText ? `: ${errText.slice(0, 160)}` : ''}`);
  }
  return res.json().catch(() => ({ ok: true }));
}

export async function pushAriUpdate({ roomTypeIds, fromDate, days, reason = 'manual_sync' } = {}) {
  const configRow = await ensureConfigRow();
  const config = await getChannelConfig({ includeSecrets: true });
  const targetDays = days ?? config.horizonDays ?? 90;
  const snapshot = await buildAriSnapshot({ roomTypeIds, fromDate, days: targetDays });
  const activeProvider = config.provider === 'disabled' ? 'channex' : config.provider;
  const payload = buildProviderPayload(activeProvider, config, snapshot);
  const totalUpdates = snapshot.entries.reduce((sum, e) => sum + e.daily.length, 0);

  let status = 'dry_run';
  let summary = '';

  const baseUrl = config.apiBaseUrl || PROVIDER_DEFAULTS[config.provider]?.apiBaseUrl || '';
  const hasLiveTransport = config.enabled && config.provider !== 'disabled' && Boolean(config.apiKey) && Boolean(baseUrl);

  try {
    if (hasLiveTransport) {
      if (config.provider === 'channex') {
        await dispatchJson(`${baseUrl}/availability`, { 'user-api-key': config.apiKey }, payload.availability);
        await dispatchJson(`${baseUrl}/restrictions`, { 'user-api-key': config.apiKey }, payload.restrictions);
      } else if (config.provider === 'beds24') {
        await dispatchJson(`${baseUrl}/inventory/rooms/calendar`, { token: config.apiKey }, payload.rooms);
      } else {
        await dispatchJson(payload.endpoint || baseUrl, { Authorization: `Bearer ${config.apiKey}`, 'X-Oasis-Property-Id': config.propertyId || 'oasis' }, payload);
      }
      status = 'success';
      summary = `Pushed ${totalUpdates} room-date ARI updates to ${PROVIDER_DEFAULTS[config.provider]?.label || config.provider} (${reason}).`;
    } else {
      status = 'dry_run';
      summary = `Prepared ${totalUpdates} room-date ARI updates (${reason}) — configure live API key & enable Channel Manager to transmit upstream.`;
    }

    configRow.lastPushAt = new Date();
    configRow.lastPushStatus = status;
    configRow.lastPushMessage = summary.slice(0, 500);
    await configRow.save();

    await OtaSyncLog.create({
      kind: 'ari_push',
      provider: activeProvider,
      direction: 'outbound',
      status,
      summary: summary.slice(0, 400),
      details: JSON.stringify({ reason, fromDate: snapshot.fromDate, toDate: snapshot.toDate, roomTypes: snapshot.entries.length }),
      itemsProcessed: totalUpdates,
    });

    return { ok: true, status, summary, totalUpdates, payloadPreview: payload };
  } catch (error) {
    const errMsg = String(error?.message || 'ARI push failed');
    configRow.lastPushAt = new Date();
    configRow.lastPushStatus = 'error';
    configRow.lastPushMessage = errMsg.slice(0, 500);
    await configRow.save();

    await OtaSyncLog.create({
      kind: 'ari_push',
      provider: activeProvider,
      direction: 'outbound',
      status: 'error',
      summary: `ARI push error (${reason}): ${errMsg}`.slice(0, 400),
      itemsProcessed: 0,
    });
    throw error;
  }
}

export function scheduleAriPush({ roomTypeIds, fromDate, days, reason = 'auto_change' } = {}) {
  setImmediate(async () => {
    try {
      const cfg = await ensureConfigRow();
      if (!cfg.enabled || !cfg.autoSyncOnBooking || cfg.provider === 'disabled') return;
      await pushAriUpdate({ roomTypeIds, fromDate, days, reason });
    } catch (err) {
      console.error('Background ARI sync failed:', err?.message || err);
    }
  });
}

function timingSafeCompare(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  return bufA.length > 0 && bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function verifyWebhookAuth(headers, rawBody, expectedSecret) {
  if (!expectedSecret) {
    throw new HttpError(403, 'Channel Manager webhook secret is not configured.');
  }

  const headerSecret = headers['x-webhook-secret'] || '';
  const bearer = String(headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (timingSafeCompare(expectedSecret, headerSecret) || timingSafeCompare(expectedSecret, bearer)) {
    return;
  }

  const sigHeader = String(headers['x-signature-256'] || headers['x-channex-signature'] || '');
  if (sigHeader && rawBody) {
    const cleanHex = sigHeader.replace(/^sha256=/i, '');
    const digest = crypto.createHmac('sha256', expectedSecret).update(rawBody).digest('hex');
    if (timingSafeCompare(digest, cleanHex)) return;
  }

  throw new HttpError(401, 'Invalid OTA webhook signature or secret.');
}

function mapOtaSource(channelName) {
  const norm = String(channelName || '').toLowerCase();
  if (norm.includes('booking')) return 'booking_com';
  if (norm.includes('airbnb')) return 'airbnb';
  return 'ota';
}

function normalizeWebhookPayload(provider, body) {
  // Support Channex, Beds24, SiteMinder, or normalized PMS webhook envelopes
  const p = body?.payload || body?.data || body || {};
  const attrs = p.attributes || p;
  const externalId = text(attrs.booking_id || attrs.id || attrs.externalId || attrs.reservationId || body?.id, 120);
  const channelName = text(attrs.ota_name || attrs.channel || attrs.referer || provider, 60);
  const rawStatus = String(attrs.status || body?.event || 'new').toLowerCase();
  const status = rawStatus.includes('cancel') ? 'cancelled' : rawStatus.includes('mod') ? 'modified' : 'confirmed';

  const firstRoom = Array.isArray(attrs.rooms) ? attrs.rooms[0] : attrs;
  const externalRoomTypeId = text(
    firstRoom?.room_type_id || firstRoom?.externalRoomTypeId || attrs.roomTypeId || attrs.roomId,
    120,
  );
  const checkIn = text(firstRoom?.checkin_date || firstRoom?.checkIn || attrs.arrival_date || attrs.checkIn, 10);
  const checkOut = text(firstRoom?.checkout_date || firstRoom?.checkOut || attrs.departure_date || attrs.checkOut, 10);

  const guestObj = attrs.customer || attrs.guest || {};
  const guest = {
    firstName: text(guestObj.name || guestObj.firstName || attrs.firstName || 'OTA', 60) || 'OTA',
    lastName: text(guestObj.surname || guestObj.lastName || attrs.lastName || 'Guest', 60) || 'Guest',
    phone: text(guestObj.phone || attrs.phone || '+923000000000', 30) || '+923000000000',
    email: text(guestObj.mail || guestObj.email || attrs.email || 'ota-guest@oasisresort.pk', 120).toLowerCase(),
  };
  guest.phoneKey = phoneKey(guest.phone);
  if (guest.phoneKey.length < 10) guest.phoneKey = '3000000000';

  return {
    externalId,
    channelName,
    source: mapOtaSource(channelName),
    status,
    externalRoomTypeId,
    checkIn,
    checkOut,
    rooms: Math.max(1, int(attrs.rooms_count || (Array.isArray(attrs.rooms) ? attrs.rooms.length : 1), 1)),
    adults: Math.max(1, int(firstRoom?.occupancy?.adults || attrs.adults, 2)),
    children: Math.max(0, int(firstRoom?.occupancy?.children || attrs.children, 0)),
    guest,
    notes: text(attrs.notes || firstRoom?.notes || '', 800),
  };
}

export async function handleOtaWebhook({ provider, headers, body, rawBody }) {
  const cleanProvider = String(provider || 'custom').toLowerCase().slice(0, 40);
  const config = await getChannelConfig({ includeSecrets: true });
  verifyWebhookAuth(headers, rawBody || JSON.stringify(body || {}), config.webhookSecret);

  const evt = normalizeWebhookPayload(cleanProvider, body);
  if (!evt.externalId || !isIsoDate(evt.checkIn) || !isIsoDate(evt.checkOut) || evt.checkOut <= evt.checkIn) {
    throw badRequest('Webhook payload missing valid externalId, checkIn, or checkOut.');
  }

  const existing = await OtaChannelReservation.findOne({
    where: { provider: cleanProvider, externalId: evt.externalId },
  });

  const { changeStatus, createReservation, readStay } = await import('./booking.js');

  if (evt.status === 'cancelled') {
    if (existing?.reservationId) {
      const resv = await Reservation.findByPk(existing.reservationId);
      if (resv && !['cancelled', 'checked_out', 'no_show'].includes(resv.status)) {
        await changeStatus(resv, 'cancelled', { note: `Cancelled via ${evt.channelName} (${evt.externalId})` });
      }
      existing.status = 'cancelled';
      await existing.save();
    }
    await OtaSyncLog.create({
      kind: 'ota_webhook',
      provider: cleanProvider,
      direction: 'inbound',
      status: 'success',
      summary: `OTA cancellation processed: ${evt.channelName} #${evt.externalId}`,
      itemsProcessed: 1,
    });
    return { ok: true, action: 'cancelled', externalId: evt.externalId };
  }

  if (existing?.reservationId) {
    const resv = await Reservation.findByPk(existing.reservationId);
    return {
      ok: true,
      duplicate: true,
      action: 'existing',
      externalId: evt.externalId,
      bookingNumber: resv?.bookingNumber,
    };
  }

  // Resolve target Oasis RoomType via OtaRoomMapping or direct numeric RoomType ID
  let mapping = evt.externalRoomTypeId
    ? await OtaRoomMapping.findOne({ where: { externalRoomTypeId: evt.externalRoomTypeId } })
    : null;
  let roomTypeId = mapping?.roomType || toId(evt.externalRoomTypeId);
  if (!roomTypeId) {
    const fallbackType = await RoomType.findOne({ where: { active: true }, order: [['sortOrder', 'ASC']] });
    roomTypeId = fallbackType?.id;
  }
  if (!roomTypeId) throw badRequest('No matching Oasis room type found for OTA webhook.');

  const settings = await Settings.current();
  const stay = readStay(
    {
      checkIn: evt.checkIn,
      checkOut: evt.checkOut,
      adults: evt.adults,
      children: evt.children,
      rooms: evt.rooms,
    },
    settings,
    todayIn(env.timezone),
    { allowPast: true },
  );

  const reservation = await createReservation({
    stay,
    roomTypeId,
    guest: evt.guest,
    specialRequests: `OTA Ref: ${evt.externalId} (${evt.channelName})${evt.notes ? `\n${evt.notes}` : ''}`.slice(0, 1000),
    offer: `${evt.channelName} #${evt.externalId}`.slice(0, 120),
    source: evt.source,
  });

  await OtaChannelReservation.create({
    provider: cleanProvider,
    externalId: evt.externalId,
    channelName: evt.channelName,
    reservationId: reservation.id,
    status: 'confirmed',
    guestName: reservation.guestName,
    checkIn: evt.checkIn,
    checkOut: evt.checkOut,
    rawPayload: JSON.stringify(body || {}).slice(0, 16000),
  });

  await OtaSyncLog.create({
    kind: 'ota_webhook',
    provider: cleanProvider,
    direction: 'inbound',
    status: 'success',
    summary: `OTA booking ${reservation.bookingNumber} created from ${evt.channelName} (#${evt.externalId})`,
    itemsProcessed: 1,
  });

  return {
    ok: true,
    action: 'created',
    externalId: evt.externalId,
    bookingNumber: reservation.bookingNumber,
    reservationId: reservation._id,
  };
}
