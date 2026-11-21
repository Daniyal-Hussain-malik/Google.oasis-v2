import { Router } from 'express';
import { ACCESS } from '../../config/roles.js';
import { requireRole } from '../../middleware/auth.js';
import { DEFAULT_WHATSAPP_TEMPLATES, WhatsAppConfig, WhatsAppMessageLog } from '../../models/WhatsApp.js';
import {
  getWhatsAppConfig,
  sendGuestUpdateWhatsApp,
  sendWhatsAppMessage,
  updateWhatsAppConfig,
} from '../../services/whatsapp.js';
import { badRequest, text } from '../../utils/http.js';

const router = Router();
const managers = requireRole(...ACCESS.superAdmin);

router.get('/overview', async (req, res) => {
  const [config, logs, allRows] = await Promise.all([
    getWhatsAppConfig({ includeSecrets: false }),
    WhatsAppMessageLog.findAll({ order: [['createdAt', 'DESC']], limit: 60 }),
    WhatsAppMessageLog.findAll({ attributes: ['status', 'direction'], raw: true }),
  ]);

  const counts = { total: allRows.length, sent: 0, delivered: 0, read: 0, dryRun: 0, failed: 0, inbound: 0 };
  for (const row of allRows) {
    if (row.direction === 'inbound') counts.inbound += 1;
    if (row.status === 'sent') counts.sent += 1;
    else if (row.status === 'delivered') counts.delivered += 1;
    else if (row.status === 'read') counts.read += 1;
    else if (row.status === 'dry_run') counts.dryRun += 1;
    else if (row.status === 'failed') counts.failed += 1;
  }

  res.json({
    config,
    defaultTemplates: DEFAULT_WHATSAPP_TEMPLATES,
    stats: counts,
    logs: logs.map((l) => l.toJSON()),
  });
});

router.put('/config', managers, async (req, res) => {
  const updated = await updateWhatsAppConfig(req.body || {});
  res.json(updated);
});

router.post('/test', async (req, res) => {
  const phone = String(req.body?.phone || '').trim();
  if (!phone) throw badRequest('Enter a WhatsApp test phone number (e.g. +923445537788).');

  const customText = text(req.body?.message, 1000)
    || 'Oasis Resort Skardu: WhatsApp Business Cloud API test alert succeeded.';

  const result = await sendWhatsAppMessage({
    toPhone: phone,
    recipientName: text(req.body?.recipientName, 80) || 'Desk Test',
    eventType: 'test',
    textBody: customText,
    forceMode: 'text',
  });

  await WhatsAppConfig.update({ lastTestedAt: new Date() }, { where: { key: 'default' } }).catch(() => {});
  res.json(result);
});

router.post('/send-update', async (req, res) => {
  const body = req.body || {};
  const result = await sendGuestUpdateWhatsApp({
    reservationId: body.reservationId,
    bookingNumber: body.bookingNumber,
    phone: body.phone,
    recipientName: body.recipientName,
    message: body.message,
  });
  res.status(result.ok ? 201 : 502).json(result);
});

export default router;
