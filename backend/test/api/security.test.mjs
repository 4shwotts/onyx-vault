// Injection, client-set fields, cross-site writes, security headers and
// leaks of secrets.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  api, pool, resetDatabase, createUser, createAccount, createTransaction, count, SECRET_PATTERNS, ALLOWED_ORIGIN,
} from '../helpers.mjs';

let user;
let account;
const me = (opts = {}) => api(undefined, { cookie: user.cookie, ...opts });

beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
  account = await createAccount(user.id);
});
afterAll(() => pool.end());

const INJECTIONS = [
  "'); DROP TABLE users; --",
  "' OR '1'='1",
  '1; DELETE FROM transactions',
  "Robert'); DROP TABLE accounts;--",
  '$1',
  '\\x00',
];

describe('SQL injection', () => {
  it.each(INJECTIONS)('a description of %j is stored as plain text', async (text) => {
    const res = await me().post('/transactions').send({ account_id: account.id, amount: '-1.00', date: '2026-10-01', description: text });
    expect(res.status).toBe(201);
    const { rows } = await pool.query('SELECT description FROM transactions WHERE id = $1', [res.body.id]);
    expect(rows[0].description).toBe(text);
    expect(await count('SELECT COUNT(*) FROM users')).toBe(1);
  });

  it.each(INJECTIONS)('a category name of %j is stored as plain text', async (text) => {
    const res = await me().post('/categories').send({ name: text.slice(0, 40) });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe(text.slice(0, 40).trim());
  });

  it.each(INJECTIONS)('a login email of %j is just a failed login', async (text) => {
    const res = await api().post('/auth/login').send({ email: text, password: text });
    expect([400, 401]).toContain(res.status);
    expect(await count('SELECT COUNT(*) FROM users')).toBe(1);
  });

  it('the tables are all still there', async () => {
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'");
    expect(rows[0].n).toBeGreaterThanOrEqual(7);
  });
});

describe('fields only the server may set', () => {
  it.each([
    ['/transactions', { user_id: 999 }],
    ['/transactions', { is_anomaly: false }],
    ['/transactions', { is_recurring: true }],
    ['/transactions', { id: 1 }],
    ['/accounts', { balance: '1000000.00' }],
    ['/accounts', { user_id: 999 }],
    ['/categories', { user_id: 999 }],
    ['/recurring', { next_run_date: '2026-01-01' }],
    ['/recurring', { user_id: 999 }],
  ])('POST %s with %j is refused', async (path, extra) => {
    const base = {
      '/transactions': { account_id: account.id, amount: '-1.00', date: '2026-10-01' },
      '/accounts': { name: 'Savings', type: 'savings' },
      '/categories': { name: 'Bills' },
      '/recurring': { account_id: account.id, amount: '-1.00', frequency: 'monthly', start_date: '2099-01-01' },
    }[path];
    const res = await me().post(path).send({ ...base, ...extra });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unexpected field/);
  });

  it('a new account always starts at £0.00', async () => {
    const res = await me().post('/accounts').send({ name: 'Savings', type: 'savings' });
    expect(res.body.balance).toBe('0.00');
  });

  it('a balance cannot be edited directly through a transaction update', async () => {
    const tx = await createTransaction(account.id);
    const res = await me().put(`/transactions/${tx.id}`).send({ balance: '5000.00' });
    expect(res.status).toBe(400);
  });
});

describe('cross-site writes', () => {
  const EVIL = 'https://evil.example';

  it.each([
    ['POST', '/transactions', { account_id: 0, amount: '-1.00', date: '2026-10-01' }],
    ['POST', '/accounts', { name: 'X', type: 'current' }],
    ['POST', '/recurring/run-now', undefined],
    ['POST', '/auth/logout', undefined],
    ['DELETE', '/accounts/1', undefined],
  ])('%s %s from another site is refused with 403', async (method, path, body) => {
    const actual = path === '/transactions' ? { ...body, account_id: account.id } : body;
    const client = me({ origin: EVIL });
    const res = await (method === 'POST' ? client.post(path).send(actual) : client.delete(path.replace('1', String(account.id))));
    expect(res.status).toBe(403);
    expect(await count('SELECT COUNT(*) FROM transactions')).toBe(0);
    expect(await count('SELECT COUNT(*) FROM accounts')).toBe(1);
    // ...and the session survived the forged logout.
    expect((await me().get('/auth/me')).status).toBe(200);
  });

  it('the same write from the real site is allowed', async () => {
    const res = await me({ origin: ALLOWED_ORIGIN }).post('/transactions').send({ account_id: account.id, amount: '-1.00', date: '2026-10-01' });
    expect(res.status).toBe(201);
  });

  it('reads from another site are not shared with it (no CORS allowance)', async () => {
    const res = await me({ origin: EVIL }).get('/accounts');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('the session cookie is SameSite=Lax and HttpOnly', async () => {
    const res = await api().post('/auth/login').send({ email: user.email, password: user.password });
    const cookie = [].concat(res.headers['set-cookie']).find((c) => c.startsWith('token='));
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/HttpOnly/i);
  });
});

describe('security headers', () => {
  it.each(['/health', '/accounts', '/nope'])('%s carries the expected headers', async (path) => {
    const res = await me().get(path);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toMatch(/DENY|SAMEORIGIN/);
    expect(res.headers['content-security-policy']).toBeTruthy();
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(res.headers['referrer-policy']).toBeTruthy();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('secrets never appear in responses', () => {
  it('across every endpoint a normal session touches', async () => {
    const responses = [
      await api().post('/auth/register').send({ email: 'fresh@gmail.com', password: 'long-enough-pass', honeypot: '', formRenderedAt: Date.now() - 5000 }),
      await api().post('/auth/login').send({ email: user.email, password: user.password }),
      await api().post('/auth/login').send({ email: user.email, password: 'wrong-password' }),
      await me().get('/auth/me'),
      await me().get('/accounts'),
      await me().post('/accounts').send({ name: 'Savings', type: 'savings' }),
      await me().post('/transactions').send({ account_id: account.id, amount: '-3.00', date: '2026-10-01' }),
      await me().get('/transactions'),
      await me().get('/categories'),
      await me().get('/recurring'),
      await api().post('/auth/forgot-password').send({ email: user.email }),
    ];
    for (const res of responses) {
      const text = JSON.stringify(res.body) + JSON.stringify(res.headers);
      for (const pattern of SECRET_PATTERNS) expect(text).not.toMatch(pattern);
    }
  });

  it('an unexpected server error says nothing about its cause', async () => {
    // Break the transactions table for one request.
    await pool.query('ALTER TABLE transactions RENAME TO transactions_hidden');
    try {
      const res = await me().get('/transactions');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: expect.any(String) });
      expect(JSON.stringify(res.body)).not.toMatch(/transactions_hidden|relation|does not exist/);
    } finally {
      await pool.query('ALTER TABLE transactions_hidden RENAME TO transactions');
    }
  });
});
