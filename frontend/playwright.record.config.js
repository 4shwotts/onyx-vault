// Records the README's sign-up animation (npm run record:signup). Not part
// of the test run. Uses the same throwaway local servers as the browser
// tests, never the live site.
import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

export default defineConfig({
  testDir: './e2e-recording',
  testMatch: /.*\.record\.js/,
  timeout: 120_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: base.use.baseURL, reducedMotion: 'reduce' },
  // Only the first API + frontend pair (sign-up open).
  webServer: base.webServer.slice(0, 2),
});
