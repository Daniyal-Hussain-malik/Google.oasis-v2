import { rateLimit } from 'express-rate-limit';

const options = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { message: 'Too many requests. Please wait a few minutes and try again.' },
};

// Booking, lookup and contact forms: generous for a family, tight for a script.
export const formLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, ...options });
export const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, ...options });
// Password reset has its own budget so sign-in attempts and reset requests do not use each other up.
export const resetLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, ...options });
export const insightLimit = rateLimit({ windowMs: 60 * 1000, limit: 120, ...options });
