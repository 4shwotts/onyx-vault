const crypto = require('crypto');
const pool = require('../db');
const { buildDemoData } = require('./seedData');
const { penceToDecimal } = require('../utils/money');
const { maxLiveDemos } = require('../config');
const { createSession } = require('../auth/sessions');

// Every demo address uses this reserved domain (.invalid can never be a
// real email domain), so nothing can ever be emailed to a demo account.
const DEMO_DOMAIN = 'demo.onyx-vault.invalid';
const DEMO_TTL_HOURS = 24;

// Taken (inside a transaction) by every demo creation, so two visitors
// starting a demo at the same moment can't both squeeze under the cap.
const DEMO_LOCK_KEY = 4206661;

// Demo accounts have no password. This is not a valid bcrypt hash, so no
// password can ever match it; the login route also refuses demo accounts
// before comparing anything.
const NO_PASSWORD = '!demo-account-has-no-password';

function isDemoEmail(email) {
  return typeof email === 'string' && email.trim().toLowerCase().endsWith(`@${DEMO_DOMAIN}`);
}

// Deletes every demo account that has expired, with all its data (ON
// DELETE CASCADE). The WHERE clause can only ever match demo rows: real
// accounts can't have is_demo = TRUE or a .invalid address (enforced by a
// CHECK constraint and a trigger, see migration 006).
async function cleanupExpiredDemos(db = pool) {
  const result = await db.query(
    `DELETE FROM users
     WHERE is_demo = TRUE
       AND demo_expires_at <= NOW()
       AND email LIKE '%@' || $1
     RETURNING id`,
    [DEMO_DOMAIN]
  );
  return result.rowCount;
}

// Ends one demo straight away (logout or "End demo").
async function endDemo(userId, db = pool) {
  const result = await db.query('DELETE FROM users WHERE id = $1 AND is_demo = TRUE RETURNING id', [userId]);
  return result.rowCount === 1;
}

async function insertDemoData(client, userId, data) {
  const accountIds = {};
  for (const account of data.accounts) {
    const { rows } = await client.query(
      'INSERT INTO accounts (user_id, name, type) VALUES ($1, $2, $3) RETURNING id',
      [userId, account.name, account.type]
    );
    accountIds[account.key] = rows[0].id;
  }

  const categoryIds = {};
  for (const name of data.categories) {
    const { rows } = await client.query('INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING id', [userId, name]);
    categoryIds[name] = rows[0].id;
  }

  // One multi-row insert for all the transactions.
  const values = [];
  const placeholders = data.transactions.map((t, i) => {
    const base = i * 7;
    values.push(accountIds[t.account], categoryIds[t.category], penceToDecimal(t.pence), t.description, t.date, t.isRecurring, t.isAnomaly);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
  });
  if (placeholders.length > 0) {
    await client.query(
      `INSERT INTO transactions (account_id, category_id, amount, description, date, is_recurring, is_anomaly)
       VALUES ${placeholders.join(', ')}`,
      values
    );
  }

  // Balances are exactly the sum of each account's transactions.
  await client.query(
    `UPDATE accounts a
     SET balance = COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.account_id = a.id), 0)
     WHERE a.user_id = $1`,
    [userId]
  );

  for (const rule of data.rules) {
    await client.query(
      `INSERT INTO recurring_transactions
         (user_id, account_id, category_id, amount, description, frequency, next_run_date, start_date, day_of_month)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, accountIds[rule.account], categoryIds[rule.category], penceToDecimal(rule.pence), rule.description,
        rule.frequency, rule.nextRunDate, rule.startDate, rule.dayOfMonth]
    );
  }
}

// Creates a fresh demo account full of made-up data and signs it in.
// Returns { busy: true } when the cap on live demos is reached, otherwise
// { user, sessionToken }.
async function createDemoAccount() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [DEMO_LOCK_KEY]);

    // Clear out expired demos first, so they don't count against the cap.
    await cleanupExpiredDemos(client);

    const { rows: [{ live }] } = await client.query(
      'SELECT COUNT(*)::int AS live FROM users WHERE is_demo = TRUE AND demo_expires_at > NOW()'
    );
    if (live >= maxLiveDemos()) {
      await client.query('ROLLBACK');
      return { busy: true };
    }

    const email = `demo-${crypto.randomUUID()}@${DEMO_DOMAIN}`;
    const { rows: [user] } = await client.query(
      `INSERT INTO users (email, password_hash, email_verified, is_demo, demo_expires_at)
       VALUES ($1, $2, TRUE, TRUE, NOW() + make_interval(hours => $3))
       RETURNING id, email, demo_expires_at`,
      [email, NO_PASSWORD, DEMO_TTL_HOURS]
    );

    const { rows: [{ today }] } = await client.query("SELECT ((NOW() AT TIME ZONE 'UTC')::date)::text AS today");
    await insertDemoData(client, user.id, buildDemoData(today));

    // The session lasts exactly as long as the demo (both 24 hours).
    const sessionToken = await createSession(user.id, client);
    await client.query('COMMIT');
    return { user, sessionToken };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  DEMO_DOMAIN,
  DEMO_TTL_HOURS,
  isDemoEmail,
  cleanupExpiredDemos,
  endDemo,
  createDemoAccount,
};
