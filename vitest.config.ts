import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': ROOT,
    },
  },
  test: {
    environment: 'node',
    pool: 'forks',
    include: ['tests/unit/**/*.test.{ts,js}', 'tests/integration/**/*.test.{ts,js}'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      VITEST: 'true',
      DB_DIALECT: 'sqlite',
      DB_STORAGE: ':memory:',
      LOG_LEVEL: 'silent',
      BACKUP_ENABLED: 'false',
      MAIL_TRANSPORT: 'memory',
      WHATSAPP_TRANSPORT: 'memory',
      OTP_TRANSPORT: 'memory',
      SMS_TRANSPORT: 'memory',
      CORS_ORIGINS: 'http://localhost:3000',
    },
  },
});
