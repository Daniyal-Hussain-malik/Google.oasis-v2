import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { Op } from 'sequelize';
import { lockForUpdate, tx } from '../config/db.js';
import { env } from '../config/env.js';
import { toId } from '../models/_base.js';
import { OtaCalendarBlock, OtaIcalSource, OtaRoomFeed, OtaSyncLog } from '../models/OtaSync.js';
import Reservation from '../models/Reservation.js';
import Room from '../models/Room.js';
import RoomNight from '../models/RoomNight.js';
import RoomType from '../models/RoomType.js';
import { addDays, stayNights, todayIn } from '../utils/dates.js';
import { badRequest, notFound } from '../utils/http.js';

const MAX_ICS_BYTES = 2 * 1024 * 1024;

function escapeIcsText(value) {
  return String(value || '')
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/\r?\n/g, '\\n');
}

function unescapeIcsText(value) {
  return String(value || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function foldIcsLine(line) {
  const str = String(line || '');
  if (str.length <= 75) return str;
  const parts = [str.slice(0, 75)];
  for (let i = 75; i < str.length; i += 74) {
    parts.push(` ${str.slice(i, i + 74)}`);
  }
  return parts.join('\r\n');
}

function formatIcsDateCompact(isoDate) {
  return String(isoDate || '').replaceAll('-', '');
}

function formatIcsStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function parseIcsDateValue(raw) {
  const clean = String(raw || '').trim();
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
  if (!match) return null;
  const [, y, m, d] = match;
  const iso = `${y}-${m}-${d}`;
  const probe = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(probe.getTime()) || probe.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

export function parseIcalEvents(icsText) {
  const unfolded = String(icsText || '').replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);
  const events = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.toUpperCase() === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line.toUpperCase() === 'END:VEVENT') {
      if (current && current.uid && current.checkIn) {
        const checkOut = current.checkOut && current.checkOut > current.checkIn
          ? current.checkOut
          : addDays(current.checkIn, 1);
        events.push({
          uid: current.uid.slice(0, 240),
          checkIn: current.checkIn,
          checkOut,
          summary: (current.summary || 'External OTA Block').slice(0, 240),
          description: (current.description || '').slice(0, 2000),
          cancelled: String(current.status || '').toUpperCase() === 'CANCELLED',
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) continue;
    const keyPart = line.slice(0, colonIdx).toUpperCase();
    const valPart = line.slice(colonIdx + 1);
    const propName = keyPart.split(';')[0];

    if (propName === 'UID') current.uid = unescapeIcsText(valPart);
    else if (propName === 'DTSTART') current.checkIn = parseIcsDateValue(valPart);
    else if (propName === 'DTEND') current.checkOut = parseIcsDateValue(valPart);
    else if (propName === 'SUMMARY') current.summary = unescapeIcsText(valPart);
    else if (propName === 'DESCRIPTION') current.description = unescapeIcsText(valPart);
    else if (propName === 'STATUS') current.status = valPart.trim();
  }

  return events;
}

function isPrivateOrReservedIp(ip) {
  if (!ip) return true;
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const norm = ip.toLowerCase();
    if (norm === '::' || norm === '::1') return true;
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true;
    if (norm.startsWith('fe8') || norm.startsWith('fe9') || norm.startsWith('fea') || norm.startsWith('feb')) return true;
    if (norm.startsWith('::ffff:')) return isPrivateOrReservedIp(norm.slice(7));
    return false;
  }
  return true;
}

export async function validateExternalIcalUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    throw badRequest('Enter a valid iCal (.ics) URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw badRequest('External iCal URLs must use HTTPS.');
  }
  if (parsed.username || parsed.password) {
    throw badRequest('iCal URLs must not contain embedded credentials.');
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw badRequest('Private or local network iCal URLs are not permitted.');
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw badRequest('Private or reserved IP addresses are not permitted for iCal sync.');
    }
    return parsed.toString();
  }

  const records = await dns.lookup(host, { all: true }).catch(() => []);
  if (!records.length || records.some((rec) => isPrivateOrReservedIp(rec.address))) {
    throw badRequest('The iCal hostname resolved to an unreachable or private address.');
  }

  return parsed.toString();
}

async function fetchExternalIcal(rawUrl, hopsLeft = 3) {
  const safeUrl = await validateExternalIcalUrl(rawUrl);
  const res = await fetch(safeUrl, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
    headers: {
      Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5',
      'User-Agent': 'OasisResortChannelSync/1.0',
    },
  });

  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    if (!loc || hopsLeft <= 0) throw new Error('Too many redirects fetching iCal feed');
    const nextUrl = new URL(loc, safeUrl).toString();
    return fetchExternalIcal(nextUrl, hopsLeft - 1);
  }

  if (!res.ok) throw new Error(`Remote calendar returned HTTP ${res.status}`);

  const lengthHeader = Number(res.headers.get('content-length') || 0);
  if (lengthHeader > MAX_ICS_BYTES) throw new Error('Remote iCal feed exceeds 2 MB limit');

  const body = await res.text();
  if (Buffer.byteLength(body, 'utf8') > MAX_ICS_BYTES) throw new Error('Remote iCal feed exceeds 2 MB limit');
  if (!body.includes('BEGIN:VCALENDAR')) throw new Error('URL did not return a valid VCALENDAR (.ics) document');
  return body;
}

export async function ensureRoomFeed(roomId) {
  const id = toId(roomId);
  if (!id) throw badRequest('Invalid room id.');
  const existing = await OtaRoomFeed.findOne({ where: { room: id } });
  if (existing) return existing;
  return OtaRoomFeed.create({
    room: id,
    exportToken: crypto.randomBytes(18).toString('hex'),
  });
}

export async function rotateRoomFeedToken(roomId) {
  const id = toId(roomId);
  const room = await Room.findByPk(id);
  if (!room) throw notFound('Room not found.');
  const feed = await ensureRoomFeed(id);
  feed.exportToken = crypto.randomBytes(18).toString('hex');
  await feed.save();
  return feed;
}

function groupNightsToSpans(rows, labelFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.reservation ? `res:${row.reservation}` : `ota:${row.otaBlock}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row.date);
  }

  const spans = [];
  for (const [key, rawDates] of groups.entries()) {
    const dates = [...new Set(rawDates)].sort();
    if (!dates.length) continue;
    let start = dates[0];
    let prev = dates[0];
    let part = 0;

    const flush = () => {
      part += 1;
      spans.push({
        uid: `${key}:part${part}`,
        checkIn: start,
        checkOut: addDays(prev, 1),
        ...labelFn(key),
      });
    };

    for (let i = 1; i < dates.length; i += 1) {
      if (dates[i] === addDays(prev, 1)) {
        prev = dates[i];
      } else {
        flush();
        start = dates[i];
        prev = dates[i];
      }
    }
    flush();
  }
  return spans.sort((a, b) => (a.checkIn < b.checkIn ? -1 : a.checkIn > b.checkIn ? 1 : 0));
}

export function generateRoomIcal({ room, roomType, spans }) {
  const stamp = formatIcsStamp();
  const calName = `Oasis Resort Skardu - Room ${room.roomNo}${roomType?.name ? ` (${roomType.name})` : ''}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Oasis Resort Skardu//OTA Channel Sync//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldIcsLine(`X-WR-CALNAME:${escapeIcsText(calName)}`),
  ];

  for (const span of spans) {
    lines.push('BEGIN:VEVENT');
    lines.push(foldIcsLine(`UID:${span.uid}@oasisresort.pk`));
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${formatIcsDateCompact(span.checkIn)}`);
    lines.push(`DTEND;VALUE=DATE:${formatIcsDateCompact(span.checkOut)}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(span.summary)}`));
    if (span.description) lines.push(foldIcsLine(`DESCRIPTION:${escapeIcsText(span.description)}`));
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

function safeTokenEqual(expected, received) {
  const a = Buffer.from(String(expected || ''), 'utf8');
  const b = Buffer.from(String(received || ''), 'utf8');
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function exportRoomIcal(roomId, token) {
  const id = toId(roomId);
  if (!id) throw notFound('Calendar feed not found.');
  const feed = await OtaRoomFeed.findOne({ where: { room: id } });
  if (!feed || !safeTokenEqual(feed.exportToken, token)) {
    throw notFound('Calendar feed not found.');
  }

  const room = await Room.findByPk(id);
  if (!room) throw notFound('Room not found.');
  const roomType = await RoomType.findByPk(room.roomType);

  const windowStart = addDays(todayIn(env.timezone), -14);
  const nights = await RoomNight.findAll({
    where: { room: room.id, date: { [Op.gte]: windowStart } },
    order: [['date', 'ASC']],
    raw: true,
  });

  const resIds = [...new Set(nights.map((n) => n.reservation).filter(Boolean))];
  const blockIds = [...new Set(nights.map((n) => n.otaBlock).filter(Boolean))];

  const [reservations, blocks] = await Promise.all([
    resIds.length ? Reservation.findAll({ where: { id: resIds }, attributes: ['id', 'bookingNumber', 'source'], raw: true }) : [],
    blockIds.length ? OtaCalendarBlock.findAll({ where: { id: blockIds }, attributes: ['id', 'provider', 'summary'], raw: true }) : [],
  ]);

  const resMap = new Map(reservations.map((r) => [`res:${r.id}`, r]));
  const blockMap = new Map(blocks.map((b) => [`ota:${b.id}`, b]));

  const spans = groupNightsToSpans(nights, (key) => {
    if (key.startsWith('res:')) {
      const res = resMap.get(key);
      return {
        summary: `Reserved (${res?.bookingNumber || 'Oasis Direct'})`,
        description: `Oasis Resort Skardu · Source: ${res?.source || 'direct'}`,
      };
    }
    const blk = blockMap.get(key);
    return {
      summary: `Blocked (${blk?.provider || 'OTA'})`,
      description: blk?.summary ? `Synced from ${blk.provider}: ${blk.summary}` : 'External OTA calendar block',
    };
  });

  feed.lastExportedAt = new Date();
  await feed.save().catch(() => {});

  return {
    filename: `oasis-room-${room.roomNo}.ics`,
    ics: generateRoomIcal({ room, roomType, spans }),
    eventsCount: spans.length,
  };
}

export async function syncIcalSource(sourceId, { icsOverride, triggerAri = true } = {}) {
  const source = await OtaIcalSource.findByPk(toId(sourceId));
  if (!source) throw notFound('iCal source not found.');

  let icsText;
  try {
    icsText = typeof icsOverride === 'string' ? icsOverride : await fetchExternalIcal(source.url);
  } catch (error) {
    source.lastSyncAt = new Date();
    source.lastStatus = 'error';
    source.lastMessage = String(error?.message || 'Could not fetch remote calendar').slice(0, 500);
    await source.save();
    await OtaSyncLog.create({
      kind: 'ical_import',
      provider: source.provider,
      direction: 'inbound',
      status: 'error',
      summary: `iCal sync failed for ${source.label}: ${source.lastMessage}`.slice(0, 400),
      itemsProcessed: 0,
    });
    throw error;
  }

  const parsed = parseIcalEvents(icsText);
  const cutoff = addDays(todayIn(env.timezone), -7);
  const relevant = parsed.filter((evt) => evt.checkOut > cutoff);

  let changedRoomTypeId = null;
  let resultSummary = null;

  await tx(async (transaction) => {
    const room = await Room.findByPk(source.room, {
      transaction,
      ...lockForUpdate(transaction),
    });
    if (!room) throw notFound('Linked room no longer exists.');
    changedRoomTypeId = room.roomType;

    const existingBlocks = await OtaCalendarBlock.findAll({
      where: { sourceId: source.id },
      transaction,
      ...lockForUpdate(transaction),
    });
    const byUid = new Map(existingBlocks.map((b) => [b.externalUid, b]));
    const seenUids = new Set();

    const activeEvents = [];
    for (const evt of relevant) {
      seenUids.add(evt.uid);
      if (evt.cancelled) {
        const prev = byUid.get(evt.uid);
        if (prev) {
          await RoomNight.destroy({ where: { otaBlock: prev.id }, transaction });
          prev.status = 'cancelled';
          prev.lastSeenAt = new Date();
          await prev.save({ transaction });
        }
      } else {
        activeEvents.push(evt);
      }
    }

    // Release any blocks that vanished from the remote feed (e.g. cancelled on Airbnb/Booking.com).
    let releasedCount = 0;
    for (const block of existingBlocks) {
      if (seenUids.has(block.externalUid)) continue;
      if (block.status !== 'cancelled') {
        releasedCount += await RoomNight.destroy({ where: { otaBlock: block.id }, transaction });
        block.status = 'cancelled';
        block.conflictNote = '';
        await block.save({ transaction });
      }
    }

    // Lock all current RoomNight rows for this room before claiming/updating blocks.
    const existingNights = await RoomNight.findAll({
      where: { room: room.id },
      transaction,
      ...lockForUpdate(transaction),
      raw: true,
    });
    const nightOwnerByDate = new Map(existingNights.map((n) => [n.date, n]));

    let blockedNightsCount = 0;
    let conflicts = 0;

    for (const evt of activeEvents) {
      const nights = stayNights(evt.checkIn, evt.checkOut);
      if (!nights.length) continue;

      let block = byUid.get(evt.uid);
      if (!block) {
        block = await OtaCalendarBlock.create(
          {
            sourceId: source.id,
            room: room.id,
            provider: source.provider,
            externalUid: evt.uid,
            summary: evt.summary,
            checkIn: evt.checkIn,
            checkOut: evt.checkOut,
            status: 'active',
            rawDescription: evt.description,
            lastSeenAt: new Date(),
          },
          { transaction },
        );
      } else {
        // Clear previous nights for this block so date shifts re-claim cleanly.
        await RoomNight.destroy({ where: { otaBlock: block.id }, transaction });
        for (const [d, owner] of nightOwnerByDate.entries()) {
          if (owner.otaBlock === block.id) nightOwnerByDate.delete(d);
        }
        block.summary = evt.summary;
        block.checkIn = evt.checkIn;
        block.checkOut = evt.checkOut;
        block.rawDescription = evt.description;
        block.lastSeenAt = new Date();
      }

      const conflictingDates = nights.filter((date) => nightOwnerByDate.has(date));
      if (conflictingDates.length > 0) {
        conflicts += 1;
        block.status = 'conflict';
        block.conflictNote = `Overlaps existing booking/block on ${conflictingDates.slice(0, 3).join(', ')}`;
        await block.save({ transaction });
      } else {
        block.status = 'active';
        block.conflictNote = '';
        await block.save({ transaction });
        await RoomNight.bulkCreate(
          nights.map((date) => ({
            room: room.id,
            date,
            reservation: null,
            otaBlock: block.id,
          })),
          { transaction },
        );
        for (const date of nights) {
          nightOwnerByDate.set(date, { room: room.id, date, otaBlock: block.id });
        }
        blockedNightsCount += nights.length;
      }
    }

    source.lastSyncAt = new Date();
    source.eventsCount = activeEvents.length;
    source.blockedNightsCount = blockedNightsCount;
    source.lastStatus = conflicts > 0 ? 'conflict' : 'ok';
    source.lastMessage = conflicts > 0
      ? `Synced ${activeEvents.length} event(s), ${blockedNightsCount} night(s) blocked, ${conflicts} overlap conflict(s) detected.`
      : `Synced ${activeEvents.length} event(s), ${blockedNightsCount} night(s) blocked${releasedCount ? `, ${releasedCount} released` : ''}.`;
    await source.save({ transaction });

    await OtaSyncLog.create(
      {
        kind: 'ical_import',
        provider: source.provider,
        direction: 'inbound',
        status: conflicts > 0 ? 'conflict' : 'success',
        summary: `Room ${room.roomNo} (${source.label}): ${source.lastMessage}`.slice(0, 400),
        itemsProcessed: activeEvents.length,
      },
      { transaction },
    );

    resultSummary = {
      source: source.toJSON(),
      eventsCount: activeEvents.length,
      blockedNightsCount,
      conflicts,
      releasedCount,
    };
  });

  if (triggerAri && changedRoomTypeId) {
    const { scheduleAriPush } = await import('./channelManager.js');
    scheduleAriPush({ roomTypeIds: [changedRoomTypeId], reason: `ical_sync:${source.provider}` });
  }

  return resultSummary;
}

export async function removeIcalSource(sourceId) {
  const source = await OtaIcalSource.findByPk(toId(sourceId));
  if (!source) throw notFound('iCal source not found.');
  const room = await Room.findByPk(source.room);

  await tx(async (transaction) => {
    const blocks = await OtaCalendarBlock.findAll({ where: { sourceId: source.id }, attributes: ['id'], transaction, raw: true });
    if (blocks.length) {
      await RoomNight.destroy({ where: { otaBlock: blocks.map((b) => b.id) }, transaction });
    }
    await OtaIcalSource.destroy({ where: { id: source.id }, transaction });
  });

  if (room?.roomType) {
    const { scheduleAriPush } = await import('./channelManager.js');
    scheduleAriPush({ roomTypeIds: [room.roomType], reason: 'ical_source_removed' });
  }
}

export async function syncAllIcalSources({ onlyAuto = false } = {}) {
  const where = { enabled: true };
  if (onlyAuto) where.autoSync = true;
  const sources = await OtaIcalSource.findAll({ where, order: [['id', 'ASC']] });
  const results = [];
  for (const src of sources) {
    try {
      const r = await syncIcalSource(src.id, { triggerAri: false });
      results.push({ id: src._id, label: src.label, ok: true, ...r });
    } catch (err) {
      results.push({ id: src._id, label: src.label, ok: false, error: err?.message || 'Sync error' });
    }
  }
  if (sources.length) {
    const { scheduleAriPush } = await import('./channelManager.js');
    scheduleAriPush({ reason: onlyAuto ? 'ical_auto_poll' : 'ical_sync_all' });
  }
  return results;
}
