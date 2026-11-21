import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootstrapBackend } from '../../backend/src/bootstrap.js';
import { disconnectDb } from '../../backend/src/config/db.js';
import Reservation from '../../backend/src/models/Reservation.js';
import Room from '../../backend/src/models/Room.js';
import RoomNight from '../../backend/src/models/RoomNight.js';
import RoomType from '../../backend/src/models/RoomType.js';
import Settings from '../../backend/src/models/Settings.js';
import { availability, changeStatus, createReservation, fits, readStay } from '../../backend/src/services/booking.js';
import { addDays, todayIn } from '../../backend/src/utils/dates.js';

describe('booking service integration', () => {
  let settings: any;
  let today: string;

  beforeAll(async () => {
    await bootstrapBackend();
    settings = await Settings.current();
    today = todayIn('Asia/Karachi');
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('validates stay windows, past check-in restrictions, and party capacity', () => {
    const checkIn = addDays(today, 2);
    const checkOut = addDays(today, 5);
    const parsed = readStay({ checkIn, checkOut, adults: 2, children: 1, rooms: 1 }, settings, today);
    expect(parsed).toEqual({ checkIn, checkOut, nights: 3, adults: 2, children: 1, rooms: 1 });

    expect(() => readStay({ checkIn: addDays(today, -1), checkOut: checkIn }, settings, today)).toThrow(/past/i);
    expect(() => readStay({ checkIn, checkOut: checkIn }, settings, today)).toThrow(/after check-in/i);
    expect(() => readStay({ checkIn, checkOut, adults: 1, rooms: 2 }, settings, today)).toThrow(/at least one adult/i);

    expect(fits({ maxAdults: 2, maxChildren: 1 }, { adults: 2, children: 1, rooms: 1 })).toBe(true);
    expect(fits({ maxAdults: 2, maxChildren: 1 }, { adults: 3, children: 0, rooms: 1 })).toBe(false);
    expect(fits({ maxAdults: 2, maxChildren: 1 }, { adults: 4, children: 2, rooms: 2 })).toBe(true);
  });

  it('prevents concurrent double-booking of the last remaining hut via transaction locking & RoomNight unique index', async () => {
    const soloType = RoomType.make({
      name: 'Solo Desert Villa',
      slug: 'solo-desert-villa',
      baseRate: 45000,
      weekendRate: 50000,
      maxAdults: 2,
      maxChildren: 1,
      active: true,
    });
    await soloType.save();
    const room = await Room.create({ roomNo: '999', roomType: soloType.id, status: 'active' });

    const checkIn = addDays(today, 10);
    const checkOut = addDays(today, 12);
    const stay = { checkIn, checkOut, nights: 2, adults: 2, children: 0, rooms: 1 };

    const [firstAttempt, secondAttempt] = await Promise.allSettled([
      createReservation({
        stay,
        roomTypeId: soloType.id,
        guest: { firstName: 'Ayesha', lastName: 'Khan', phone: '03001112233', phoneKey: '3001112233', email: 'ayesha@example.com' },
      }),
      createReservation({
        stay,
        roomTypeId: soloType.id,
        guest: { firstName: 'Bilal', lastName: 'Raza', phone: '03004445566', phoneKey: '3004445566', email: 'bilal@example.com' },
      }),
    ]);

    const succeeded = [firstAttempt, secondAttempt].filter((r) => r.status === 'fulfilled');
    const failed = [firstAttempt, secondAttempt].filter((r) => r.status === 'rejected');

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason.status).toBe(409);

    const lockedNights = await RoomNight.findAll({ where: { room: room.id } });
    expect(lockedNights).toHaveLength(2);

    const avail = await availability(stay);
    const soloAvail = avail.find((a: any) => String(a.roomType.id) === String(soloType.id));
    expect(soloAvail?.available).toBe(0);
  });

  it('handles check-in, early check-out night release, and cancellation cleanup', async () => {
    const deluxe = await RoomType.findOne({ where: { slug: 'deluxe-hut' } });
    expect(deluxe).toBeTruthy();

    // 1. Booking starting today: check-in -> early checkout releases unused nights
    const stayToday = { checkIn: today, checkOut: addDays(today, 4), nights: 4, adults: 2, children: 0, rooms: 1 };
    const resv1 = await createReservation({
      stay: stayToday,
      roomTypeId: deluxe!.id,
      guest: { firstName: 'Saad', lastName: 'Ali', phone: '03121234567', phoneKey: '3121234567', email: 'saad@example.com' },
    });
    expect(await RoomNight.count({ where: { reservation: resv1.id } })).toBe(4);

    await changeStatus(resv1, 'checked_in', { today });
    expect(resv1.status).toBe('checked_in');

    // Checking out on day +2 releases the remaining 2 nights
    await changeStatus(resv1, 'checked_out', { today: addDays(today, 2) });
    expect(resv1.status).toBe('checked_out');
    expect(await RoomNight.count({ where: { reservation: resv1.id } })).toBe(2);

    // 2. Future booking cancelled: releases all nights immediately
    const futureStay = { checkIn: addDays(today, 20), checkOut: addDays(today, 23), nights: 3, adults: 2, children: 0, rooms: 1 };
    const resv2 = await createReservation({
      stay: futureStay,
      roomTypeId: deluxe!.id,
      guest: { firstName: 'Hina', lastName: 'Malik', phone: '03319998877', phoneKey: '3319998877', email: 'hina@example.com' },
    });
    expect(await RoomNight.count({ where: { reservation: resv2.id } })).toBe(3);

    await changeStatus(resv2, 'cancelled', { today });
    const reloaded = await Reservation.findByPk(resv2.id);
    expect(reloaded?.status).toBe('cancelled');
    expect(await RoomNight.count({ where: { reservation: resv2.id } })).toBe(0);
  });
});
