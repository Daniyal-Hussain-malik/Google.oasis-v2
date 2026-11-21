import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { normalizeRole } from '../config/roles.js';
import { toId } from '../models/_base.js';
import User from '../models/User.js';
import { HttpError } from '../utils/http.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

export async function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : queryToken;
  if (!token) throw new HttpError(401, 'Sign in to continue.');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new HttpError(401, 'Your session has expired. Sign in again.');
  }
  const user = await User.findByPk(toId(payload.sub));
  if (!user || !user.active) throw new HttpError(401, 'This account is no longer active.');
  if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw new HttpError(401, 'Your password was changed. Sign in again.');
  }
  // An account that has not been converted yet still works with its new-style role.
  user.role = normalizeRole(user.role);
  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) throw new HttpError(403, 'You do not have permission to do that.');
    next();
  };
}
