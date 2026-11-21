import crypto from 'node:crypto';
import { Router } from 'express';
import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { loginLimit, resetLimit } from '../middleware/limits.js';
import User from '../models/User.js';
import { passwordResetRequested, passwordWasChanged } from '../services/notifications.js';
import { badRequest, HttpError, text } from '../utils/http.js';
import { passwordProblem } from '../utils/password.js';

const router = Router();

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
  res.json({ token: signToken(user), user });
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
  await user.save();
  res.json({ ok: true });
});

export default router;
