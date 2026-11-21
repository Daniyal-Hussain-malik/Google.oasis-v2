import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { normalizeRole } from '../config/roles.js';
import { toId } from '../models/_base.js';
import RefreshToken from '../models/RefreshToken.js';
import User from '../models/User.js';
import { HttpError } from '../utils/http.js';

export const ACCESS_COOKIE = 'oasis_access';
export const REFRESH_COOKIE = 'oasis_refresh';

const sha256 = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

export function isSecureRequest(req) {
  if (env.production) return true;
  if (req?.secure) return true;
  const proto = String(req?.get?.('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase();
  return proto === 'https';
}

export function cookieOptions(req, { path = '/api', maxAgeMs } = {}) {
  const secure = isSecureRequest(req);
  const sameSite = env.cookieSameSite;
  const opts = {
    httpOnly: true,
    secure: sameSite === 'none' ? true : secure,
    sameSite,
    path,
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
  if (sameSite === 'none') opts.partitioned = true;
  return opts;
}

export function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: normalizeRole(user.role), typ: 'access' }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

export async function issueSessionTokens(user, req, { familyId } = {}) {
  const accessToken = signToken(user);
  const rawRefresh = crypto.randomBytes(48).toString('base64url');
  const tokenHash = sha256(rawRefresh);
  const refreshTtlMs = env.jwtRefreshDays * 24 * 60 * 60 * 1000;

  await RefreshToken.create({
    userId: user.id,
    tokenHash,
    familyId: familyId || crypto.randomBytes(16).toString('hex'),
    expiresAt: new Date(Date.now() + refreshTtlMs),
    userAgent: String(req?.get?.('user-agent') || '').slice(0, 250),
    ipAddress: String(req?.ip || '').slice(0, 60),
  });

  return { accessToken, refreshToken: rawRefresh, refreshTtlMs };
}

export function setAuthCookies(req, res, { accessToken, refreshToken, refreshTtlMs }) {
  res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(req, { path: '/api', maxAgeMs: 15 * 60 * 1000 }));
  res.cookie(
    REFRESH_COOKIE,
    refreshToken,
    cookieOptions(req, { path: '/api/auth', maxAgeMs: refreshTtlMs || env.jwtRefreshDays * 24 * 60 * 60 * 1000 }),
  );
}

export function clearAuthCookies(req, res) {
  res.clearCookie(ACCESS_COOKIE, cookieOptions(req, { path: '/api' }));
  res.clearCookie(REFRESH_COOKIE, cookieOptions(req, { path: '/api/auth' }));
}

export async function rotateRefreshToken(rawRefresh, req) {
  if (!rawRefresh) throw new HttpError(401, 'Refresh session missing. Sign in again.');
  const tokenHash = sha256(rawRefresh);
  const existing = await RefreshToken.findOne({ where: { tokenHash } });
  if (!existing) throw new HttpError(401, 'Invalid refresh session. Sign in again.');

  // Reuse detection: if an already-rotated token is presented again, revoke the entire token family.
  if (existing.revokedAt) {
    await RefreshToken.update(
      { revokedAt: new Date() },
      { where: { familyId: existing.familyId, revokedAt: null } },
    );
    throw new HttpError(401, 'Session token reuse detected. Please sign in again.');
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    existing.revokedAt = new Date();
    await existing.save();
    throw new HttpError(401, 'Your session has expired. Sign in again.');
  }

  const user = await User.findByPk(existing.userId);
  if (!user || !user.active) {
    existing.revokedAt = new Date();
    await existing.save();
    throw new HttpError(401, 'This account is no longer active.');
  }
  if (user.passwordChangedAt && existing.createdAt.getTime() < user.passwordChangedAt.getTime()) {
    existing.revokedAt = new Date();
    await existing.save();
    throw new HttpError(401, 'Your password was changed. Sign in again.');
  }

  const next = await issueSessionTokens(user, req, { familyId: existing.familyId });
  existing.revokedAt = new Date();
  existing.replacedByHash = sha256(next.refreshToken);
  await existing.save();

  user.role = normalizeRole(user.role);
  return { user, ...next };
}

export async function revokeRefreshToken(rawRefresh) {
  if (!rawRefresh) return;
  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { tokenHash: sha256(rawRefresh), revokedAt: null } },
  );
}

export async function revokeAllUserTokens(userId) {
  const id = toId(userId);
  if (!id) return;
  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { userId: id, revokedAt: null } },
  );
  // Housekeeping: prune expired refresh tokens older than 30 days
  await RefreshToken.destroy({
    where: { expiresAt: { [Op.lt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
  }).catch(() => {});
}

export async function requireAuth(req, res, next) {
  const cookieToken = req.cookies?.[ACCESS_COOKIE] || '';
  const header = req.get('authorization') || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  const token = cookieToken || bearerToken;
  if (!token) throw new HttpError(401, 'Sign in to continue.');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new HttpError(401, 'Your session has expired. Sign in again.');
  }
  if (payload.typ && payload.typ !== 'access') {
    throw new HttpError(401, 'Invalid session token type.');
  }

  const user = await User.findByPk(toId(payload.sub));
  if (!user || !user.active) throw new HttpError(401, 'This account is no longer active.');
  if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw new HttpError(401, 'Your password was changed. Sign in again.');
  }
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
