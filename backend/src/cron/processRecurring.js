const pool = require('../db');
const { isAnomalous } = require('../utils/anomaly');

const { anchorDayOf, nextDate } = require('../utils/schedule');

// Posts ONE due recurring rule. Must be called with an already-BEGUN
// client: the caller owns COMMIT/ROLLBACK, so claiming the rule, posting
// the transaction and updating the balance all commit together or not at
// all. A failure part-way through rolls back the claim as well, so the
// payment is retried next time rather than skipped.
//
// The claim moves next_run_date on only if it still holds the value this
// caller read. If another run (the nightly job, "run now", a double-click)
// has already posted it, or is posting it right now, the claim matches no
// row — Postgres makes the second claimant wait for the first to commit
// or roll back, then re-checks — and nothing is posted twice.
//
// Returns the new next_run_date, or null when the rule had already been
// handled by someone else.
async function processRule(client, rule) {
  const runDate = rule.next_run_date;
  const newNextRun = nextDate(runDate, rule.frequency, anchorDayOf(rule));

  const claim = await client.query(
    `UPDATE recurring_transactions SET next_run_date = $1
     WHERE id = $2 AND next_run_date = $3
     RETURNING id`,
    [newNextRun, rule.id, runDate]
  );
  if (claim.rowCount === 0) return null;

  const flagged = await isAnomalous(client, rule.user_id, rule.category_id, Number(rule.amount));

  await client.query(
    `INSERT INTO transactions (account_id, category_id, amount, description, date, is_recurring, is_anomaly)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6)`,
    [rule.account_id, rule.category_id, rule.amount, rule.description, runDate, flagged]
  );

  await client.query(
    'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
    [rule.amount, rule.account_id]
  );

  return newNextRun;
}

// Most missed payments one rule may catch up in a single run. A rule that
// is further behind than this (e.g. an old start date) carries on catching
// up on the next run.
const MAX_CATCH_UP_PER_RUN = 12;

// Today's date in UTC, from the database clock, as 'YYYY-MM-DD'.
async function todayUtc() {
  const { rows } = await pool.query("SELECT ((NOW() AT TIME ZONE 'UTC')::date)::text AS today");
  return rows[0].today;
}

// Posts one payment in its own database transaction.
async function postOnce(rule) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const next = await processRule(client, rule);
    await client.query('COMMIT');
    return next;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Posts every payment of one rule that is due on or before `today`, oldest
// first, up to `max`. Each payment is dated on the day it was due, and each
// goes through processRule's atomic claim in its own transaction: if
// another run (a sweep, "run now", a login) claims the same payment first,
// this run stops and leaves the rest to that run. Nothing posts twice; a
// failure leaves earlier payments in place and the failed one still due.
async function catchUpRule(rule, today, max = MAX_CATCH_UP_PER_RUN) {
  let current = rule;
  let posted = 0;
  while (posted < max && current.next_run_date <= today) {
    const next = await postOnce(current);
    if (!next) break;
    posted += 1;
    current = { ...current, next_run_date: next };
  }
  return posted;
}

// Catches up each given rule in turn. One rule's failure (logged) doesn't
// block any other. Returns how many payments were actually posted.
async function processRules(rules, label, { today, max = MAX_CATCH_UP_PER_RUN } = {}) {
  const runDate = today || await todayUtc();
  let processed = 0;
  for (const rule of rules) {
    try {
      processed += await catchUpRule(rule, runDate, max);
    } catch (err) {
      console.error(`${label} error for rule`, rule.id, ':', err.message);
    }
  }
  return processed;
}

// Sweep: every rule due today or earlier (in UTC), all users. Runs when the
// server starts (the free hosting plan sleeps, so a fixed nightly time can
// be missed) and hourly while it is awake.
async function processRecurringTransactions() {
  const today = await todayUtc();
  const due = await pool.query('SELECT * FROM recurring_transactions WHERE next_run_date <= $1 ORDER BY id', [today]);
  return processRules(due.rows, 'Recurring processing', { today });
}

// One user's due rules only: used by "run now" and after login.
async function processDueRulesForUser(userId) {
  const today = await todayUtc();
  const due = await pool.query(
    'SELECT * FROM recurring_transactions WHERE user_id = $1 AND next_run_date <= $2 ORDER BY id',
    [userId, today]
  );
  return processRules(due.rows, 'Recurring processing for user', { today });
}

module.exports = {
  MAX_CATCH_UP_PER_RUN,
  processRecurringTransactions,
  processDueRulesForUser,
  processRule,
  processRules,
  catchUpRule,
  nextDate,
  todayUtc,
};
