import { defineConfig, devices } from '@playwright/test';

const E2E_PORT = 3100;
const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `rm -f /tmp/oasis_e2e_playwright.sqlite && PORT=${E2E_PORT} APP_URL=${E2E_BASE_URL} DB_DIALECT=sqlite DB_STORAGE=/tmp/oasis_e2e_playwright.sqlite LOG_LEVEL=silent BACKUP_ENABLED=false MAIL_TRANSPORT=memory WHATSAPP_TRANSPORT=memory OTP_TRANSPORT=memory npx tsx server.ts`,
    url: `${E2E_BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
