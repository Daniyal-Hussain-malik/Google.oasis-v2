import { Router } from 'express';
import { getBackupStatus, listBackups, resolveBackupDownloadPath, runDatabaseBackup } from '../../services/backup.js';
import { checkSystemHealth, sendUptimeAlert } from '../../services/monitoring.js';

const router = Router();

router.get('/status', async (_req, res) => {
  const health = await checkSystemHealth();
  res.json(health);
});

router.get('/backups', async (_req, res) => {
  const [status, items] = await Promise.all([getBackupStatus(), listBackups()]);
  res.json({ status, items });
});

router.post('/backups/run', async (req, res) => {
  const result = await runDatabaseBackup({ triggeredBy: `admin:${req.user?.email || 'manual'}` });
  res.status(201).json(result);
});

router.get('/backups/:filename', async (req, res) => {
  const filePath = await resolveBackupDownloadPath(req.params.filename);
  res.download(filePath, req.params.filename);
});

router.post('/alerts/test', async (req, res) => {
  const result = await sendUptimeAlert({
    key: 'manual_test',
    severity: 'info',
    title: 'Manual Uptime Alert Verification',
    message: `Triggered from Admin System Console by ${req.user?.email || 'super_admin'}.`,
    details: { environment: process.env.NODE_ENV || 'development' },
    force: true,
  });
  res.json(result);
});

export default router;
