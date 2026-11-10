// Runs in each test process before the test file is loaded. Sets a
// self-contained test environment so nothing from backend/.env (which
// points at the live database and real email provider) can leak in.
import { inject, vi } from 'vitest';

process.env.NODE_ENV = 'test';
delete process.env.DATABASE_URL;
process.env.TEST_DATABASE_URL = inject('testDatabaseUrl');
process.env.JWT_SECRET = 'test-only-secret-not-used-anywhere-else';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
// No email provider settings at all: under NODE_ENV=test, email.js writes
// to an in-memory outbox and must not need them.
delete process.env.BREVO_API_KEY;
delete process.env.BREVO_SENDER_EMAIL;

// Belt and braces: any attempt to reach the real email API fails the test
// loudly instead of sending anything.
const realFetch = globalThis.fetch;
vi.stubGlobal('fetch', (input, init) => {
  const target = String(input?.url ?? input);
  if (target.includes('brevo.com')) {
    throw new Error(`Test tried to call the email provider: ${target}`);
  }
  return realFetch(input, init);
});
