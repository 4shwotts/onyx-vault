// Per-user caps on accounts, categories, recurring rules and transactions.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api, pool, resetDatabase, createUser, createAccount, count } from '../helpers.mjs';

let user;
const me = () => api(undefined, { cookie: user.cookie });

beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
});
afterAll(() => pool.end());

async function fillTo(n, create) {
  for (let i = 0; i < n; i += 1) {
    const res = await create(i);
    expect(res.status, `item ${i + 1}`).toBe(201);
  }
}

describe('caps', () => {
  it('10 accounts', async () => {
    await fillTo(10, () => me().post('/accounts').send({ name: 'Current', type: 'current' }));
    const res = await me().post('/accounts').send({ name: 'Current', type: 'current' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/limit of 10 accounts/);
    expect(await count('SELECT COUNT(*) FROM accounts WHERE user_id = $1', [user.id])).toBe(10);
  });

  it('40 categories', async () => {
    await pool.query("INSERT INTO categories (user_id, name) SELECT $1, 'Category ' || g FROM generate_series(1, 39) g", [user.id]);
    expect((await me().post('/categories').send({ name: 'Fortieth' })).status).toBe(201);
    const res = await me().post('/categories').send({ name: 'Forty-first' });
    expect(res.status).toBe(403);
    expect(await count('SELECT COUNT(*) FROM categories WHERE user_id = $1', [user.id])).toBe(40);
  });

  it('15 recurring rules', async () => {
    const account = await createAccount(user.id);
    await fillTo(15, () => me().post('/recurring').send({ account_id: account.id, amount: '-1.00', frequency: 'monthly', start_date: '2099-01-01' }));
    const res = await me().post('/recurring').send({ account_id: account.id, amount: '-1.00', frequency: 'monthly', start_date: '2099-01-01' });
    expect(res.status).toBe(403);
    expect(await count('SELECT COUNT(*) FROM recurring_transactions WHERE user_id = $1', [user.id])).toBe(15);
  });

  it('10,000 transactions', async () => {
    const account = await createAccount(user.id);
    await pool.query(
      "INSERT INTO transactions (account_id, amount, date) SELECT $1, -0.01, DATE '2026-01-01' FROM generate_series(1, 9999)",
      [account.id]
    );
    const body = { account_id: account.id, amount: '-1.00', date: '2026-10-01' };
    expect((await me().post('/transactions').send(body)).status).toBe(201);
    const res = await me().post('/transactions').send(body);
    expect(res.status).toBe(403);
    expect(await count('SELECT COUNT(*) FROM transactions WHERE account_id = $1', [account.id])).toBe(10000);
  });

  it("one user's caps don't affect another user", async () => {
    await pool.query("INSERT INTO accounts (user_id, name, type) SELECT $1, 'Current', 'current' FROM generate_series(1, 10)", [user.id]);
    const other = await createUser();
    expect((await api(undefined, { cookie: other.cookie }).post('/accounts').send({ name: 'Current', type: 'current' })).status).toBe(201);
  });
});

describe('caps hold under simultaneous requests', () => {
  it('twenty simultaneous category creations at 38 leave exactly 40', async () => {
    await pool.query("INSERT INTO categories (user_id, name) SELECT $1, 'Category ' || g FROM generate_series(1, 38) g", [user.id]);
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => me().post('/categories').send({ name: `Rush ${i}` })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(results.filter((r) => r.status === 403)).toHaveLength(18);
    expect(await count('SELECT COUNT(*) FROM categories WHERE user_id = $1', [user.id])).toBe(40);
  });

  it('simultaneous recurring rules cannot exceed 15', async () => {
    const account = await createAccount(user.id);
    await pool.query(
      `INSERT INTO recurring_transactions (user_id, account_id, amount, frequency, next_run_date)
       SELECT $1, $2, -1.00, 'monthly', DATE '2099-01-01' FROM generate_series(1, 14)`,
      [user.id, account.id]
    );
    const body = { account_id: account.id, amount: '-1.00', frequency: 'monthly', start_date: '2099-01-01' };
    const results = await Promise.all(Array.from({ length: 8 }, () => me().post('/recurring').send(body)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await count('SELECT COUNT(*) FROM recurring_transactions WHERE user_id = $1', [user.id])).toBe(15);
  });

  it("one user's burst doesn't hold up another user's request", async () => {
    const other = await createUser();
    const burst = Array.from({ length: 10 }, () => me().post('/accounts').send({ name: 'Current', type: 'current' }));
    const theirs = api(undefined, { cookie: other.cookie }).post('/accounts').send({ name: 'Current', type: 'current' });
    const [otherResult] = await Promise.all([theirs, ...burst]);
    expect(otherResult.status).toBe(201);
  });

  it('several account creations at once cannot exceed 10', async () => {
    await pool.query("INSERT INTO accounts (user_id, name, type) SELECT $1, 'Current', 'current' FROM generate_series(1, 9)", [user.id]);
    const results = await Promise.all(Array.from({ length: 6 }, () => me().post('/accounts').send({ name: 'Current', type: 'current' })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await count('SELECT COUNT(*) FROM accounts WHERE user_id = $1', [user.id])).toBe(10);
  });

  it('several transactions at once cannot exceed 10,000', async () => {
    const account = await createAccount(user.id);
    await pool.query(
      "INSERT INTO transactions (account_id, amount, date) SELECT $1, -0.01, DATE '2026-01-01' FROM generate_series(1, 9999)",
      [account.id]
    );
    const body = { account_id: account.id, amount: '-1.00', date: '2026-10-01' };
    const results = await Promise.all(Array.from({ length: 6 }, () => me().post('/transactions').send(body)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await count('SELECT COUNT(*) FROM transactions WHERE account_id = $1', [account.id])).toBe(10000);
  });
});
