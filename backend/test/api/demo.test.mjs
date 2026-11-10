// "Try the demo": throwaway accounts with made-up data, kept apart from
// each other and from real accounts, deleted on "End demo" or after 24
// hours, and unable to send email or change a password.
import { describe, it, expect, beforeEach, afterAll, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import {
  api, pool, resetDatabase, createUser, createAccount, createTransaction, sessionCookieFrom, uniqueIp, testOutbox, count,
} from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { cleanupExpiredDemos, DEMO_TTL_HOURS } = require('../../src/demo/demoAccounts.js');
const { SESSION_TTL_SECONDS } = require('../../src/auth/sessions.js');
const { send } = require('../../src/email.js');

async function startDemo(ip = uniqueIp()) {
  const res = await api(undefined, { ip }).post('/auth/demo');
  return { res, cookie: sessionCookieFrom(res), as: () => api(undefined, { cookie: sessionCookieFrom(res), ip }) };
}

async function rowsFor(userId) {
  return {
    users: await count('SELECT COUNT(*) FROM users WHERE id = $1', [userId]),
    accounts: await count('SELECT COUNT(*) FROM accounts WHERE user_id = $1', [userId]),
    categories: await count('SELECT COUNT(*) FROM categories WHERE user_id = $1', [userId]),
    transactions: await count('SELECT COUNT(*) FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE a.user_id = $1', [userId]),
    rules: await count('SELECT COUNT(*) FROM recurring_transactions WHERE user_id = $1', [userId]),
    sessions: await count('SELECT COUNT(*) FROM sessions WHERE user_id = $1', [userId]),
  };
}

const originalMax = process.env.MAX_LIVE_DEMOS;
beforeEach(resetDatabase);
afterEach(() => {
  if (originalMax === undefined) delete process.env.MAX_LIVE_DEMOS;
  else process.env.MAX_LIVE_DEMOS = originalMax;
});
afterAll(() => pool.end());

describe('starting a demo', () => {
  it('creates a signed-in throwaway account with no email or password, full of made-up data', async () => {
    const demo = await startDemo();
    expect(demo.res.status).toBe(201);
    expect(demo.res.body.user).toMatchObject({ id: expect.any(Number), isDemo: true, demoExpiresAt: expect.any(String) });
    expect(demo.cookie).toBeTruthy();

    const me = await demo.as().get('/auth/me');
    expect(me.body.user).toMatchObject({ isDemo: true, email: null });

    const { rows: [user] } = await pool.query('SELECT email, is_demo, email_verified, password_hash FROM users WHERE id = $1', [demo.res.body.user.id]);
    expect(user.email).toMatch(/^demo-[0-9a-f-]{36}@demo\.onyx-vault\.invalid$/);
    expect(user).toMatchObject({ is_demo: true, email_verified: true });
    expect(user.password_hash).not.toMatch(/^\$2/); // not a bcrypt hash: no password can match it

    const rows = await rowsFor(demo.res.body.user.id);
    expect(rows).toMatchObject({ accounts: 2, rules: 2, sessions: 1 });
    expect(rows.categories).toBeGreaterThanOrEqual(6);
    expect(rows.transactions).toBeGreaterThan(60);
  });

  it('the data looks real to the app: months of transactions, balances that add up, rules due later', async () => {
    const demo = await startDemo();
    const accounts = (await demo.as().get('/accounts')).body;
    for (const account of accounts) {
      const { rows: [{ sum }] } = await pool.query("SELECT COALESCE(SUM(amount), 0)::numeric(14,2)::text AS sum FROM transactions WHERE account_id = $1", [account.id]);
      expect(account.balance).toBe(sum);
    }
    const page = (await demo.as().get('/transactions?page=1&limit=5')).body;
    expect(page.total).toBeGreaterThan(60);
    const rules = (await demo.as().get('/recurring')).body;
    const { rows: [{ today }] } = await pool.query("SELECT ((NOW() AT TIME ZONE 'UTC')::date)::text AS today");
    expect(rules.every((r) => r.next_run_date > today)).toBe(true);
    // Starting the demo posts nothing extra (nothing was due).
    expect((await demo.as().post('/recurring/run-now')).body).toEqual({ processed: 0 });
  });

  it('lasts 24 hours, and its session lasts exactly as long', async () => {
    const demo = await startDemo();
    const { rows: [r] } = await pool.query(
      `SELECT EXTRACT(EPOCH FROM (u.demo_expires_at - s.created_at))::int AS demo_seconds,
              EXTRACT(EPOCH FROM (s.expires_at - s.created_at))::int AS session_seconds
       FROM users u JOIN sessions s ON s.user_id = u.id WHERE u.id = $1`,
      [demo.res.body.user.id]
    );
    expect(DEMO_TTL_HOURS * 3600).toBe(SESSION_TTL_SECONDS);
    expect(Math.abs(r.demo_seconds - 86400)).toBeLessThanOrEqual(2);
    expect(r.session_seconds).toBe(86400);
  });

  it('works without any request body (it’s a single button)', async () => {
    expect((await api().post('/auth/demo')).status).toBe(201);
  });
});

describe('demos are kept apart', () => {
  it("one demo can't see, change or delete another's data", async () => {
    const a = await startDemo();
    const b = await startDemo();
    const aTransactions = (await a.as().get('/transactions?page=1&limit=1')).body.transactions;
    const aAccount = (await a.as().get('/accounts')).body[0];

    expect((await b.as().get(`/transactions/${aTransactions[0].id}`)).status).toBe(404);
    expect((await b.as().delete(`/transactions/${aTransactions[0].id}`)).status).toBe(404);
    expect((await b.as().get(`/accounts/${aAccount.id}`)).status).toBe(404);
    expect((await b.as().post('/transactions').send({ account_id: aAccount.id, amount: '-1.00', date: '2026-10-01' })).status).toBe(404);

    const bAccounts = (await b.as().get('/accounts')).body;
    expect(bAccounts.map((x) => x.id)).not.toContain(aAccount.id);
  });

  it('a change in one demo does not appear in another', async () => {
    const a = await startDemo();
    const b = await startDemo();
    const account = (await a.as().get('/accounts')).body[0];
    await a.as().post('/transactions').send({ account_id: account.id, amount: '-7.77', description: 'Only in demo A', date: '2026-10-01' });

    const bList = (await b.as().get('/transactions')).body;
    expect(bList.some((t) => t.description === 'Only in demo A')).toBe(false);
  });
});

describe('ending a demo', () => {
  it('"End demo" (logout) deletes the demo account and every row it had, straight away', async () => {
    const demo = await startDemo();
    const id = demo.res.body.user.id;
    const res = await demo.as().post('/auth/logout');
    expect(res.status).toBe(200);
    expect(Object.values(await rowsFor(id)).every((n) => n === 0)).toBe(true);
    expect((await demo.as().get('/accounts')).status).toBe(401);
  });

  it('ending one demo leaves other demos and real accounts alone', async () => {
    const real = await createUser();
    await createTransaction((await createAccount(real.id)).id);
    const keep = await startDemo();
    const end = await startDemo();
    const before = { real: await rowsFor(real.id), keep: await rowsFor(keep.res.body.user.id) };

    await end.as().post('/auth/logout');

    expect(await rowsFor(real.id)).toEqual(before.real);
    expect(await rowsFor(keep.res.body.user.id)).toEqual(before.keep);
  });

  it('a real account logging out is not deleted', async () => {
    const real = await createUser();
    await api(undefined, { cookie: real.cookie }).post('/auth/logout');
    expect(await count('SELECT COUNT(*) FROM users WHERE id = $1', [real.id])).toBe(1);
  });
});

describe('clean-up after 24 hours', () => {
  async function expire(userId) {
    await pool.query("UPDATE users SET demo_expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [userId]);
  }

  it('deletes expired demos with all their data, keeps live demos and every real account', async () => {
    const real = await createUser();
    await createTransaction((await createAccount(real.id)).id);
    const live = await startDemo();
    const old = await startDemo();
    await expire(old.res.body.user.id);
    const realBefore = await rowsFor(real.id);

    expect(await cleanupExpiredDemos()).toBe(1);
    expect(Object.values(await rowsFor(old.res.body.user.id)).every((n) => n === 0)).toBe(true);
    expect((await rowsFor(live.res.body.user.id)).users).toBe(1);
    expect(await rowsFor(real.id)).toEqual(realBefore);
  });

  it('runs whenever a new demo begins', async () => {
    const old = await startDemo();
    await expire(old.res.body.user.id);
    await startDemo();
    expect(await count('SELECT COUNT(*) FROM users WHERE id = $1', [old.res.body.user.id])).toBe(0);
  });

  it('an expired demo is signed out even before the clean-up runs', async () => {
    const demo = await startDemo();
    await pool.query("UPDATE sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE user_id = $1", [demo.res.body.user.id]);
    expect((await demo.as().get('/accounts')).status).toBe(401);
  });

  it('never touches real accounts, however old', async () => {
    const real = await createUser();
    await pool.query("UPDATE users SET created_at = NOW() - INTERVAL '5 years' WHERE id = $1", [real.id]);
    expect(await cleanupExpiredDemos()).toBe(0);
    expect(await count('SELECT COUNT(*) FROM users')).toBe(1);
  });
});

describe('the database rule that protects real accounts', () => {
  it('a real account can never be marked as a demo', async () => {
    const real = await createUser();
    await expect(pool.query("UPDATE users SET is_demo = TRUE, demo_expires_at = NOW() - INTERVAL '1 day', email = 'x@demo.onyx-vault.invalid' WHERE id = $1", [real.id]))
      .rejects.toThrow(/cannot be switched between real and demo/);
  });

  it('a real account can never be given a demo (.invalid) address or an expiry', async () => {
    const real = await createUser();
    await expect(pool.query("UPDATE users SET email = 'someone@demo.onyx-vault.invalid' WHERE id = $1", [real.id]))
      .rejects.toThrow(/users_demo_shape_check/);
    await expect(pool.query("UPDATE users SET demo_expires_at = NOW() WHERE id = $1", [real.id]))
      .rejects.toThrow(/users_demo_shape_check/);
  });

  it('a demo account can never be turned into a real one', async () => {
    const demo = await startDemo();
    await expect(pool.query('UPDATE users SET is_demo = FALSE WHERE id = $1', [demo.res.body.user.id]))
      .rejects.toThrow(/cannot be switched/);
  });

  it('a demo must have a demo address and an expiry', async () => {
    await expect(pool.query("INSERT INTO users (email, password_hash, is_demo, demo_expires_at) VALUES ('a@gmail.com', 'x', TRUE, NOW())"))
      .rejects.toThrow(/users_demo_shape_check/);
    await expect(pool.query("INSERT INTO users (email, password_hash, is_demo) VALUES ('d@demo.onyx-vault.invalid', 'x', TRUE)"))
      .rejects.toThrow(/users_demo_shape_check/);
  });
});

describe('what a demo cannot do', () => {
  const DEMO_ADDRESS = 'demo-00000000-0000-0000-0000-000000000000@demo.onyx-vault.invalid';

  it.each([
    ['request a password reset', '/auth/forgot-password'],
    ['request a verification email', '/auth/resend-verification'],
  ])('%s (403, and nothing is sent)', async (_label, path) => {
    const res = await api().post(path).send({ email: DEMO_ADDRESS });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/can’t receive email or reset a password/);
    expect(testOutbox).toHaveLength(0);
  });

  it('reset its password, even with a reset token (403)', async () => {
    const demo = await startDemo();
    const crypto = await import('node:crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await pool.query("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')", [demo.res.body.user.id, hash]);
    const res = await api().post('/auth/reset-password').send({ token, password: 'a-new-password' });
    expect(res.status).toBe(403);
  });

  it('delete itself with a password (403: it has none; "End demo" does that)', async () => {
    const demo = await startDemo();
    const res = await demo.as().delete('/auth/account').send({ password: 'anything-at-all' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/End demo/);
    expect(await count('SELECT COUNT(*) FROM users WHERE id = $1', [demo.res.body.user.id])).toBe(1);
  });

  it('be signed into with an email and password', async () => {
    const demo = await startDemo();
    const { rows: [{ email }] } = await pool.query('SELECT email FROM users WHERE id = $1', [demo.res.body.user.id]);
    const res = await api().post('/auth/login').send({ email, password: '!demo-account-has-no-password' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid email or password' });
  });

  it('receive any email at all: the mailer refuses .invalid addresses', async () => {
    await expect(send({ to: DEMO_ADDRESS, subject: 'x', html: 'x' })).rejects.toThrow(/Refusing to send email to a \.invalid/);
    expect(testOutbox).toHaveLength(0);
  });
});

describe('limits', () => {
  it('starting demos is rate-limited per address (5 an hour)', async () => {
    const ip = uniqueIp();
    const statuses = [];
    for (let i = 0; i < 6; i += 1) statuses.push((await api(undefined, { ip }).post('/auth/demo')).status);
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });

  it('when the cap on live demos is reached, the next visitor gets a friendly "demo busy"', async () => {
    process.env.MAX_LIVE_DEMOS = '2';
    await startDemo();
    await startDemo();
    const res = (await startDemo()).res;
    expect(res.status).toBe(503);
    expect(res.headers['retry-after']).toBe('300');
    expect(res.body).toEqual({ error: 'The demo is busy right now. Please try again in a few minutes.' });
    expect(await count('SELECT COUNT(*) FROM users WHERE is_demo')).toBe(2);
  });

  it('expired demos don’t count towards the cap', async () => {
    process.env.MAX_LIVE_DEMOS = '1';
    const old = await startDemo();
    await pool.query("UPDATE users SET demo_expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [old.res.body.user.id]);
    expect((await startDemo()).res.status).toBe(201);
  });

  it('visitors arriving at the same moment cannot exceed the cap', async () => {
    process.env.MAX_LIVE_DEMOS = '3';
    const results = await Promise.all(Array.from({ length: 8 }, () => api().post('/auth/demo')));
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 503)).toHaveLength(5);
    expect(await count('SELECT COUNT(*) FROM users WHERE is_demo')).toBe(3);
  });

  it('real accounts never count towards the cap', async () => {
    process.env.MAX_LIVE_DEMOS = '1';
    await createUser();
    await createUser();
    expect((await startDemo()).res.status).toBe(201);
  });
});
