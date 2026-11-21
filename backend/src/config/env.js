import 'dotenv/config';

const production = process.env.NODE_ENV === 'production';

if (production && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in production.');
}

export const env = {
  production,
  port: Number(process.env.PORT) || 5000,
  // MySQL. DB_URL (mysql://user:pass@host:3306/db) wins over the separate DB_* settings.
  db: {
    dialect: process.env.DB_DIALECT || 'mysql',
    url: process.env.DB_URL || '',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME || 'oasis_resort',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    // sqlite is only used by the automated tests (a file path, or :memory:)
    storage: process.env.DB_STORAGE || ':memory:',
    ssl: process.env.DB_SSL === 'true',
  },
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me-before-deploying',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  timezone: process.env.HOTEL_TIMEZONE || 'Asia/Karachi',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@oasisresort.pk',
  adminPassword: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
  // Links in emails: where the website and the admin portal live.
  siteUrl: (process.env.SITE_URL || (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0]).trim().replace(/\/$/, ''),
  // Staff password-reset links open the admin portal: ADMIN_URL, or FRONTEND_URL if that is what you set.
  adminUrl: (process.env.ADMIN_URL || process.env.FRONTEND_URL || 'http://localhost:5174').trim().replace(/\/$/, ''),
  mail: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    // true for port 465, false for 587/25 (STARTTLS is negotiated automatically).
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    // Gmail and most providers only accept the signed-in address as the sender.
    from: process.env.MAIL_FROM || process.env.EMAIL_FROM || (process.env.SMTP_USER ? `Oasis Resort Skardu <${process.env.SMTP_USER}>` : 'Oasis Resort Skardu <no-reply@oasisresort.pk>'),
    // Who hears about new bookings, enquiries and feedback. Comma separated.
    adminTo: (process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || 'admin@oasisresort.pk').split(',').map((e) => e.trim()).filter(Boolean),
  },
};
