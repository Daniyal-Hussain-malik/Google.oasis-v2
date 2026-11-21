import { stayNights, weekday } from '../utils/dates.js';

// Saturday and Sunday nights take the weekend rate.
const WEEKEND = new Set([0, 6]);

export function nightlyRate(roomType, date) {
  const weekend = WEEKEND.has(weekday(date));
  if (weekend && roomType.weekendRate) return { weekend, rate: roomType.weekendRate };
  return { weekend, rate: roomType.baseRate };
}

// Quote for `rooms` rooms of one type. Rates are per room; every figure in the
// breakdown is already multiplied by the number of rooms. Tax is not included:
// it is added when each night is posted to the bill at the desk.
export function quoteStay(roomType, checkIn, checkOut, rooms = 1) {
  const breakdown = stayNights(checkIn, checkOut).map((date) => {
    const { weekend, rate } = nightlyRate(roomType, date);
    return {
      date,
      label: `${weekend ? 'Weekend' : 'Weekday'} rate, breakfast included`,
      rate: rate * rooms,
    };
  });
  const total = breakdown.reduce((sum, night) => sum + night.rate, 0);
  return {
    rooms,
    nights: breakdown.length,
    total,
    average: breakdown.length ? Math.round(total / breakdown.length) : 0,
    breakdown,
  };
}
