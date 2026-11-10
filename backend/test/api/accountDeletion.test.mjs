// Deleting an account removes every row that belongs to that user, in
// every table, and nothing that belongs to anyone else.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  api, pool, resetDatabase, createUser, createAccount, createCategory, createTransaction, createRule, count, lastEmailTo,
} from '../helpers.mjs';

let leaver;
let stayer;

async function giveEverything(user) {
  const current = await createAccount(user.id, 'Current');
  const savings = await createAccount(user.id, 'Savings', 'savings');
  const cat = await createCategory(user.id, 'Groceries');
  await createTransaction(current.id, { categoryId: cat.id });
  await createTransaction(savings.id, { amount: '250.00' });
  await createRule(user.id, current.id, { startDate: '2099-01-01' });
  await api().post('/auth/forgot-password').send({ email: user.email });
  await pool.query(
    "INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, 'x', NOW() + INTERVAL '1 day')",
    [user.id]
  );
}

// Every row in every table that belongs to the user, directly or through
// one of their accounts. Built from the live list of tables, so a table
// added later without cleanup on delete makes this test fail.
async function rowsBelongingTo(userId) {
  const { rows: tables } = await pool.query(
    "SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'user_id'"
  );
  const counts = {};
  for (const { table_name: table } of tables) {
    counts[table] = await count(`SELECT COUNT(*) FROM ${table} WHERE user_id = $1`, [userId]);
  }
  counts.users = await count('SELECT COUNT(*) FROM users WHERE id = $1', [userId]);
  counts.transactions = await count(
    'SELECT COUNT(*) FROM transactions t WHERE t.account_id IN (SELECT id FROM accounts WHERE user_id = $1)',
    [userId]
  );
  return counts;
}

beforeEach(async () => {
  await resetDatabase();
  leaver = await createUser();
  stayer = await createUser();
  await giveEverything(leaver);
  await giveEverything(stayer);
  expect(lastEmailTo(leaver.email)).toBeTruthy();
});
afterAll(() => pool.end());

describe('account deletion', () => {
  it('removes every row belonging to the user and leaves everyone else alone', async () => {
    const leaverTxIds = (await pool.query(
      'SELECT t.id FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE a.user_id = $1', [leaver.id]
    )).rows.map((r) => r.id);
    const stayerBefore = await rowsBelongingTo(stayer.id);
    expect(Object.values(await rowsBelongingTo(leaver.id)).every((n) => n > 0)).toBe(true);

    const res = await api(undefined, { cookie: leaver.cookie }).delete('/auth/account').send({ password: leaver.password });

    expect(res.status).toBe(200);
    expect(Object.values(await rowsBelongingTo(leaver.id)).every((n) => n === 0)).toBe(true);
    expect(await count('SELECT COUNT(*) FROM transactions WHERE id = ANY($1)', [leaverTxIds])).toBe(0);
    expect(await rowsBelongingTo(stayer.id)).toEqual(stayerBefore);
  });

  it('clears the cookie, and a copy of the old cookie stops working', async () => {
    const res = await api(undefined, { cookie: leaver.cookie }).delete('/auth/account').send({ password: leaver.password });
    expect([].concat(res.headers['set-cookie']).join(';')).toMatch(/token=;/);
    expect((await api(undefined, { cookie: leaver.cookie }).get('/accounts')).status).toBe(401);
  });

  it('the email address can be used to sign up again afterwards', async () => {
    await api(undefined, { cookie: leaver.cookie }).delete('/auth/account').send({ password: leaver.password });
    const res = await api().post('/auth/register').send({ email: leaver.email, password: 'long-enough-pass', honeypot: '', formRenderedAt: Date.now() - 5000 });
    expect(res.status).toBe(201);
  });

  it.each([
    ['a wrong password', { password: 'not-my-password' }, 401],
    ['no password', {}, 400],
  ])('refuses with %s and deletes nothing', async (_label, body, status) => {
    const before = await rowsBelongingTo(leaver.id);
    const res = await api(undefined, { cookie: leaver.cookie }).delete('/auth/account').send(body);
    expect(res.status).toBe(status);
    expect(await rowsBelongingTo(leaver.id)).toEqual(before);
  });
});
