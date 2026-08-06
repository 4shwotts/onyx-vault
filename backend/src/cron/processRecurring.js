const pool = require('../db');
const { isAnomalous } = require('../utils/anomaly');

// Computes the next run date, working entirely in UTC using the date's
// own y/m/d components (never via `new Date(string)` + local getters,
// which can silently shift by a day depending on the server's timezone).
//
// Accepts either a JS Date object (what node-postgres returns for a DATE
// column by default) or a 'YYYY-MM-DD' string, so it works regardless of
// where the value came from.
//
// Monthly rules land on the same day-of-month, clamped to the target
// month's actual last day — so Jan 31 -> Feb 28 (or 29 in a leap year).
function nextDate(currentDate, frequency) {
  let y, m, day;
  if (currentDate instanceof Date) {
    y = currentDate.getUTCFullYear();
    m = currentDate.getUTCMonth() + 1;
    day = currentDate.getUTCDate();
  } else {
    [y, m, day] = String(currentDate).split('-').map(Number);
  }

  if (frequency === 'weekly') {
    const d = new Date(Date.UTC(y, m - 1, day + 7));
    return d.toISOString().slice(0, 10);
  }

  // monthly
  let targetYear = y;
  let targetMonthIndex = m;
  if (targetMonthIndex > 11) {
    targetMonthIndex = 0;
    targetYear += 1;
  }

  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const dayToUse = Math.min(day, lastDayOfTargetMonth);

  const result = new Date(Date.UTC(targetYear, targetMonthIndex, dayToUse));
  return result.toISOString().slice(0, 10);
}

// Processes ONE recurring rule that's already known to be due: creates the
// real transaction (flagging it for anomaly detection same as a manual
// add), updates the account balance, and advances next_run_date. Must be
// called with an already-BEGUN client — the caller owns the transaction
// boundary (COMMIT/ROLLBACK), since this gets reused both by the cron
// sweep (many rules per call) and by immediate processing on rule
// creation (one rule, right after INSERT).
//
// Returns the new next_run_date.
async function processRule(client, rule) {
  const flagged = await isAnomalous(client, rule.user_id, rule.category_id, Number(rule.amount));

  await client.query(
    `INSERT INTO transactions (account_id, category_id, amount, description, date, is_recurring, is_anomaly)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6)`,
    [rule.account_id, rule.category_id, rule.amount, rule.description, rule.next_run_date, flagged]
  );

  await client.query(
    'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
    [rule.amount, rule.account_id]
  );

  const newNextRun = nextDate(rule.next_run_date, rule.frequency);
  await client.query(
    'UPDATE recurring_transactions SET next_run_date = $1 WHERE id = $2',
    [newNextRun, rule.id]
  );

  return newNextRun;
}

// Finds every recurring rule that's due (next_run_date <= today, compared
// explicitly in UTC to avoid any server-timezone ambiguity) and processes
// each one via processRule, atomically per-rule.
async function processRecurringTransactions() {
  const due = await pool.query(
    "SELECT * FROM recurring_transactions WHERE next_run_date <= (NOW() AT TIME ZONE 'UTC')::date"
  );

  let processed = 0;

  for (const rule of due.rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await processRule(client, rule);
      await client.query('COMMIT');
      processed++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Recurring processing error for rule', rule.id, ':', err.message);
    } finally {
      client.release();
    }
  }

  return processed;
}

module.exports = { processRecurringTransactions, processRule, nextDate };