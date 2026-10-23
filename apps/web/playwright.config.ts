import { defineConfig, devices } from '@playwright/test';

/**
 * e2e/acceptance: motion choreography, layout, accessibility and flows on the built app (no server needed).
 * e2e/parity: the app against the original prototype in docs/prototype.
 * e2e/sync: two devices through the real API (needs E2E_API=1 and a database; see docs/testing.md).
 */
const withApi = !!process.env.E2E_API;
export const OUTBOX = new URL('./test-results/outbox', import.meta.url).pathname;

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  fullyParallel: true,
  // the sculpture renders in software on CI machines, so a few workers at a time keep timings honest
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: { args: ['--disable-gpu', '--allow-file-access-from-files'] },
    deviceScaleFactor: 1,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 },
      testIgnore: withApi ? [] : ['sync.spec.ts'],
    },
  ],
  webServer: [
    {
      command: 'pnpm build && pnpm preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    ...(withApi
      ? [
          {
            command: 'pnpm --filter @daroon/api build && node ../api/dist/server.js',
            url: 'http://localhost:8787/api/health',
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: {
              PORT: '8787',
              APP_ORIGIN: 'http://localhost:4173',
              AUTH_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e',
              DATABASE_URL: process.env.DATABASE_URL ?? '',
              LOG_LEVEL: 'warn',
              AUTH_RATE_LIMIT: '1000',
              MAIL_OUTBOX: OUTBOX,
            },
          },
        ]
      : []),
  ],
});
