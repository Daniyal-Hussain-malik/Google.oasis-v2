import { Router } from 'express';
import { ACCESS } from '../../config/roles.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import blog from './blog.js';
import content from './content.js';
import ota from './ota.js';
import paymentClaims from './paymentClaims.js';
import reports from './reports.js';
import reservations from './reservations.js';
import restaurant from './restaurant.js';
import rooms from './rooms.js';
import system from './system.js';
import users from './users.js';
import whatsapp from './whatsapp.js';

const router = Router();

router.use(requireAuth);
// The restaurant router sets its own roles per route (the kitchen role lives here only).
router.use('/restaurant', restaurant);
router.use('/users', requireRole(...ACCESS.superAdmin), users);
// Everything below is front-office work; chefs stop here.
router.use(requireRole(...ACCESS.frontOffice));
router.use('/reservations', reservations);
router.use('/blog', requireRole(...ACCESS.superAdmin), blog);
router.use('/system', requireRole(...ACCESS.superAdmin), system);
router.use('/payment-claims', paymentClaims);
router.use('/ota', ota);
router.use('/whatsapp', whatsapp);
router.use(rooms);
router.use(content);
router.use(reports);

export default router;
