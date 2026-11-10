// Migration 004 against data shaped like the live database before it: a
// separate throwaway database built from migrations 001–003 only, seeded
// with rules the old code created (including ones that have drifted).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { Client } = require('pg');
const { assertSafeTestDatabaseUrl } = require('../../src/testing/dbGuard.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = (name) => fs.readFileSync(path.resolve(here, '../../db/migrations', name), 'utf8');

const DB_NAME = 'onyx_vault_migration004_test';
const baseUrl = new URL(process.env.TEST_DATABASE_URL);
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
const migrationUrl = new URL(baseUrl);
migrationUrl.pathname = `/${DB_NAME}`;

let db;

async function withAdmin(fn) {
  const admin = new Client({ connectionString: adminUrl.toString(), ssl: false });
  await admin.connect();
  try {
    await fn(admin);
  } finally {
    await admin.end();
  }
}

async function rule(id) {
  const { rows } = await db.query(
    `SELECT to_char(start_date, 'YYYY-MM-DD') AS start_date, day_of_month,
            to_char(next_run_date, 'YYYY-MM-DD') AS next_run_date
     FROM recurring_transactions WHERE id = $1`,
    [id]
  );
  return rows[0];
}

beforeAll(async () => {
  assertSafeTestDatabaseUrl(migrationUrl.toString());
  await withAdmin(async (admin) => {
    await admin.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
    await admin.query(`CREATE DATABASE ${DB_NAME}`);
    await admin.query(`ALTER DATABASE ${DB_NAME} SET DateStyle TO 'ISO, MDY'`);
  });

  db = new Client({ connectionString: migrationUrl.toString(), ssl: false });
  await db.connect();
  for (const file of ['001_initial.sql', '002_auth_hardening.sql', '003_recurring_and_anomaly.sql']) {
    await db.query(migration(file));
  }

  // Data as the old code left it. Timestamps make each rule's first
  // payment come after the rule was created, as in real life.
  await db.query(`
    INSERT INTO users (id, email, password_hash, email_verified) VALUES (1, 'old@gmail.com', 'x', TRUE);
    INSERT INTO accounts (id, user_id, name, type) VALUES (1, 1, 'Current', 'current');

    -- 1: monthly on the 31st since January; drifted, next run 28 November.
    INSERT INTO recurring_transactions (id, user_id, account_id, amount, description, frequency, next_run_date, created_at)
      VALUES (1, 1, 1, -9.99, 'Streaming plan', 'monthly', '2026-11-28', '2026-01-31 08:00');
    INSERT INTO transactions (account_id, amount, description, date, is_recurring, created_at) VALUES
      (1, -9.99, 'Streaming plan', '2026-01-31', TRUE, '2026-01-31 08:00:01'),
      (1, -9.99, 'Streaming plan', '2026-02-28', TRUE, '2026-02-28 01:00'),
      (1, -9.99, 'Streaming plan', '2026-03-28', TRUE, '2026-03-28 01:00');

    -- 2: monthly on the 30th; drifted to the 28th, next run in December
    -- (December has 31 days, so it goes back to the 30th).
    INSERT INTO recurring_transactions (id, user_id, account_id, amount, description, frequency, next_run_date, created_at)
      VALUES (2, 1, 1, -650.00, 'Rent', 'monthly', '2026-12-28', '2026-01-30 09:00');
    INSERT INTO transactions (account_id, amount, description, date, is_recurring, created_at) VALUES
      (1, -650.00, 'Rent', '2026-01-30', TRUE, '2026-01-30 09:00:01'),
      (1, -650.00, 'Rent', '2026-02-28', TRUE, '2026-02-28 01:00');

    -- 3: created for the future, never posted, so never drifted.
    INSERT INTO recurring_transactions (id, user_id, account_id, amount, description, frequency, next_run_date, created_at)
      VALUES (3, 1, 1, 2100.00, 'Salary', 'monthly', '2026-12-25', '2026-11-01 10:00');

    -- 4: weekly; day_of_month is recorded but the run date is left alone.
    INSERT INTO recurring_transactions (id, user_id, account_id, amount, description, frequency, next_run_date, created_at)
      VALUES (4, 1, 1, -5.00, 'Lunch club', 'weekly', '2026-11-12', '2026-10-01 12:00');
    INSERT INTO transactions (account_id, amount, description, date, is_recurring, created_at) VALUES
      (1, -5.00, 'Lunch club', '2026-10-01', TRUE, '2026-10-01 12:00:01');

    -- 5: a one-off manual transaction that looks like rule 1 but predates
    -- it must not be mistaken for its first payment.
    INSERT INTO recurring_transactions (id, user_id, account_id, amount, description, frequency, next_run_date, created_at)
      VALUES (5, 1, 1, -12.00, 'Gym', 'monthly', '2026-11-20', '2026-06-20 07:00');
    INSERT INTO transactions (account_id, amount, description, date, is_recurring, created_at) VALUES
      (1, -12.00, 'Gym', '2026-03-03', TRUE, '2026-03-03 07:00'),
      (1, -12.00, 'Gym', '2026-06-20', TRUE, '2026-06-20 07:00:01');

    SELECT setval('recurring_transactions_id_seq', 5);
  `);

  await db.query(migration('004_recurring_day_of_month.sql'));
});

afterAll(async () => {
  await db?.end();
  await withAdmin((admin) => admin.query(`DROP DATABASE IF EXISTS ${DB_NAME}`));
});

describe('migration 004', () => {
  it('recovers the start day of a rule that drifted to the 28th and fixes its next run', async () => {
    expect(await rule(1)).toEqual({ start_date: '2026-01-31', day_of_month: 31, next_run_date: '2026-11-30' });
  });

  it('moves a drifted rule to its own day in a long month', async () => {
    expect(await rule(2)).toEqual({ start_date: '2026-01-30', day_of_month: 30, next_run_date: '2026-12-30' });
  });

  it('uses the next run date for a rule that has never posted', async () => {
    expect(await rule(3)).toEqual({ start_date: '2026-12-25', day_of_month: 25, next_run_date: '2026-12-25' });
  });

  it('leaves weekly run dates alone', async () => {
    expect(await rule(4)).toMatchObject({ start_date: '2026-10-01', next_run_date: '2026-11-12' });
  });

  it('ignores matching transactions from before the rule existed', async () => {
    expect(await rule(5)).toEqual({ start_date: '2026-06-20', day_of_month: 20, next_run_date: '2026-11-20' });
  });

  it('changes nothing when run a second time', async () => {
    const before = await db.query('SELECT * FROM recurring_transactions ORDER BY id');
    await db.query(migration('004_recurring_day_of_month.sql'));
    const after = await db.query('SELECT * FROM recurring_transactions ORDER BY id');
    expect(after.rows).toEqual(before.rows);
  });

  it('still accepts rules inserted the way the currently live code inserts them', async () => {
    const { rows } = await db.query(
      `INSERT INTO recurring_transactions (user_id, account_id, category_id, amount, description, frequency, next_run_date)
       VALUES (1, 1, NULL, -3.50, 'Old-style rule', 'monthly', '2026-12-31') RETURNING start_date, day_of_month`
    );
    expect(rows[0]).toEqual({ start_date: null, day_of_month: null });
  });

  it('refuses an impossible day of the month', async () => {
    await expect(db.query('UPDATE recurring_transactions SET day_of_month = 32 WHERE id = 3'))
      .rejects.toThrow(/day_of_month_check/);
  });
});
