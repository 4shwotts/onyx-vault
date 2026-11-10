// Browser tests. Playwright starts two servers of its own:
// - the API with NODE_ENV=test on a throwaway local Postgres
//   (backend/scripts/e2e-server.mjs), never the live database;
// - the Vite dev server, proxying /api to that API.
// It refuses to run against anything but localhost.
import { defineConfig, devices } from '@playwright/test';

const FRONTEND_PORT = 5174;
const API_PORT = 4100;
const baseURL = `http://localhost:${FRONTEND_PORT}`;

// A second, separate pair of servers with public sign-up switched OFF (as
// on the live site), for e2e/signup-closed/.
const CLOSED_FRONTEND_PORT = 5176;
const CLOSED_API_PORT = 4102;
const closedBaseURL = `http://localhost:${CLOSED_FRONTEND_PORT}`;

for (const url of [baseURL, closedBaseURL]) {
  if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(url)) {
    throw new Error(`Refusing to run browser tests against ${url}: localhost only.`);
  }
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    // Still graphics and no CSS animation by default, so screenshots and
    // timings are steady. e2e/graphics.spec.js covers the animated path.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /(devices|signup-closed)\//,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'signup-closed',
      testMatch: /signup-closed\/.*\.spec\.js/,
      use: { ...devices['Desktop Chrome'], baseURL: closedBaseURL },
    },
    {
      name: 'devices-chromium',
      testMatch: /devices\/.*\.spec\.js/,
      use: { browserName: 'chromium' },
    },
    {
      name: 'devices-webkit',
      testMatch: /devices\/.*\.spec\.js/,
      use: { browserName: 'webkit' },
    },
  ],
  webServer: [
    {
      command: 'node ../backend/scripts/e2e-server.mjs',
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      env: { E2E_API_PORT: String(API_PORT), E2E_FRONTEND_ORIGIN: baseURL },
    },
    {
      command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}` },
    },
    {
      command: 'node ../backend/scripts/e2e-server.mjs',
      url: `http://127.0.0.1:${CLOSED_API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      env: { E2E_API_PORT: String(CLOSED_API_PORT), E2E_FRONTEND_ORIGIN: closedBaseURL, PUBLIC_SIGNUP_ENABLED: 'false' },
    },
    {
      command: `npx vite --port ${CLOSED_FRONTEND_PORT} --strictPort`,
      url: closedBaseURL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${CLOSED_API_PORT}` },
    },
  ],
});
