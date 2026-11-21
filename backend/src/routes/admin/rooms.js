import { Router } from 'express';
import { col, fn } from 'sequelize';
import { ACCESS, isSuperAdmin } from '../../config/roles.js';
import { requireRole } from '../../middleware/auth.js';
import { toId } from '../../models/_base.js';
import Room from '../../models/Room.js';
import RoomNight from '../../models/RoomNight.js';
import RoomType from '../../models/RoomType.js';
import { badRequest, conflict, notFound } from '../../utils/http.js';
import { populate } from '../../utils/sql.js';
import { scheduleAriPush } from '../../services/channelManager.js';

const router = Router();
const managers = requireRole(...ACCESS.superAdmin);

const typeFields = ['name', 'slug', 'description', 'image', 'gallery', 'bed', 'size', 'maxAdults', 'maxChildren', 'baseRate', 'weekendRate', 'amenities', 'sortOrder', 'active'];
const roomFields = ['roomNo', 'roomType', 'floor', 'notes', 'status', 'housekeeping'];

function pick(body, fields) {
  return Object.fromEntries(fields.filter((field) => body?.[field] !== undefined).map((field) => [field, body[field]]));
}

function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Room types

router.get('/room-types', async (req, res) => {
  const [types, counts] = await Promise.all([
    RoomType.findAll({ order: [['sortOrder', 'ASC'], ['baseRate', 'ASC']] }),
    Room.findAll({ attributes: ['roomType', [fn('COUNT', col('id')), 'rooms']], group: ['roomType'], raw: true }),
  ]);
  const byType = new Map(counts.map((row) => [String(row.roomType), Number(row.rooms)]));
  res.json(types.map((type) => ({ ...type.toJSON(), rooms: byType.get(String(type.id)) || 0 })));
});

router.get('/room-types/:id', async (req, res) => {
  const type = await RoomType.findByPk(toId(req.params.id));
  if (!type) throw notFound('Room type not found.');
  res.json(type);
});

router.post('/room-types', managers, async (req, res) => {
  const data = pick(req.body, typeFields);
  data.slug = slugify(data.slug || data.name);
  res.status(201).json(await RoomType.create(data));
});

router.patch('/room-types/:id', managers, async (req, res) => {
  const data = pick(req.body, typeFields);
  if (data.slug !== undefined) data.slug = slugify(data.slug);
  const type = await RoomType.findByPk(toId(req.params.id));
  if (!type) throw notFound('Room type not found.');
  Object.assign(type, data);
  await type.save();
  if (data.baseRate !== undefined || data.weekendRate !== undefined || data.active !== undefined) {
    scheduleAriPush({ roomTypeIds: [type.id], reason: 'room_type_updated' });
  }
  res.json(type);
});

router.delete('/room-types/:id', managers, async (req, res) => {
  const id = toId(req.params.id);
  if (await Room.count({ where: { roomType: id } })) {
    throw conflict('Move or delete the rooms of this type first, or mark the type inactive.');
  }
  if (!(await RoomType.destroy({ where: { id } }))) throw notFound('Room type not found.');
  res.status(204).end();
});

// Rooms

router.get('/rooms', async (req, res) => {
  const where = {};
  if (req.query.roomType) where.roomType = toId(req.query.roomType);
  if (req.query.status) where.status = req.query.status;
  const rooms = (await Room.findAll({ where, order: [['roomNo', 'ASC']] })).map((room) => room.toJSON());
  res.json(await populate(rooms, 'roomType', RoomType));
});

router.post('/rooms', managers, async (req, res) => {
  const data = pick(req.body, roomFields);
  if (!(await RoomType.count({ where: { id: toId(data.roomType) } }))) throw badRequest('Choose an existing room type.');
  res.status(201).json(await Room.create(data));
});

router.patch('/rooms/:id', async (req, res) => {
  // Desk staff may update housekeeping; everything else needs a manager.
  const fields = isSuperAdmin(req.user.role) ? roomFields : ['housekeeping', 'notes'];
  const data = pick(req.body, fields);
  if (data.roomType && !(await RoomType.count({ where: { id: toId(data.roomType) } }))) throw badRequest('Choose an existing room type.');
  const room = await Room.findByPk(toId(req.params.id));
  if (!room) throw notFound('Room not found.');
  Object.assign(room, data);
  await room.save();
  if (data.status !== undefined || data.roomType !== undefined) {
    scheduleAriPush({ roomTypeIds: [room.roomType], reason: 'room_inventory_updated' });
  }
  res.json(room);
});

router.delete('/rooms/:id', managers, async (req, res) => {
  const id = toId(req.params.id);
  if (await RoomNight.count({ where: { room: id } })) {
    throw conflict('This room has bookings. Mark it out of order instead.');
  }
  if (!(await Room.destroy({ where: { id } }))) throw notFound('Room not found.');
  res.status(204).end();
});

export default router;
