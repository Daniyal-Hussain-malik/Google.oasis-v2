// Sends one test email with the settings in backend/.env:
//   npm run mail:test -- someone@example.com
// With no address it writes to ADMIN_NOTIFY_EMAIL.
import { env } from '../config/env.js';
import { mailMode, sendMail, verifyMail } from '../services/mail.js';

const to = process.argv[2] || env.mail.adminTo[0];
console.log(`Mode: ${mailMode}${mailMode === 'smtp' ? ` (${env.mail.host}:${env.mail.port}, secure=${env.mail.secure}, user=${env.mail.user || 'none'})` : ''}`);
console.log(`From: ${env.mail.from}`);

const check = await verifyMail();
if (!check.ok) {
  console.error(`FAILED: ${check.error}`);
  process.exit(1);
}
try {
  const info = await sendMail({
    to,
    subject: 'Oasis Resort email test',
    text: 'If you can read this, nodemailer is sending email correctly.',
    html: '<p>If you can read this, <b>nodemailer</b> is sending email correctly.</p>',
  });
  console.log(mailMode === 'smtp' ? `Sent to ${to}. Server said: ${info.response}` : `Not sent (mode ${mailMode}). Set SMTP_HOST in backend/.env.`);
  process.exit(mailMode === 'smtp' ? 0 : 1);
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  process.exit(1);
}
