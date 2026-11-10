// The API as the browser tests (Playwright) see it: the real app, with
// NODE_ENV=test, on a throwaway local Postgres. Started and stopped by
// frontend/playwright.config.js. Never reads backend/.env, never touches
// the live database, never sends email (it goes to the in-memory outbox).
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { startTestDatabase } from '../test/support/testDatabase.mjs';
import { reapOrphanedTestPostgres } from '../test/support/reapOrphans.mjs';

const PORT = Number(process.env.E2E_API_PORT || 4100);
const FRONTEND_ORIGIN = process.env.E2E_FRONTEND_ORIGIN || 'http://localhost:5174';

process.env.NODE_ENV = 'test';
delete process.env.DATABASE_URL;
delete process.env.BREVO_API_KEY;
delete process.env.BREVO_SENDER_EMAIL;
process.env.JWT_SECRET = 'e2e-only-secret-not-used-anywhere-else';
process.env.CLIENT_ORIGIN = FRONTEND_ORIGIN;
process.env.ALLOWED_ORIGINS = FRONTEND_ORIGIN;
// Browser tests fill the sign-up form faster than a person; keep the check
// on, just shorter (honoured only under NODE_ENV=test).
process.env.BOT_MIN_SUBMIT_MS = process.env.BOT_MIN_SUBMIT_MS || '300';

// A fixed folder per port, cleared on start (stopping any Postgres a
// killed earlier run left behind in it), so old databases can't pile up.
const reaped = reapOrphanedTestPostgres();
if (reaped.length > 0) console.log(`Stopped ${reaped.length} leftover test Postgres process(es) from an earlier run.`);
const db = await startTestDatabase({
  dbName: `onyx_vault_e2e_${PORT}_test`,
  dataDir: path.join(os.tmpdir(), `onyx-vault-e2e-pg-${PORT}`),
  // In CI (one shared Postgres service), each test server gets its own database.
  separate: true,
});
process.env.TEST_DATABASE_URL = db.url;

const require = createRequire(import.meta.url);
const { createApp } = require('../src/app.js');
const pool = require('../src/db.js');

const server = createApp().listen(PORT, '127.0.0.1', () => {
  console.log(`E2E API ready on http://127.0.0.1:${PORT} (test database ${new URL(db.url).pathname.slice(1)})`);
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.close();
  await pool.end().catch(() => {});
  await db.stop().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
