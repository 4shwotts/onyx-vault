// Posting recurring payments against the throwaway database. These sit
// between unit and API tests: no HTTP, but real transactions and locks,
// because "never posts the same payment twice" is a property of what ends
// up committed.
import { describe, it, expect, beforeEach, afterAll, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import request from 'supertest';
import { pool, createApp, resetDatabase, createUser, createAccount } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { processRule, processRecurringTransactions, todayUtc, MAX_CATCH_UP_PER_RUN } = require('../../src/cron/processRecurring.js');

// Independent of the code under test: every monthly due date from `start`
// (on `anchorDay`, or the month's last day if shorter) up to `today`,
// at most `max` of them.
function dueMonthlyDates(start, anchorDay, today, max = MAX_CATCH_UP_PER_RUN) {
  let [y, m] = start.split('-').map(Number);
  const dates = [];
  while (dates.length < max) {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const date = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(anchorDay, last)).padStart(2, '0')}`;
    if (date > today) break;
    dates.push(date);
    [y, m] = m === 12 ? [y + 1, 1] : [y, m + 1];
  }
  return dates;
}

let user;
let account;

async function insertRule({ startDate, amount = '-9.99', frequency = 'monthly', userId = user.id, accountId = account.id }) {
  const { rows } = await pool.query(
    `INSERT INTO recurring_transactions (user_id, account_id, amount, description, frequency, next_run_date)
     VALUES ($1, $2, $3, 'Streaming plan', $4, $5) RETURNING *`,
    [userId, accountId, amount, frequency, startDate]
  );
  return rows[0];
}

async function postedDates(accountId = account.id) {
  const { rows } = await pool.query(
    "SELECT to_char(date, 'YYYY-MM-DD') AS date FROM transactions WHERE account_id = $1 ORDER BY date, id",
    [accountId]
  );
  return rows.map((r) => r.date);
}

async function balance(accountId = account.id) {
  const { rows } = await pool.query('SELECT balance FROM accounts WHERE id = $1', [accountId]);
  return rows[0].balance;
}

async function inTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
  account = await createAccount(user.id);
});

afterAll(async () => {
  await pool.end();
});

describe('posting a due rule', () => {
  it('posts one transaction, moves the balance once and advances the rule', async () => {
    const rule = await insertRule({ startDate: '2026-01-15' });
    await inTransaction((client) => processRule(client, rule));

    expect(await postedDates()).toEqual(['2026-01-15']);
    expect(await balance()).toBe('-9.99');
    const { rows } = await pool.query("SELECT to_char(next_run_date, 'YYYY-MM-DD') AS d FROM recurring_transactions WHERE id = $1", [rule.id]);
    expect(rows[0].d).toBe('2026-02-15');
  });

  it('a rule starting on the 31st posts on the last day of short months and returns to the 31st', async () => {
    // Created through the API, exactly as the app creates rules. The start
    // date has passed, so every payment due so far is caught up straight
    // away (up to 12), each on its own due date.
    const res = await request(createApp())
      .post('/recurring')
      .set('Cookie', user.cookie)
      .send({ account_id: account.id, amount: -9.99, description: 'Streaming plan', frequency: 'monthly', start_date: '2026-01-31' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ first_transaction_created: true, start_date: '2026-01-31', day_of_month: 31 });

    const posted = await postedDates();
    expect(posted.slice(0, 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(posted).toEqual(dueMonthlyDates('2026-01-31', 31, await todayUtc()));
    expect(res.body.payments_posted).toBe(posted.length);
  });

  it('a rule from before day_of_month existed keeps the day of its next run', async () => {
    let rule = await insertRule({ startDate: '2026-03-15' }); // inserted the old way: no day_of_month
    expect(rule.day_of_month).toBeNull();
    for (let i = 0; i < 3; i += 1) {
      await inTransaction((client) => processRule(client, rule));
      ({ rows: [rule] } = await pool.query('SELECT * FROM recurring_transactions WHERE id = $1', [rule.id]));
    }
    expect(await postedDates()).toEqual(['2026-03-15', '2026-04-15', '2026-05-15']);
  });
});

describe('never posting the same payment twice', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('processing the same (already handled) rule row a second time posts nothing', async () => {
    // What happens when the nightly cron and "run now" both read the rule
    // before either has committed: each holds the same row.
    const rule = await insertRule({ startDate: '2026-01-15' });
    await inTransaction((client) => processRule(client, rule));
    await inTransaction((client) => processRule(client, rule));

    expect(await postedDates()).toEqual(['2026-01-15']);
    expect(await balance()).toBe('-9.99');
  });

  it('two overlapping runs of the same rule post it once', async () => {
    const rule = await insertRule({ startDate: '2026-01-15' });
    await Promise.allSettled([
      inTransaction((client) => processRule(client, rule)),
      inTransaction((client) => processRule(client, rule)),
    ]);

    expect(await postedDates()).toEqual(['2026-01-15']);
    expect(await balance()).toBe('-9.99');
  });

  it('two overlapping sweeps post each due payment once', async () => {
    await insertRule({ startDate: '2026-01-15' });
    const counts = await Promise.all([processRecurringTransactions(), processRecurringTransactions()]);

    const expected = dueMonthlyDates('2026-01-15', 15, await todayUtc());
    expect(await postedDates()).toEqual(expected);
    expect(counts[0] + counts[1]).toBe(expected.length);
    expect(await balance()).toBe((-(999 * expected.length) / 100).toFixed(2));
  });

  it('a rule that is not yet due is left alone', async () => {
    await insertRule({ startDate: '2999-01-01' });
    expect(await processRecurringTransactions()).toBe(0);
    expect(await postedDates()).toEqual([]);
  });
});

describe('a failure part-way through posting', () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Wraps a real client so one statement fails, as if the process died or
  // the database errored at that point. Everything else runs for real.
  function failingAt(client, pattern, { delayMs = 0 } = {}) {
    return {
      async query(sql, params) {
        if (pattern.test(sql)) {
          if (delayMs) await sleep(delayMs);
          throw new Error('Simulated failure after the claim');
        }
        return client.query(sql, params);
      },
    };
  }

  async function nextRun(ruleId) {
    const { rows } = await pool.query('SELECT next_run_date FROM recurring_transactions WHERE id = $1', [ruleId]);
    return rows[0].next_run_date;
  }

  it.each([
    ['inserting the transaction', /INSERT INTO transactions/],
    ['updating the balance', /UPDATE accounts/],
  ])('a failure while %s undoes the claim, so the payment is neither lost nor doubled', async (_label, pattern) => {
    const rule = await insertRule({ startDate: '2026-01-15' });

    await expect(inTransaction((client) => processRule(failingAt(client, pattern), rule))).rejects.toThrow(/Simulated/);

    expect(await postedDates()).toEqual([]);
    expect(await balance()).toBe('0.00');
    expect(await nextRun(rule.id)).toBe('2026-01-15'); // still due: not skipped

    // A retry picks it up and posts it exactly once; repeating the retry
    // with the same (now stale) rule row posts nothing more.
    const { rows: [fresh] } = await pool.query('SELECT * FROM recurring_transactions WHERE id = $1', [rule.id]);
    expect(await inTransaction((client) => processRule(client, fresh))).toBe('2026-02-15');
    expect(await inTransaction((client) => processRule(client, fresh))).toBeNull();
    expect(await postedDates()).toEqual(['2026-01-15']);
    expect(await balance()).toBe('-9.99');
    expect(await nextRun(rule.id)).toBe('2026-02-15');
  });

  it('if the run holding the claim fails, a run waiting on it posts the payment once', async () => {
    const rule = await insertRule({ startDate: '2026-01-15' });

    const [first, second] = await Promise.allSettled([
      inTransaction((client) => processRule(failingAt(client, /INSERT INTO transactions/, { delayMs: 300 }), rule)),
      sleep(50).then(() => inTransaction((client) => processRule(client, rule))),
    ]);

    expect(first.status).toBe('rejected');
    expect(second).toEqual({ status: 'fulfilled', value: '2026-02-15' });
    expect(await postedDates()).toEqual(['2026-01-15']);
    expect(await balance()).toBe('-9.99');
  });
});

describe('dates read back from Postgres', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  // The server's own time zone must not move a payment to another day.
  it.each(['Europe/London', 'Australia/Sydney'])('posts on the right day when the server clock is %s', async (tz) => {
    process.env.TZ = tz;
    let rule = await insertRule({ startDate: '2026-06-15' });
    ({ rows: [rule] } = await pool.query('SELECT * FROM recurring_transactions WHERE id = $1', [rule.id]));
    await inTransaction((client) => processRule(client, rule));
    process.env.TZ = originalTz;

    expect(await postedDates()).toEqual(['2026-06-15']);
    const { rows } = await pool.query("SELECT to_char(next_run_date, 'YYYY-MM-DD') AS d FROM recurring_transactions WHERE id = $1", [rule.id]);
    expect(rows[0].d).toBe('2026-07-15');
  });
});
