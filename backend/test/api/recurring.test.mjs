// Recurring rules through the API, including "run now".
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api, pool, resetDatabase, createUser, createAccount, createRule, todayUtc, count } from '../helpers.mjs';

let alice;
let bob;
let aliceAccount;
let bobAccount;
let today;

const as = (user) => api(undefined, { cookie: user.cookie });

async function postedFor(accountId) {
  const { rows } = await pool.query('SELECT date, amount FROM transactions WHERE account_id = $1 ORDER BY date, id', [accountId]);
  return rows;
}

beforeEach(async () => {
  await resetDatabase();
  alice = await createUser();
  bob = await createUser();
  aliceAccount = await createAccount(alice.id);
  bobAccount = await createAccount(bob.id);
  today = await todayUtc();
});
afterAll(() => pool.end());

describe('creating a rule', () => {
  it('a rule starting today posts its first payment straight away, once', async () => {
    const res = await as(alice).post('/recurring').send({ account_id: aliceAccount.id, amount: '-9.99', description: 'Streaming plan', frequency: 'monthly', start_date: today });
    expect(res.status).toBe(201);
    expect(res.body.first_transaction_created).toBe(true);
    expect(await postedFor(aliceAccount.id)).toEqual([{ date: today, amount: '-9.99' }]);
  });

  it('a rule starting in the future posts nothing yet', async () => {
    const res = await as(alice).post('/recurring').send({ account_id: aliceAccount.id, amount: '-9.99', frequency: 'weekly', start_date: '2099-06-01' });
    expect(res.body.first_transaction_created).toBe(false);
    expect(await postedFor(aliceAccount.id)).toEqual([]);
  });

  it('returns amounts as exact decimal strings and dates as YYYY-MM-DD', async () => {
    const res = await as(alice).post('/recurring').send({ account_id: aliceAccount.id, amount: '-0.10', frequency: 'monthly', start_date: '2099-01-31' });
    expect(res.body).toMatchObject({ amount: '-0.10', next_run_date: '2099-01-31', start_date: '2099-01-31', day_of_month: 31 });
  });
});

describe('run now', () => {
  it("only posts the calling user's due rules", async () => {
    await createRule(alice.id, aliceAccount.id, { startDate: today });
    await createRule(bob.id, bobAccount.id, { startDate: today });

    const res = await as(alice).post('/recurring/run-now');
    expect(res.body).toEqual({ processed: 1 });
    expect(await postedFor(aliceAccount.id)).toHaveLength(1);
    expect(await postedFor(bobAccount.id)).toHaveLength(0);
    const { rows } = await pool.query('SELECT next_run_date FROM recurring_transactions WHERE user_id = $1', [bob.id]);
    expect(rows[0].next_run_date).toBe(today);
  });

  it('is idempotent: a second run posts nothing more', async () => {
    await createRule(alice.id, aliceAccount.id, { startDate: today });
    expect((await as(alice).post('/recurring/run-now')).body).toEqual({ processed: 1 });
    expect((await as(alice).post('/recurring/run-now')).body).toEqual({ processed: 0 });
    expect(await postedFor(aliceAccount.id)).toHaveLength(1);
    const { rows } = await pool.query('SELECT balance FROM accounts WHERE id = $1', [aliceAccount.id]);
    expect(rows[0].balance).toBe('-9.99');
  });

  it('two run-now clicks at the same moment post the payment once', async () => {
    await createRule(alice.id, aliceAccount.id, { startDate: today });
    const results = await Promise.all([as(alice).post('/recurring/run-now'), as(alice).post('/recurring/run-now')]);
    expect(results.map((r) => r.body.processed).sort()).toEqual([0, 1]);
    expect(await postedFor(aliceAccount.id)).toHaveLength(1);
  });

  it('does nothing when no rule is due', async () => {
    await createRule(alice.id, aliceAccount.id, { startDate: '2099-01-01' });
    expect((await as(alice).post('/recurring/run-now')).body).toEqual({ processed: 0 });
    expect(await count('SELECT COUNT(*) FROM transactions')).toBe(0);
  });
});

describe('reading, editing and deleting a rule', () => {
  it('reads one rule', async () => {
    const rule = await createRule(alice.id, aliceAccount.id, { startDate: '2099-01-15' });
    const res = await as(alice).get(`/recurring/${rule.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: rule.id, amount: '-9.99', frequency: 'monthly', next_run_date: '2099-01-15' });
  });

  it('edits the amount and description without touching the schedule', async () => {
    const rule = await createRule(alice.id, aliceAccount.id, { startDate: '2099-01-15' });
    const res = await as(alice).put(`/recurring/${rule.id}`).send({ amount: '-12.49', description: 'Streaming plan (premium)' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ amount: '-12.49', description: 'Streaming plan (premium)', next_run_date: '2099-01-15' });
  });

  it('refuses to edit the schedule fields directly', async () => {
    const rule = await createRule(alice.id, aliceAccount.id, { startDate: '2099-01-15' });
    expect((await as(alice).put(`/recurring/${rule.id}`).send({ next_run_date: '2026-01-01' })).status).toBe(400);
  });

  it('deletes a rule but keeps the payments it already posted', async () => {
    const rule = await createRule(alice.id, aliceAccount.id, { startDate: today });
    await as(alice).post('/recurring/run-now');
    expect((await as(alice).delete(`/recurring/${rule.id}`)).status).toBe(200);
    expect(await count('SELECT COUNT(*) FROM recurring_transactions')).toBe(0);
    expect(await postedFor(aliceAccount.id)).toHaveLength(1);
  });
});
