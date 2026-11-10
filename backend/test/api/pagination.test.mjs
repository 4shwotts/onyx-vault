// GET /transactions?page=&limit= — pages, ordering and edges.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api, pool, resetDatabase, createUser, createAccount } from '../helpers.mjs';

let user;
let current;
let savings;
const me = () => api(undefined, { cookie: user.cookie });

// 30 transactions: 25 on current (one per day, 1–25 Oct) and 5 on savings
// (all on 10 Oct, to test the tie-break on identical dates).
beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
  current = await createAccount(user.id, 'Current');
  savings = await createAccount(user.id, 'Savings', 'savings');
  for (let d = 1; d <= 25; d += 1) {
    await pool.query(
      'INSERT INTO transactions (account_id, amount, description, date) VALUES ($1, $2, $3, $4)',
      [current.id, `-${d}.00`, `Day ${d}`, `2026-10-${String(d).padStart(2, '0')}`]
    );
  }
  for (let i = 1; i <= 5; i += 1) {
    await pool.query(
      "INSERT INTO transactions (account_id, amount, description, date) VALUES ($1, '100.00', $2, '2026-10-10')",
      [savings.id, `Same day ${i}`]
    );
  }
});
afterAll(() => pool.end());

async function page(query) {
  const res = await me().get(`/transactions?${query}`);
  expect(res.status).toBe(200);
  return res.body;
}

describe('pagination', () => {
  it('returns the first page, newest first, with totals', async () => {
    const body = await page('page=1&limit=10');
    expect(body).toMatchObject({ page: 1, limit: 10, total: 30, totalPages: 3 });
    expect(body.transactions).toHaveLength(10);
    expect(body.transactions[0]).toMatchObject({ date: '2026-10-25', description: 'Day 25' });
  });

  it('walks every page without gaps or repeats, in strict order', async () => {
    const seen = [];
    for (let p = 1; p <= 3; p += 1) seen.push(...(await page(`page=${p}&limit=10`)).transactions);
    expect(seen).toHaveLength(30);
    expect(new Set(seen.map((t) => t.id)).size).toBe(30);
    for (let i = 1; i < seen.length; i += 1) {
      const [a, b] = [seen[i - 1], seen[i]];
      expect(a.date > b.date || (a.date === b.date && a.id > b.id), `${a.id} before ${b.id}`).toBe(true);
    }
  });

  it('a partial last page', async () => {
    const body = await page('page=5&limit=7');
    expect(body).toMatchObject({ page: 5, total: 30, totalPages: 5 });
    expect(body.transactions).toHaveLength(2);
  });

  it('a page past the end is empty, not an error', async () => {
    const body = await page('page=4&limit=10');
    expect(body).toMatchObject({ page: 4, total: 30, totalPages: 3, transactions: [] });
  });

  it('defaults to 25 per page and allows up to 100', async () => {
    expect((await page('page=1')).transactions).toHaveLength(25);
    expect((await page('page=1&limit=100')).transactions).toHaveLength(30);
  });

  it('a limit of 1 gives one page per transaction', async () => {
    expect(await page('page=30&limit=1')).toMatchObject({ totalPages: 30, transactions: [expect.objectContaining({ description: 'Day 1' })] });
  });

  it('applies filters before paging', async () => {
    const body = await page(`page=1&limit=3&account_id=${savings.id}`);
    expect(body).toMatchObject({ total: 5, totalPages: 2 });
    expect(body.transactions.map((t) => t.description)).toEqual(['Same day 5', 'Same day 4', 'Same day 3']);

    const ranged = await page('page=1&limit=100&from=2026-10-05&to=2026-10-07');
    expect(ranged.transactions.map((t) => t.date)).toEqual(['2026-10-07', '2026-10-06', '2026-10-05']);
  });

  it('an empty result is a normal page', async () => {
    expect(await page('page=1&from=2030-01-01')).toMatchObject({ total: 0, totalPages: 0, transactions: [] });
  });

  it('a transaction added between page loads does not duplicate rows across a page boundary for older items', async () => {
    const first = await page('page=1&limit=10');
    await pool.query("INSERT INTO transactions (account_id, amount, date) VALUES ($1, '-1.00', '2026-09-01')", [current.id]);
    const second = await page('page=2&limit=10');
    const overlap = second.transactions.filter((t) => first.transactions.some((f) => f.id === t.id));
    expect(overlap).toEqual([]);
  });
});
