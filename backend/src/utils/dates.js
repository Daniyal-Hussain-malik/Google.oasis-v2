// Dates are stored and exchanged as ISO calendar days ("2026-10-30"), never as
// timestamps, so a stay does not shift by a day when the server and the hotel
// sit in different timezones.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function toUtc(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(iso, days) {
  const date = toUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function nightsBetween(checkIn, checkOut) {
  return Math.round((toUtc(checkOut) - toUtc(checkIn)) / 86400000);
}

// Every night of the stay: the check-in day up to, but not including, check-out.
export function stayNights(checkIn, checkOut) {
  const count = nightsBetween(checkIn, checkOut);
  return Array.from({ length: Math.max(count, 0) }, (_, index) => addDays(checkIn, index));
}

// 0 = Sunday ... 6 = Saturday
export function weekday(iso) {
  return toUtc(iso).getUTCDay();
}

export function todayIn(timezone) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
