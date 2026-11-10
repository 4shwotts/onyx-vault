// Catching up recurring payments that fell due while the server was
// asleep: on wake-up sweeps, "run now" and after login.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import {
  api, pool, resetDatabase, createUser, createAccount, createRule, sessionCookieFrom,
} from '../helpers.mjs';

const require = createRequire(import.meta.url);
const {
  processRecurringTransactions, processDueRulesForUser, todayUtc, MAX_CATCH_UP_PER_RUN,
} = require('../../src/cron/processRecurring.js');
const { settleBackgroundWork } = require('../../src/background.js');

let user;
let account;
let today;

// The same day of the month, `n` months before `dateKey` (clamped to the
// month's last day), worked out independently of the code under test.
function monthsBefore(dateKey, n, day) {
  let [y, m] = dateKey.split('-').map(Number);
  m -= n;
  while (m < 1) { m += 12; y -= 1; }
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

async function posted() {
  const { rows } = await pool.query('SELECT date, amount FROM transactions WHERE account_id = $1 ORDER BY date, id', [account.id]);
  return rows;
}

async function nextRun(ruleId) {
  const { rows } = await pool.query('SELECT next_run_date FROM recurring_transactions WHERE id = $1', [ruleId]);
  return rows[0].next_run_date;
}

beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
  account = await createAccount(user.id);
  today = await todayUtc();
});
afterAll(async () => {
  await settleBackgroundWork();
  await pool.end();
});

describe('catching up missed payments', () => {
  it('posts every missed month, each dated on the day it was due, not today', async () => {
    // Due on the 1st; started three months before this month.
    const start = monthsBefore(today, 3, 1);
    const rule = await createRule(user.id, account.id, { startDate: start });

    expect(await processRecurringTransactions()).toBe(4);
    const dates = (await posted()).map((t) => t.date);
    expect(dates).toEqual([0, 1, 2, 3].map((i) => monthsBefore(today, 3 - i, 1)));
    expect(dates.every((d) => d <= today)).toBe(true);
    expect(await nextRun(rule.id)).toBe(monthsBefore(today, -1, 1));

    // Nothing more is due, so another sweep posts nothing.
    expect(await processRecurringTransactions()).toBe(0);
  });

  it('catches up weekly rules too', async () => {
    const [y, m, d] = today.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, d - 21)).toISOString().slice(0, 10);
    await createRule(user.id, account.id, { startDate: start, frequency: 'weekly' });
    expect(await processDueRulesForUser(user.id)).toBe(4); // 21, 14, 7 and 0 days ago
  });

  it(`posts at most ${MAX_CATCH_UP_PER_RUN} payments per rule in one run, and continues next run`, async () => {
    const start = monthsBefore(today, 20, 1);
    const rule = await createRule(user.id, account.id, { startDate: start });

    expect(await processRecurringTransactions()).toBe(12);
    expect(await posted()).toHaveLength(12);
    expect(await nextRun(rule.id)).toBe(monthsBefore(today, 8, 1));

    expect(await processRecurringTransactions()).toBe(9); // the remaining 8 months plus this one
    const dates = (await posted()).map((t) => t.date);
    expect(dates).toHaveLength(21);
    expect(new Set(dates).size).toBe(21);
  });

  it('a catch-up for one user and a sweep for everyone, running together, post each payment once', async () => {
    const other = await createUser();
    const otherAccount = await createAccount(other.id);
    await createRule(user.id, account.id, { startDate: monthsBefore(today, 6, 1) });
    await createRule(user.id, account.id, { startDate: monthsBefore(today, 4, 1), amount: '-650.00', description: 'Rent' });
    await createRule(other.id, otherAccount.id, { startDate: monthsBefore(today, 2, 1) });

    const results = await Promise.all([
      processDueRulesForUser(user.id),
      processRecurringTransactions(),
      processDueRulesForUser(user.id),
      processRecurringTransactions(),
    ]);

    expect(results.reduce((a, b) => a + b, 0)).toBe(7 + 5 + 3);
    const { rows } = await pool.query(
      `SELECT description, date, COUNT(*)::int AS n FROM transactions GROUP BY description, date, account_id HAVING COUNT(*) > 1`
    );
    expect(rows).toEqual([]);
    const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM transactions');
    expect(n).toBe(15);
  });

  it('a payment due today is caught up, one due tomorrow is not', async () => {
    const [y, m, d] = today.split('-').map(Number);
    const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    await createRule(user.id, account.id, { startDate: today, description: 'Today' });
    await createRule(user.id, account.id, { startDate: tomorrow, description: 'Tomorrow' });
    expect(await processRecurringTransactions()).toBe(1);
  });
});

describe('catching up after login', () => {
  it('posts missed payments after login without making login wait for them', async () => {
    const rule = await createRule(user.id, account.id, { startDate: monthsBefore(today, 2, 1) });

    // Hold a lock on the rule, so the catch-up can't finish until we let go.
    const blocker = await pool.connect();
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM recurring_transactions WHERE id = $1 FOR UPDATE', [rule.id]);

    try {
      const res = await api().post('/auth/login').send({ email: user.email, password: user.password });
      // Login answered while the catch-up was still blocked.
      expect(res.status).toBe(200);
      expect(sessionCookieFrom(res)).toBeTruthy();
      expect(await posted()).toHaveLength(0);
    } finally {
      await blocker.query('COMMIT');
      blocker.release();
    }

    await settleBackgroundWork();
    expect((await posted()).map((t) => t.date)).toEqual([2, 1, 0].map((n) => monthsBefore(today, n, 1)));
  });

  it('a failed login posts nothing', async () => {
    await createRule(user.id, account.id, { startDate: monthsBefore(today, 1, 1) });
    await api().post('/auth/login').send({ email: user.email, password: 'wrong-password' });
    await settleBackgroundWork();
    expect(await posted()).toHaveLength(0);
  });
});
