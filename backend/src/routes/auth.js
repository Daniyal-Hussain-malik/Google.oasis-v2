import crypto from 'node:crypto';
import { Router } from 'express';
import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { SUPER_ADMIN } from '../config/roles.js';
import {
  clearAuthCookies,
  issueSessionTokens,
  REFRESH_COOKIE,
  requireAuth,
  revokeAllUserTokens,
  revokeRefreshToken,
  rotateRefreshToken,
  setAuthCookies,
} from '../middleware/auth.js';
import { loginLimit, resetLimit } from '../middleware/limits.js';
import User from '../models/User.js';
import { passwordResetRequested, passwordWasChanged } from '../services/notifications.js';
import { badRequest, HttpError, isEmail, text } from '../utils/http.js';
import { passwordProblem } from '../utils/password.js';

const router = Router();

// First-run status: lets an unconfigured deployment claim the initial Super Admin without seeded default passwords.
router.get('/setup-status', async (_req, res) => {
  const userCount = await User.count();
  res.json({ needsSetup: userCount === 0 });
});

router.post('/setup-admin', loginLimit, async (req, res) => {
  const existing = await User.count();
  if (existing > 0) {
    throw new HttpError(403, 'Initial administrator has already been configured.');
  }
  const name = text(req.body?.name, 80);
  const email = text(req.body?.email, 120).toLowerCase();
  const password = String(req.body?.password || '');
  if (name.length < 2) throw badRequest('Enter your full name.');
  if (!isEmail(email)) throw badRequest('Enter a valid email address.');
  const problem = passwordProblem(password);
  if (problem) throw badRequest(problem);

  const user = await User.create({ name, email, password, role: SUPER_ADMIN });
  const tokens = await issueSessionTokens(user, req);
  setAuthCookies(req, res, tokens);
  const safeUser = await User.findByPk(user.id);
  res.status(201).json({ ok: true, user: safeUser });
});

router.post('/login', loginLimit, async (req, res) => {
  const email = text(req.body?.email, 120).toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) throw badRequest('Enter your email and password.');

  const user = await User.unscoped().findOne({ where: { email } });
  if (!user || !user.active || !(await user.checkPassword(password))) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueSessionTokens(user, req);
  setAuthCookies(req, res, tokens);
  const safeUser = await User.findByPk(user.id);
  res.json({ ok: true, user: safeUser });
});

router.post('/refresh', async (req, res) => {
  const rawRefresh = req.cookies?.[REFRESH_COOKIE] || '';
  try {
    const rotated = await rotateRefreshToken(rawRefresh, req);
    setAuthCookies(req, res, rotated);
    res.json({ ok: true, user: rotated.user });
  } catch (err) {
    clearAuthCookies(req, res);
    throw err;
  }
});

router.post('/logout', async (req, res) => {
  const rawRefresh = req.cookies?.[REFRESH_COOKIE] || '';
  await revokeRefreshToken(rawRefresh).catch(() => {});
  clearAuthCookies(req, res);
  res.json({ ok: true });
});

router.post('/logout-all', requireAuth, async (req, res) => {
  await revokeAllUserTokens(req.user.id);
  clearAuthCookies(req, res);
  res.json({ ok: true });
});

const RESET_MINUTES = 15;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Always answers the same way, so the form cannot be used to find out which
// emails belong to staff. A second request within a minute sends nothing.
router.post('/forgot', resetLimit, async (req, res) => {
  const email = text(req.body?.email, 120).toLowerCase();
  if (!email) throw badRequest('Enter your email.');
  const user = await User.unscoped().findOne({ where: { email } });
  if (user?.active && (!user.resetRequestedAt || Date.now() - user.resetRequestedAt.getTime() > 60 * 1000)) {
    const token = crypto.randomBytes(32).toString('hex');
    await User.update(
      { resetTokenHash: sha256(token), resetExpires: new Date(Date.now() + RESET_MINUTES * 60 * 1000), resetRequestedAt: new Date() },
      { where: { id: user.id } },
    );
    passwordResetRequested(user, `${env.adminUrl}/reset-password?token=${token}`, RESET_MINUTES);
  }
  res.json({ ok: true, message: 'If that email belongs to a staff account, a reset link is on its way.' });
});

router.post('/reset', resetLimit, async (req, res) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  const problem = passwordProblem(password);
  if (problem) throw badRequest(problem);
  if (!token) throw badRequest('This reset link is not valid.');

  // Claiming the token and using it are one step, so a link cannot be used twice.
  const user = await User.unscoped().findOne({ where: { resetTokenHash: sha256(token), resetExpires: { [Op.gt]: new Date() }, active: true } });
  const [claimed] = user ? await User.update({ resetTokenHash: null, resetExpires: null }, { where: { id: user.id, resetTokenHash: sha256(token) } }) : [0];
  if (!claimed) throw badRequest('This reset link is not valid or has expired. Ask for a new one.');
  user.password = password;
  user.passwordChangedAt = new Date();
  await user.save();
  await revokeAllUserTokens(user.id);
  clearAuthCookies(req, res);
  passwordWasChanged(user);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

router.post('/password', requireAuth, async (req, res) => {
  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');
  const problem = passwordProblem(next);
  if (problem) throw badRequest(problem);
  const user = await User.unscoped().findByPk(req.user.id);
  if (!(await user.checkPassword(current))) throw new HttpError(401, 'The current password is incorrect.');
  user.password = next;
  user.passwordChangedAt = new Date();
  await user.save();
  await revokeAllUserTokens(user.id);
  const tokens = await issueSessionTokens(user, req);
  setAuthCookies(req, res, tokens);
  res.json({ ok: true });
});

export default router;
