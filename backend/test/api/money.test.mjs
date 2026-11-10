// Every total the API returns must equal the exact sum of the stored
// transactions, through creates, edits and deletes.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api, pool, resetDatabase, createUser, createAccount } from '../helpers.mjs';

let user;
let current;
let savings;
const me = () => api(undefined, { cookie: user.cookie });

async function storedSum(accountId) {
  const { rows } = await pool.query('SELECT COALESCE(SUM(amount), 0)::numeric(14,2)::text AS s FROM transactions WHERE account_id = $1', [accountId]);
  return rows[0].s;
}

async function apiBalance(accountId) {
  const res = await me().get(`/accounts/${accountId}`);
  return res.body.balance;
}

async function expectConsistent() {
  for (const account of [current, savings]) {
    expect(await apiBalance(account.id)).toBe(await storedSum(account.id));
  }
}

beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
  current = await createAccount(user.id, 'Current');
  savings = await createAccount(user.id, 'Savings', 'savings');
});
afterAll(() => pool.end());

describe('money correctness', () => {
  it('balances equal the exact sum of awkward amounts', async () => {
    for (const amount of ['0.10', '0.20', '-0.30', '19.99', '-5.01', '2100.00', '-0.01', 0.1, -0.2]) {
      expect((await me().post('/transactions').send({ account_id: current.id, amount, date: '2026-10-01' })).status).toBe(201);
    }
    expect(await apiBalance(current.id)).toBe('2114.87');
    await expectConsistent();
  });

  it('amounts come back exactly as stored, as decimal strings', async () => {
    const res = await me().post('/transactions').send({ account_id: current.id, amount: '-1234.5', date: '2026-10-01' });
    expect(res.body.amount).toBe('-1234.50');
  });

  it('the largest allowed amounts in both directions are stored exactly', async () => {
    await me().post('/transactions').send({ account_id: current.id, amount: '999999.99', date: '2026-10-01' });
    await me().post('/transactions').send({ account_id: current.id, amount: '-999999.99', date: '2026-10-02' });
    await me().post('/transactions').send({ account_id: current.id, amount: '999999.99', date: '2026-10-03' });
    expect(await apiBalance(current.id)).toBe('999999.99');
    await expectConsistent();
  });

  it('edits and deletes keep balances exact, including moving between accounts', async () => {
    const a = (await me().post('/transactions').send({ account_id: current.id, amount: '-10.10', date: '2026-10-01' })).body;
    const b = (await me().post('/transactions').send({ account_id: current.id, amount: '250.00', date: '2026-10-02' })).body;

    await me().put(`/transactions/${a.id}`).send({ amount: '-20.20' });
    await expectConsistent();
    await me().put(`/transactions/${b.id}`).send({ account_id: savings.id });
    await expectConsistent();
    await me().put(`/transactions/${b.id}`).send({ account_id: current.id, amount: '0.01' });
    await expectConsistent();
    await me().delete(`/transactions/${a.id}`);
    await expectConsistent();
    expect(await apiBalance(current.id)).toBe('0.01');
    expect(await apiBalance(savings.id)).toBe('0.00');
  });

  it('the totals on a transactions page equal the sum of the matching stored rows', async () => {
    for (const [account, amount, date] of [
      [current, '-12.34', '2026-10-01'], [current, '2100.00', '2026-10-28'], [current, '-0.66', '2026-10-31'],
      [savings, '500.00', '2026-10-15'], [current, '-99.99', '2026-11-01'],
    ]) {
      await me().post('/transactions').send({ account_id: account.id, amount, date });
    }
    const res = await me().get('/transactions?page=1&limit=2&from=2026-10-01&to=2026-10-31');
    expect(res.body.total).toBe(4);
    expect(res.body.totals).toEqual({ income: '2600.00', spending: '-13.00', net: '2587.00' });

    const { rows } = await pool.query(
      `SELECT SUM(amount)::text AS net FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE a.user_id = $1 AND t.date BETWEEN '2026-10-01' AND '2026-10-31'`, [user.id]
    );
    expect(res.body.totals.net).toBe(rows[0].net);
  });
});
