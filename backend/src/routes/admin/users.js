import { Router } from 'express';
import { FRONTDESK, ROLES, SUPER_ADMIN } from '../../config/roles.js';
import { toId } from '../../models/_base.js';
import User from '../../models/User.js';
import { staffAccountCreated } from '../../services/notifications.js';
import { badRequest, isEmail, notFound, text } from '../../utils/http.js';

// Mounted behind the Super admin role.
const router = Router();

router.get('/', async (req, res) => {
  res.json(await User.findAll({ order: [['name', 'ASC']] }));
});

router.post('/', async (req, res) => {
  const name = text(req.body?.name, 80);
  const email = text(req.body?.email, 120).toLowerCase();
  const password = String(req.body?.password || '');
  const role = ROLES.includes(req.body?.role) ? req.body.role : FRONTDESK;
  if (!name) throw badRequest('Name is required.');
  if (!isEmail(email)) throw badRequest('Enter a valid email.');
  if (password.length < 8) throw badRequest('The password must be at least 8 characters.');
  const user = await User.create({ name, email, password, role });
  staffAccountCreated(user);
  res.status(201).json(user);
});

router.patch('/:id', async (req, res) => {
  const user = await User.unscoped().findByPk(toId(req.params.id));
  if (!user) throw notFound('User not found.');
  const isSelf = String(user._id) === String(req.user._id);
  if (req.body?.name !== undefined) user.name = text(req.body.name, 80);
  if (req.body?.role !== undefined) {
    if (!ROLES.includes(req.body.role)) throw badRequest('Unknown role.');
    if (isSelf && req.body.role !== SUPER_ADMIN) throw badRequest('You cannot remove your own Super admin role.');
    user.role = req.body.role;
  }
  if (req.body?.active !== undefined) {
    if (isSelf && !req.body.active) throw badRequest('You cannot deactivate your own account.');
    user.active = Boolean(req.body.active);
  }
  if (req.body?.password) {
    if (String(req.body.password).length < 8) throw badRequest('The password must be at least 8 characters.');
    user.password = String(req.body.password);
  }
  await user.save();
  res.json(user);
});

router.delete('/:id', async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw badRequest('You cannot delete your own account.');
  if (!(await User.destroy({ where: { id: toId(req.params.id) } }))) throw notFound('User not found.');
  res.status(204).end();
});

export default router;
