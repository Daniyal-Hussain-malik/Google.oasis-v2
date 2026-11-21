export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);

export function text(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function int(value, fallback = 0) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : fallback;
}

// Phone numbers arrive as "0344-5537788", "+92 344 5537788" or "923445537788".
// Comparing the last ten digits treats all of those as the same number.
export function phoneKey(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.slice(-10);
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
