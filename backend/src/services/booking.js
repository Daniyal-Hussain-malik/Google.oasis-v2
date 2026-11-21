import { Op } from 'sequelize';
import { lockForUpdate, tx } from '../config/db.js';
import { toId } from '../models/_base.js';
import { nextSequence } from '../models/Counter.js';
import Reservation from '../models/Reservation.js';
import Room from '../models/Room.js';
import RoomNight from '../models/RoomNight.js';
import RoomType from '../models/RoomType.js';
import { addDays, isIsoDate, nightsBetween, stayNights } from '../utils/dates.js';
import { badRequest, conflict, int } from '../utils/http.js';
import { isDuplicate } from '../utils/sql.js';
import { quoteStay } from './pricing.js';
import { settleForCheckout } from './restaurant.js';
import { scheduleAriPush } from './channelManager.js';

// Checks the dates and party size of a stay and returns them normalised.
// `today` is the hotel's business date; staff may pass allowPast to enter a
// walk-in that started earlier in the day after midnight.
export function readStay(input, settings, today, { allowPast = false } = {}) {
  const checkIn = String(input.checkIn || '');
  const checkOut = String(input.checkOut || '');
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) throw badRequest('Choose a valid check-in and check-out date.');
  if (!allowPast && checkIn < today) throw badRequest('Check-in cannot be in the past.');
  if (checkOut <= checkIn) throw badRequest('Check-out must be after check-in.');

  const nights = nightsBetween(checkIn, checkOut);
  if (nights > settings.maxNights) throw badRequest(`Stays booked online can be up to ${settings.maxNights} nights. Write to the desk for longer.`);
  if (checkIn > addDays(today, settings.maxAdvanceDays)) throw badRequest(`Bookings open ${settings.maxAdvanceDays} days ahead.`);

  const adults = int(input.adults, 1);
  const children = int(input.children, 0);
  const rooms = int(input.rooms, 1);
  if (adults < 1 || adults > 40) throw badRequest('At least one adult must be on the booking.');
  if (children < 0 || children > 40) throw badRequest('Check the number of children.');
  if (rooms < 1 || rooms > settings.maxRoomsPerBooking) throw badRequest(`Book between 1 and ${settings.maxRoomsPerBooking} rooms at a time.`);
  if (adults < rooms) throw badRequest('Each room needs at least one adult.');

  return { checkIn, checkOut, nights, adults, children, rooms };
}

export function fits(roomType, { adults, children, rooms }) {
  return adults <= roomType.maxAdults * rooms && children <= roomType.maxChildren * rooms;
}

// Rooms of each type with no sold night inside the stay.
// When `lock` is true inside a transaction, locks candidate Room rows in
// deterministic `id ASC` order (SELECT ... FOR UPDATE on MySQL/Postgres) and
// locks matching RoomNight rows before filtering out taken rooms.
async function freeRoomsByType(nights, roomTypeIds, { transaction, lock = false } = {}) {
  const where = { status: 'active' };
  if (roomTypeIds) where.roomType = roomTypeIds;
  const lockOpts = lock ? lockForUpdate(transaction) : {};
  const rooms = await Room.findAll({
    where,
    order: lock ? [['id', 'ASC']] : [['roomNo', 'ASC']],
    transaction,
    ...lockOpts,
  });
  if (lock) {
    rooms.sort((a, b) => (a.roomNo < b.roomNo ? -1 : a.roomNo > b.roomNo ? 1 : a.id - b.id));
  }
  const taken = rooms.length
    ? await RoomNight.findAll({
        attributes: ['room'],
        where: { room: rooms.map((room) => room.id), date: nights },
        transaction,
        ...lockOpts,
        raw: true,
      })
    : [];
  const takenIds = new Set(taken.map((row) => String(row.room)));
  const free = new Map();
  for (const room of rooms) {
    if (takenIds.has(String(room.id))) continue;
    const key = String(room.roomType);
    if (!free.has(key)) free.set(key, []);
    free.get(key).push(room);
  }
  return free;
}

export async function availability(stay) {
  const types = await RoomType.findAll({ where: { active: true }, order: [['sortOrder', 'ASC'], ['baseRate', 'ASC']] });
  const free = await freeRoomsByType(stayNights(stay.checkIn, stay.checkOut), types.map((type) => type.id));
  return types.map((roomType) => {
    const suits = fits(roomType, stay);
    return {
      roomType,
      available: (free.get(String(roomType.id)) || []).length,
      fits: suits,
      note: suits ? '' : `Sleeps up to ${roomType.maxAdults} adults and ${roomType.maxChildren} children per room.`,
      quote: quoteStay(roomType, stay.checkIn, stay.checkOut, stay.rooms),
    };
  });
}

async function nextBookingNumber(checkIn, transaction) {
  const year = checkIn.slice(2, 4);
  const seq = await nextSequence(`booking-${year}`, transaction);
  return `OAS${year}${String(seq).padStart(4, '0')}`;
}

export function releaseNights(reservationId, fromDate, transaction) {
  const where = { reservation: reservationId };
  if (fromDate) where.date = { [Op.gte]: fromDate };
  return RoomNight.destroy({ where, transaction });
}

// Claims specific rooms night by night inside the active transaction.
// Row-level locks (SELECT ... FOR UPDATE) prevent concurrent bookings from
// picking the same room; the unique (room, date) index enforces it at DB level.
async function claimRooms(reservationId, candidates, nights, needed, transaction) {
  const claimed = [];
  for (const room of candidates) {
    if (claimed.length === needed) break;
    try {
      await RoomNight.bulkCreate(
        nights.map((date) => ({ room: room.id, date, reservation: reservationId })),
        { transaction },
      );
      claimed.push(room);
    } catch (error) {
      if (!isDuplicate(error)) throw error;
      await RoomNight.destroy({ where: { reservation: reservationId, room: room.id }, transaction });
    }
  }
  return claimed;
}

export async function createReservation({ stay, roomTypeId, guest, specialRequests = '', offer = '', paymentChoice = 'hotel', source = 'website', by }) {
  const roomType = await RoomType.findOne({ where: { id: toId(roomTypeId), active: true } });
  if (!roomType) throw badRequest('That room type is not available to book.');
  if (!fits(roomType, stay)) {
    throw badRequest(`${roomType.name} sleeps up to ${roomType.maxAdults} adults and ${roomType.maxChildren} children per room. Add a room or choose a larger type.`);
  }

  const nights = stayNights(stay.checkIn, stay.checkOut);
  const quote = quoteStay(roomType, stay.checkIn, stay.checkOut, stay.rooms);

  const reservation = await tx(async (transaction) => {
    const free = (await freeRoomsByType(nights, [roomType.id], { transaction, lock: true })).get(String(roomType.id)) || [];
    if (free.length < stay.rooms) throw conflict('Nothing left in this category for those dates.');

    const resv = Reservation.make({
      bookingNumber: await nextBookingNumber(stay.checkIn, transaction),
      source,
      guest,
      specialRequests,
      offer,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      nights: stay.nights,
      adults: stay.adults,
      children: stay.children,
      roomType: roomType.id,
      breakdown: quote.breakdown,
      totalAmount: quote.total,
      paymentChoice,
      history: [{ status: 'confirmed', note: `Booked via ${source}`, by }],
      // The card never reaches this server. A website "pay first night" choice is
      // recorded as a demo payment of the first night's amount.
      payments: paymentChoice === 'online_demo'
        ? [{ amount: quote.breakdown[0].rate, method: 'online_demo', reference: 'website-demo', note: 'First night, paid online (demo)' }]
        : [],
    });
    // The booking row comes first: the nights point at it with a foreign key.
    await resv.save({ transaction });

    const claimed = await claimRooms(resv.id, free, nights, stay.rooms, transaction);
    if (claimed.length < stay.rooms) {
      throw conflict('Those rooms were just taken. Please choose again.');
    }
    resv.rooms = claimed.map((room) => ({ room: room.id, roomNo: room.roomNo, type: roomType.name }));
    await resv.save({ transaction });
    return resv;
  });

  scheduleAriPush({
    roomTypeIds: [roomType.id],
    fromDate: stay.checkIn,
    days: Math.max(stay.nights + 2, 14),
    reason: `reservation_created:${source}`,
  });
  return reservation;
}

const transitions = {
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled: [],
  no_show: [],
};

export async function changeStatus(reservation, status, { note = '', by, today } = {}) {
  if (!transitions[reservation.status]?.includes(status)) {
    throw badRequest(`A ${reservation.status.replace('_', ' ')} booking cannot be marked ${status.replace('_', ' ')}.`);
  }
  if (status === 'checked_in' && today && today < reservation.checkIn) {
    throw badRequest('This booking cannot be checked in before its arrival date.');
  }
  // Restaurant orders still in the kitchen block checkout; served orders that
  // were not paid are put on the final bill first.
  if (status === 'checked_out') await settleForCheckout(reservation, by);

  await tx(async (transaction) => {
    const current = await Reservation.findByPk(reservation.id, {
      transaction,
      ...lockForUpdate(transaction),
    });
    if (!current || !transitions[current.status]?.includes(status)) {
      throw badRequest(`A ${(current?.status || reservation.status).replace('_', ' ')} booking cannot be marked ${status.replace('_', ' ')}.`);
    }

    reservation.status = status;
    reservation.history.push({ status, note, by });

    if (status === 'cancelled' || status === 'no_show') await releaseNights(reservation.id, undefined, transaction);
    // Leaving early frees the nights that were not used.
    if (status === 'checked_out' && today && today < reservation.checkOut) await releaseNights(reservation.id, today, transaction);

    await reservation.save({ transaction });
  });

  if (status === 'cancelled' || status === 'no_show' || (status === 'checked_out' && today && today < reservation.checkOut)) {
    scheduleAriPush({
      roomTypeIds: [reservation.roomType],
      fromDate: reservation.checkIn,
      days: Math.max(Number(reservation.nights || 1) + 2, 14),
      reason: `reservation_${status}`,
    });
  }
  return reservation;
}
