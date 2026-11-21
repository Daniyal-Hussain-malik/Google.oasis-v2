import { Router } from 'express';
import { ACCESS } from '../../config/roles.js';
import { requireRole } from '../../middleware/auth.js';
import { toId } from '../../models/_base.js';
import { ICAL_PROVIDERS, OtaCalendarBlock, OtaIcalSource, OtaSyncLog } from '../../models/OtaSync.js';
import Room from '../../models/Room.js';
import RoomType from '../../models/RoomType.js';
import {
  getChannelConfig,
  listRoomMappings,
  PROVIDER_DEFAULTS,
  previewAriSync,
  pushAriUpdate,
  updateChannelConfig,
  upsertRoomMapping,
} from '../../services/channelManager.js';
import {
  ensureRoomFeed,
  removeIcalSource,
  rotateRoomFeedToken,
  syncAllIcalSources,
  syncIcalSource,
  validateExternalIcalUrl,
} from '../../services/ical.js';
import { badRequest, notFound, text } from '../../utils/http.js';

const router = Router();
const managers = requireRole(...ACCESS.superAdmin);

router.get('/overview', async (req, res) => {
  const [rooms, roomTypes, sources, blocks, config, mappings, logs] = await Promise.all([
    Room.findAll({ order: [['roomNo', 'ASC']] }),
    RoomType.findAll({ order: [['sortOrder', 'ASC']] }),
    OtaIcalSource.findAll({ order: [['room', 'ASC'], ['id', 'ASC']] }),
    OtaCalendarBlock.findAll({ where: { status: ['active', 'conflict'] }, order: [['checkIn', 'ASC']], limit: 200 }),
    getChannelConfig({ includeSecrets: false }),
    listRoomMappings(),
    OtaSyncLog.findAll({ order: [['createdAt', 'DESC']], limit: 50 }),
  ]);

  const typeById = new Map(roomTypes.map((rt) => [String(rt.id), rt.name]));
  const feeds = await Promise.all(rooms.map((r) => ensureRoomFeed(r.id)));
  const feedByRoom = new Map(feeds.map((f) => [String(f.room), f]));

  const sourcesByRoom = new Map();
  for (const s of sources) {
    const k = String(s.room);
    if (!sourcesByRoom.has(k)) sourcesByRoom.set(k, []);
    sourcesByRoom.get(k).push(s.toJSON());
  }

  const roomRows = rooms.map((room) => {
    const feed = feedByRoom.get(String(room.id));
    return {
      _id: room._id,
      roomNo: room.roomNo,
      roomTypeId: String(room.roomType),
      roomTypeName: typeById.get(String(room.roomType)) || 'Room',
      status: room.status,
      exportPath: `/api/public/ical/room/${room._id}/${feed.exportToken}.ics`,
      lastExportedAt: feed.lastExportedAt,
      inboundSources: sourcesByRoom.get(String(room.id)) || [],
    };
  });

  const roomNoById = new Map(rooms.map((r) => [String(r.id), r.roomNo]));
  res.json({
    rooms: roomRows,
    blocks: blocks.map((b) => ({
      ...b.toJSON(),
      roomNo: roomNoById.get(String(b.room)) || String(b.room),
    })),
    channelConfig: config,
    providers: PROVIDER_DEFAULTS,
    mappings,
    logs: logs.map((l) => l.toJSON()),
  });
});

router.post('/rooms/:roomId/rotate-token', managers, async (req, res) => {
  const feed = await rotateRoomFeedToken(req.params.roomId);
  res.json({
    roomId: String(feed.room),
    exportPath: `/api/public/ical/room/${feed.room}/${feed.exportToken}.ics`,
  });
});

router.post('/ical-sources', managers, async (req, res) => {
  const body = req.body || {};
  const roomId = toId(body.roomId || body.room);
  const room = await Room.findByPk(roomId);
  if (!room) throw notFound('Room not found.');

  const provider = ICAL_PROVIDERS.includes(body.provider) ? body.provider : 'airbnb';
  const label = text(body.label, 120) || `${provider.replace('_', '.')} — Room ${room.roomNo}`;
  const cleanUrl = await validateExternalIcalUrl(body.url);

  const created = await OtaIcalSource.create({
    room: room.id,
    provider,
    label,
    url: cleanUrl,
    enabled: body.enabled !== false,
    autoSync: body.autoSync !== false,
  });

  let syncResult = null;
  if (body.syncNow !== false) {
    try {
      syncResult = await syncIcalSource(created.id);
    } catch {
      /* sync error already recorded on source + OtaSyncLog */
    }
  }

  const fresh = await OtaIcalSource.findByPk(created.id);
  res.status(201).json({ source: fresh.toJSON(), sync: syncResult });
});

router.patch('/ical-sources/:id', managers, async (req, res) => {
  const source = await OtaIcalSource.findByPk(toId(req.params.id));
  if (!source) throw notFound('iCal source not found.');

  const body = req.body || {};
  if (body.provider !== undefined) {
    if (!ICAL_PROVIDERS.includes(body.provider)) throw badRequest('Invalid provider.');
    source.provider = body.provider;
  }
  if (body.label !== undefined) {
    const cleanLabel = text(body.label, 120);
    if (!cleanLabel) throw badRequest('Label is required.');
    source.label = cleanLabel;
  }
  if (body.url !== undefined) {
    source.url = await validateExternalIcalUrl(body.url);
  }
  if (body.enabled !== undefined) source.enabled = Boolean(body.enabled);
  if (body.autoSync !== undefined) source.autoSync = Boolean(body.autoSync);

  await source.save();
  res.json(source.toJSON());
});

router.delete('/ical-sources/:id', managers, async (req, res) => {
  await removeIcalSource(req.params.id);
  res.status(204).end();
});

router.post('/ical-sources/:id/sync', async (req, res) => {
  const icsOverride = typeof req.body?.icsContent === 'string' && req.body.icsContent.trim()
    ? req.body.icsContent
    : undefined;
  const result = await syncIcalSource(req.params.id, { icsOverride });
  res.json(result);
});

router.post('/ical/sync-all', async (req, res) => {
  const results = await syncAllIcalSources({ onlyAuto: false });
  res.json({ ok: true, results });
});

router.put('/channel-config', managers, async (req, res) => {
  const updated = await updateChannelConfig(req.body || {});
  res.json(updated);
});

router.put('/mappings/:roomTypeId', managers, async (req, res) => {
  const updated = await upsertRoomMapping(req.params.roomTypeId, req.body || {});
  res.json(updated);
});

router.get('/channel/preview-ari', async (req, res) => {
  const days = req.query.days ? Number(req.query.days) : undefined;
  const fromDate = req.query.fromDate ? String(req.query.fromDate) : undefined;
  res.json(await previewAriSync({ fromDate, days }));
});

router.post('/channel/push-ari', async (req, res) => {
  const body = req.body || {};
  const result = await pushAriUpdate({
    roomTypeIds: Array.isArray(body.roomTypeIds) ? body.roomTypeIds : undefined,
    fromDate: body.fromDate,
    days: body.days,
    reason: text(body.reason, 80) || 'manual_push',
  });
  res.json(result);
});

export default router;
