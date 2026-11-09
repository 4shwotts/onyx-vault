// Regression tests for Bug 1: a malformed id in a request body made
// Postgres reject a query that ran outside any try/catch. Express 4 never
// saw the rejection, so the request hung and, on Node 15+, the unhandled
// rejection would bring the whole API down for every user.
import { describe, it, expect, beforeEach, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { pool, createApp, resetDatabase, createUser, createAccount, createCategory } from '../helpers.mjs';

const app = createApp();
const unhandled = [];
const onUnhandled = (reason) => unhandled.push(reason);
process.on('unhandledRejection', onUnhandled);

// Fail fast instead of waiting for the test timeout if a request hangs.
const REQUEST_TIMEOUT_MS = 4000;

const BAD_IDS = [
  ['a word', 'abc'],
  ['a negative number', -1],
  ['zero', 0],
  ['a decimal', 1.5],
  ['a number beyond the INTEGER range', 99999999999],
  ['a numeric string beyond the INTEGER range', '99999999999'],
  ['an object (operator-injection style)', { $gt: 0 }],
  ['an array', [1, 2]],
  ['a boolean', true],
  ['an SQL fragment', '1 OR 1=1'],
];

let user;
let account;
let category;

beforeEach(async () => {
  unhandled.length = 0;
  await resetDatabase();
  user = await createUser();
  account = await createAccount(user.id);
  category = await createCategory(user.id);
});

afterEach(() => {
  expect(unhandled, 'no unhandled promise rejections').toEqual([]);
});

afterAll(async () => {
  process.off('unhandledRejection', onUnhandled);
  await pool.end();
});

describe('POST /transactions with a malformed id', () => {
  it.each(BAD_IDS)('rejects account_id as %s with a clean 400', async (_label, badId) => {
    const res = await request(app)
      .post('/transactions')
      .set('Cookie', user.cookie)
      .send({ account_id: badId, amount: -12.5, date: '2026-10-01' })
      .timeout(REQUEST_TIMEOUT_MS);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/account_id/);
    expect(JSON.stringify(res.body)).not.toMatch(/invalid input syntax|at .*\.js/);
  });

  it.each(BAD_IDS)('rejects category_id as %s with a clean 400', async (_label, badId) => {
    const res = await request(app)
      .post('/transactions')
      .set('Cookie', user.cookie)
      .send({ account_id: account.id, category_id: badId, amount: -12.5, date: '2026-10-01' })
      .timeout(REQUEST_TIMEOUT_MS);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/category_id/);
  });

  it('still creates a transaction with valid ids, including ids sent as strings', async () => {
    const res = await request(app)
      .post('/transactions')
      .set('Cookie', user.cookie)
      .send({ account_id: String(account.id), category_id: String(category.id), amount: -12.5, date: '2026-10-01' })
      .timeout(REQUEST_TIMEOUT_MS);

    expect(res.status).toBe(201);
    const { rows } = await pool.query('SELECT balance FROM accounts WHERE id = $1', [account.id]);
    expect(rows[0].balance).toBe('-12.50');
  });
});

describe('POST /recurring with a malformed id', () => {
  const validRule = () => ({ amount: -9.99, frequency: 'monthly', start_date: '2099-01-01' });

  it.each(BAD_IDS)('rejects account_id as %s with a clean 400', async (_label, badId) => {
    const res = await request(app)
      .post('/recurring')
      .set('Cookie', user.cookie)
      .send({ ...validRule(), account_id: badId })
      .timeout(REQUEST_TIMEOUT_MS);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/account_id/);
  });

  it.each(BAD_IDS)('rejects category_id as %s with a clean 400', async (_label, badId) => {
    const res = await request(app)
      .post('/recurring')
      .set('Cookie', user.cookie)
      .send({ ...validRule(), account_id: account.id, category_id: badId })
      .timeout(REQUEST_TIMEOUT_MS);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/category_id/);
  });

  it('still creates a rule with valid ids', async () => {
    const res = await request(app)
      .post('/recurring')
      .set('Cookie', user.cookie)
      .send({ ...validRule(), account_id: account.id, category_id: category.id })
      .timeout(REQUEST_TIMEOUT_MS);

    expect(res.status).toBe(201);
  });
});

describe('the API keeps serving after a bad request', () => {
  it('answers the next request normally', async () => {
    await request(app)
      .post('/transactions')
      .set('Cookie', user.cookie)
      .send({ account_id: 'abc', amount: -1, date: '2026-10-01' })
      .timeout(REQUEST_TIMEOUT_MS)
      .catch(() => {});

    const res = await request(app).get('/accounts').set('Cookie', user.cookie).timeout(REQUEST_TIMEOUT_MS);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('turns an unexpected database failure into a 500, not a hang', async () => {
    // A recurring rule whose account was deleted between the ownership
    // check and the insert is hard to stage; instead, send a date
    // Postgres can't parse, which fails inside the handler.
    const res = await request(app)
      .post('/recurring')
      .set('Cookie', user.cookie)
      .send({ account_id: account.id, amount: -1, frequency: 'weekly', start_date: 'not-a-date' })
      .timeout(REQUEST_TIMEOUT_MS);

    expect([400, 500]).toContain(res.status);
    expect(res.body.error).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/invalid input syntax|at .*\.js/);
  });
});
