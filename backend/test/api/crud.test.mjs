// Reading, editing and deleting single transactions and categories.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api, pool, resetDatabase, createUser, createAccount, createCategory, createTransaction } from '../helpers.mjs';

let user;
let account;
let groceries;
const me = () => api(undefined, { cookie: user.cookie });

beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
  account = await createAccount(user.id);
  groceries = await createCategory(user.id, 'Groceries');
});
afterAll(() => pool.end());

describe('transactions', () => {
  it('reads one transaction with its category and account names', async () => {
    const tx = await createTransaction(account.id, { categoryId: groceries.id, amount: '-42.10', date: '2026-10-31' });
    const res = await me().get(`/transactions/${tx.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: tx.id, amount: '-42.10', date: '2026-10-31', category_name: 'Groceries', account_name: 'Current' });
  });

  it('edits description, date and category', async () => {
    const tx = await createTransaction(account.id);
    const transport = await createCategory(user.id, 'Transport');
    const res = await me().put(`/transactions/${tx.id}`).send({ description: 'Bus pass', date: '2026-11-02', category_id: transport.id });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ description: 'Bus pass', date: '2026-11-02', category_id: transport.id });
  });

  it('can clear the category', async () => {
    const tx = await createTransaction(account.id, { categoryId: groceries.id });
    const res = await me().put(`/transactions/${tx.id}`).send({ category_id: null });
    expect(res.body.category_id).toBeNull();
  });

  it('deletes a transaction and reverses its effect on the balance', async () => {
    const tx = await createTransaction(account.id, { amount: '-42.10' });
    expect((await me().delete(`/transactions/${tx.id}`)).status).toBe(200);
    expect((await me().get(`/transactions/${tx.id}`)).status).toBe(404);
    const { rows } = await pool.query('SELECT balance FROM accounts WHERE id = $1', [account.id]);
    expect(rows[0].balance).toBe('0.00');
  });
});

describe('categories', () => {
  it('reads and renames a category', async () => {
    expect((await me().get(`/categories/${groceries.id}`)).body).toMatchObject({ id: groceries.id, name: 'Groceries' });
    const res = await me().put(`/categories/${groceries.id}`).send({ name: 'Food shopping' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Food shopping');
  });

  it('deleting a category keeps its transactions, now uncategorised', async () => {
    const tx = await createTransaction(account.id, { categoryId: groceries.id });
    expect((await me().delete(`/categories/${groceries.id}`)).status).toBe(200);
    const { rows } = await pool.query('SELECT category_id FROM transactions WHERE id = $1', [tx.id]);
    expect(rows[0].category_id).toBeNull();
  });
});
