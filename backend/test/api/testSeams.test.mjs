// The test-only seams must exist under NODE_ENV=test and nowhere else.
import { describe, it, expect, beforeEach, afterAll, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, pool, resetDatabase, count } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '../..');

beforeEach(resetDatabase);
afterAll(() => pool.end());

describe('test outbox route (NODE_ENV=test only)', () => {
  it('returns the latest link sent to an address', async () => {
    await api().post('/auth/register').send({ email: 'seam@gmail.com', password: 'long-enough-pass', honeypot: '', formRenderedAt: Date.now() - 5000 });
    const res = await api().get('/__test__/outbox?to=seam@gmail.com');
    expect(res.status).toBe(200);
    expect(res.body.link).toMatch(/\/verify-email\?token=[0-9a-f]{64}$/);
  });

  it('is a 404 for an address with no mail', async () => {
    expect((await api().get('/__test__/outbox?to=nobody@gmail.com')).status).toBe(404);
  });

  it.each(['production', 'development'])('is not mounted at all when NODE_ENV=%s', (env) => {
    // A separate Node process, so this process's NODE_ENV=test can't leak in.
    const script = `
      process.env.NODE_ENV = '${env}';
      process.env.DATABASE_URL = 'postgres://x:y@127.0.0.1:1/unused';
      process.env.JWT_SECRET = 's'; process.env.CLIENT_ORIGIN = 'https://example.invalid';
      process.env.ALLOWED_ORIGINS = 'https://example.invalid';
      process.env.BREVO_API_KEY = 'k'; process.env.BREVO_SENDER_EMAIL = 'a@example.invalid';
      const { createApp } = require('./src/app');
      const pool = require('./src/db');
      const srv = createApp().listen(0, async () => {
        const res = await fetch('http://127.0.0.1:' + srv.address().port + '/__test__/outbox?to=a@gmail.com');
        console.log('STATUS', res.status, JSON.stringify(await res.json()));
        srv.close(); await pool.end();
      });
    `;
    const out = spawnSync(process.execPath, ['-e', script], { cwd: backendDir, encoding: 'utf8', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } });
    expect(out.stdout).toContain('STATUS 404 {"error":"Not found"}');
  });

  it('refuses to build the test router outside NODE_ENV=test', () => {
    const { createTestRouter } = require('../../src/testing/testRoutes.js');
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => createTestRouter()).toThrow(/NODE_ENV=test/);
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});

describe('BOT_MIN_SUBMIT_MS (NODE_ENV=test only)', () => {
  const original = process.env.BOT_MIN_SUBMIT_MS;
  afterEach(() => {
    if (original === undefined) delete process.env.BOT_MIN_SUBMIT_MS;
    else process.env.BOT_MIN_SUBMIT_MS = original;
  });

  it('shortens the minimum time under test', async () => {
    process.env.BOT_MIN_SUBMIT_MS = '100';
    await api().post('/auth/register').send({ email: 'quick@gmail.com', password: 'long-enough-pass', honeypot: '', formRenderedAt: Date.now() - 400 });
    expect(await count('SELECT COUNT(*) FROM users WHERE email = $1', ['quick@gmail.com'])).toBe(1);
  });

  it('is ignored outside NODE_ENV=test, so the full 1.5 seconds applies', async () => {
    process.env.BOT_MIN_SUBMIT_MS = '0';
    process.env.NODE_ENV = 'production';
    try {
      await api().post('/auth/register').send({ email: 'tooquick@gmail.com', password: 'long-enough-pass', honeypot: '', formRenderedAt: Date.now() - 400 });
    } finally {
      process.env.NODE_ENV = 'test';
    }
    expect(await count('SELECT COUNT(*) FROM users WHERE email = $1', ['tooquick@gmail.com'])).toBe(0);
  });

  it('does not weaken the honeypot', async () => {
    process.env.BOT_MIN_SUBMIT_MS = '0';
    await api().post('/auth/register').send({ email: 'bot@gmail.com', password: 'long-enough-pass', honeypot: 'x', formRenderedAt: Date.now() - 5000 });
    expect(await count('SELECT COUNT(*) FROM users WHERE email = $1', ['bot@gmail.com'])).toBe(0);
  });
});
