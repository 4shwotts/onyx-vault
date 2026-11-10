// One user must never be able to read, change or delete another user's
// data. Every attempt gets the same 404 a missing record would, so the
// response doesn't even confirm the record exists.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  api, pool, resetDatabase, createUser, createAccount, createCategory, createTransaction, createRule,
} from '../helpers.mjs';

let owner;
let intruder;
let ownerData;
let intruderAccount;

async function snapshot() {
  const tables = ['accounts', 'categories', 'transactions', 'recurring_transactions'];
  const result = {};
  for (const table of tables) {
    result[table] = (await pool.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
  }
  return result;
}

beforeEach(async () => {
  await resetDatabase();
  owner = await createUser();
  intruder = await createUser();
  const account = await createAccount(owner.id, 'Current');
  const category = await createCategory(owner.id, 'Groceries');
  const transaction = await createTransaction(account.id, { categoryId: category.id, amount: '-42.10' });
  const rule = await createRule(owner.id, account.id, { startDate: '2099-01-01' });
  ownerData = { account, category, transaction, rule };
  intruderAccount = await createAccount(intruder.id, 'Mine');
});

afterAll(() => pool.end());

const asIntruder = () => api(undefined, { cookie: intruder.cookie });

describe("requests for another user's records get 404", () => {
  const cases = [
    ['GET', 'accounts', 'account', null],
    ['DELETE', 'accounts', 'account', null],
    ['GET', 'transactions', 'transaction', null],
    ['PUT', 'transactions', 'transaction', { amount: '-1.00' }],
    ['DELETE', 'transactions', 'transaction', null],
    ['GET', 'categories', 'category', null],
    ['PUT', 'categories', 'category', { name: 'Hijacked' }],
    ['DELETE', 'categories', 'category', null],
    ['GET', 'recurring', 'rule', null],
    ['PUT', 'recurring', 'rule', { amount: '-1.00' }],
    ['DELETE', 'recurring', 'rule', null],
  ];

  it.each(cases)('%s /%s/:id', async (method, resource, key, body) => {
    const before = await snapshot();
    const path = `/${resource}/${ownerData[key].id}`;
    const client = asIntruder();
    const req = method === 'GET' ? client.get(path) : method === 'PUT' ? client.put(path).send(body) : client.delete(path);
    const res = await req;

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: expect.any(String) });
    expect(await snapshot()).toEqual(before);
  });

  it.each(cases.map(([m, r]) => [m, r]))('%s /%s/:id for an id that does not exist matches exactly', async (method, resource) => {
    const client = asIntruder();
    const path = `/${resource}/999999`;
    const body = resource === 'categories' ? { name: 'x' } : { amount: '-1.00' };
    const res = await (method === 'GET' ? client.get(path) : method === 'PUT' ? client.put(path).send(body) : client.delete(path));
    expect(res.status).toBe(404);
  });
});

describe("another user's ids inside a request body get 404", () => {
  it('a transaction on their account', async () => {
    const res = await asIntruder().post('/transactions')
      .send({ account_id: ownerData.account.id, amount: '-5.00', date: '2026-10-01' });
    expect(res.status).toBe(404);
  });

  it('a transaction on my account but in their category', async () => {
    const res = await asIntruder().post('/transactions')
      .send({ account_id: intruderAccount.id, category_id: ownerData.category.id, amount: '-5.00', date: '2026-10-01' });
    expect(res.status).toBe(404);
  });

  it('a recurring rule on their account', async () => {
    const res = await asIntruder().post('/recurring')
      .send({ account_id: ownerData.account.id, amount: '-5.00', frequency: 'monthly', start_date: '2099-01-01' });
    expect(res.status).toBe(404);
  });

  it('moving my own transaction onto their account', async () => {
    const mine = await createTransaction(intruderAccount.id);
    const res = await asIntruder().put(`/transactions/${mine.id}`).send({ account_id: ownerData.account.id });
    expect(res.status).toBe(404);
    const { rows } = await pool.query('SELECT account_id FROM transactions WHERE id = $1', [mine.id]);
    expect(rows[0].account_id).toBe(intruderAccount.id);
  });

  it('nothing of theirs was created or changed by any of the above', async () => {
    const before = await snapshot();
    await asIntruder().post('/transactions').send({ account_id: ownerData.account.id, amount: '-5.00', date: '2026-10-01' });
    await asIntruder().post('/recurring').send({ account_id: ownerData.account.id, amount: '-5.00', frequency: 'weekly', start_date: '2026-01-01' });
    expect(await snapshot()).toEqual(before);
  });
});

describe('lists only ever contain my own records', () => {
  // Ownership of each returned item is checked against the database.
  const ownerOf = {
    '/accounts': 'SELECT user_id FROM accounts WHERE id = $1',
    '/categories': 'SELECT user_id FROM categories WHERE id = $1',
    '/recurring': 'SELECT user_id FROM recurring_transactions WHERE id = $1',
    '/transactions': 'SELECT a.user_id FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE t.id = $1',
  };

  it.each(Object.keys(ownerOf))('%s', async (path) => {
    // Give the intruder one of everything too, so the lists aren't empty.
    const cat = await createCategory(intruder.id, 'Mine');
    await createTransaction(intruderAccount.id, { categoryId: cat.id });
    await createRule(intruder.id, intruderAccount.id, { startDate: '2099-02-01' });

    const res = await asIntruder().get(path);
    expect(res.status).toBe(200);
    const items = Array.isArray(res.body) ? res.body : res.body.transactions;
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const { rows } = await pool.query(ownerOf[path], [item.id]);
      expect(rows[0].user_id).toBe(intruder.id);
    }
  });

  it("filtering by another user's account returns nothing of theirs", async () => {
    const res = await asIntruder().get(`/transactions?account_id=${ownerData.account.id}`);
    expect(res.status).toBe(200);
    const items = Array.isArray(res.body) ? res.body : res.body.transactions;
    expect(items).toEqual([]);
  });
});
