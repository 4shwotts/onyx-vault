// Bad input must always get a short, clean 400 (or 404 for an id in the
// URL that can't exist) — never a 500, a hang or a stack trace.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { api, pool, createApp, resetDatabase, createUser, createAccount, createTransaction, createRule, createCategory } from '../helpers.mjs';

let user;
let account;
const me = () => api(undefined, { cookie: user.cookie });

function expectCleanError(res, status) {
  expect(res.status).toBe(status);
  expect(res.headers['content-type']).toMatch(/application\/json/);
  expect(Object.keys(res.body)).toEqual(['error']);
  expect(res.body.error).toEqual(expect.any(String));
  expect(res.body.error.length).toBeLessThan(200);
  expect(JSON.stringify(res.body)).not.toMatch(/at \S+\.js|node_modules|syntax error|SyntaxError|invalid input syntax|ZodError/);
}

beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
  account = await createAccount(user.id);
});
afterAll(() => pool.end());

describe('request bodies', () => {
  it('malformed JSON is a 400', async () => {
    const res = await request(createApp())
      .post('/transactions')
      .set('Cookie', user.cookie)
      .set('Content-Type', 'application/json')
      .send('{"account_id": 1, "amount": ');
    expectCleanError(res, 400);
  });

  it('a body over the size limit is a 413', async () => {
    const res = await me().post('/transactions').send({ account_id: account.id, amount: '-1.00', date: '2026-10-01', description: 'x'.repeat(200_000) });
    expectCleanError(res, 413);
  });

  it('a body that is not JSON is treated as empty', async () => {
    const res = await me().post('/transactions').set('Content-Type', 'text/plain').send('account_id=1&amount=5');
    expectCleanError(res, 400);
  });

  const validTx = () => ({ account_id: account.id, amount: '-12.50', date: '2026-10-01' });
  it.each([
    ['missing amount', (b) => { delete b.amount; }],
    ['missing date', (b) => { delete b.date; }],
    ['empty-string amount', (b) => { b.amount = ''; }],
    ['zero amount', (b) => { b.amount = 0; }],
    ['boolean amount', (b) => { b.amount = true; }],
    ['amount with three decimal places', (b) => { b.amount = '1.005'; }],
    ['amount in exponent form', (b) => { b.amount = '1e3'; }],
    ['amount over the cap', (b) => { b.amount = '1000000.00'; }],
    ['Infinity', (b) => { b.amount = 'Infinity'; }],
    ['impossible date', (b) => { b.date = '2026-02-30'; }],
    ['UK-style date', (b) => { b.date = '30/10/2026'; }],
    ['date as a number', (b) => { b.date = 20261030; }],
    ['over-long description', (b) => { b.description = 'x'.repeat(256); }],
    ['description as an object', (b) => { b.description = { text: 'x' }; }],
    ['unexpected field', (b) => { b.colour = 'red'; }],
  ])('POST /transactions: %s is a 400 and creates nothing', async (_label, mutate) => {
    const body = validTx();
    mutate(body);
    expectCleanError(await me().post('/transactions').send(body), 400);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM transactions');
    expect(rows[0].n).toBe(0);
    const { rows: [acc] } = await pool.query('SELECT balance FROM accounts WHERE id = $1', [account.id]);
    expect(acc.balance).toBe('0.00');
  });

  it.each([
    ['/accounts', { name: 'Savings', type: 'isa' }],
    ['/accounts', { name: '', type: 'savings' }],
    ['/accounts', { type: 'savings' }],
    ['/categories', { name: '' }],
    ['/categories', { name: 'x'.repeat(41) }],
    ['/categories', { name: 42 }],
    ['/recurring', { account_id: 1, amount: '-5.00', frequency: 'daily', start_date: '2026-10-01' }],
    ['/recurring', { account_id: 1, amount: '-5.00', frequency: 'monthly', start_date: 'next Tuesday' }],
    ['/recurring', { account_id: 1, amount: '-5.00', frequency: 'monthly' }],
    ['/auth/register', { email: 'a@gmail.com', honeypot: '', formRenderedAt: Date.now() - 5000 }],
    ['/auth/login', { email: 'a@gmail.com' }],
    ['/auth/login', { email: ['a@gmail.com'], password: 'x' }],
    ['/auth/verify-email', { token: { $ne: null } }],
    ['/auth/reset-password', { token: 'abc', password: 'long-enough-pass' }],
    ['/auth/forgot-password', {}],
  ])('POST %s with %j is a 400', async (path, body) => {
    expectCleanError(await me().post(path).send(body), 400);
  });

  it('PUT /transactions/:id with nothing to change is a 400', async () => {
    const tx = await createTransaction(account.id);
    expectCleanError(await me().put(`/transactions/${tx.id}`).send({}), 400);
  });
});

describe('dates', () => {
  it('the test database reads dates the way the live database does', async () => {
    const { rows } = await pool.query("SELECT current_setting('DateStyle') AS ds, '01/08/2026'::date::text AS d");
    expect(rows[0]).toEqual({ ds: 'ISO, MDY', d: '2026-01-08' });
  });

  it('an ambiguous UK-style date is refused rather than read the American way', async () => {
    const res = await me().post('/transactions').send({ account_id: account.id, amount: '-5.00', date: '01/08/2026' });
    const { rows } = await pool.query("SELECT to_char(date, 'YYYY-MM-DD') AS d FROM transactions");
    expect(rows.map((r) => r.d)).not.toContain('2026-01-08'); // 1 August read as 8 January
    expectCleanError(res, 400);
  });
});

describe('ids in the URL', () => {
  const BAD = ['abc', '0', '-1', '1.5', '99999999999', '1e3', "1' OR '1'='1"];

  it.each(BAD.flatMap((id) => [
    ['GET', 'accounts', id], ['DELETE', 'accounts', id],
    ['GET', 'transactions', id], ['PUT', 'transactions', id], ['DELETE', 'transactions', id],
    ['GET', 'categories', id], ['DELETE', 'categories', id],
    ['GET', 'recurring', id], ['DELETE', 'recurring', id],
  ]))('%s /%s/%s is a 404', async (method, resource, id) => {
    const path = `/${resource}/${encodeURIComponent(id)}`;
    const client = me();
    const res = await (method === 'GET' ? client.get(path) : method === 'PUT' ? client.put(path).send({ amount: '-1.00' }) : client.delete(path));
    expectCleanError(res, 404);
  });
});

describe('query strings', () => {
  it.each([
    'account_id=abc',
    'category_id=-1',
    'from=yesterday',
    'to=2026-13-01',
    'from=2026-11-01&to=2026-10-01',
    'page=0',
    'page=two',
    'limit=1000',
    "from=2026-01-01' OR '1'='1",
    'sort=amount',
  ])('GET /transactions?%s is a 400', async (query) => {
    expectCleanError(await me().get(`/transactions?${query}`), 400);
  });
});

describe('unknown routes', () => {
  it.each(['/nope', '/accounts/1/extra', '/transactions/export'])('%s is a JSON 404', async (path) => {
    expectCleanError(await me().get(path), 404);
  });
});

describe('a valid request still works after all of that', () => {
  it('creates, edits and deletes normally', async () => {
    const created = await me().post('/transactions').send({ account_id: account.id, amount: '-12.50', date: '2026-10-01' });
    expect(created.status).toBe(201);
    expect((await me().put(`/transactions/${created.body.id}`).send({ amount: '-15.00' })).status).toBe(200);
    expect((await me().delete(`/transactions/${created.body.id}`)).status).toBe(200);
    await createRule(user.id, account.id, { startDate: '2099-01-01' });
    await createCategory(user.id, 'Other');
    expect((await me().get('/recurring')).status).toBe(200);
  });
});
