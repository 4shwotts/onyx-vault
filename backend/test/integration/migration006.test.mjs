// Migration 006 against a database shaped like the live one before it
// (migrations 001–005 only), with real accounts in it.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { Client } = require('pg');
const { assertSafeTestDatabaseUrl } = require('../../src/testing/dbGuard.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = (name) => fs.readFileSync(path.resolve(here, '../../db/migrations', name), 'utf8');
const BEFORE = ['001_initial.sql', '002_auth_hardening.sql', '003_recurring_and_anomaly.sql', '004_recurring_day_of_month.sql', '005_sessions.sql'];

const DB_NAME = 'onyx_vault_migration006_test';
const baseUrl = new URL(process.env.TEST_DATABASE_URL);
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
const dbUrl = new URL(baseUrl);
dbUrl.pathname = `/${DB_NAME}`;

let db;

async function admin(sql) {
  const client = new Client({ connectionString: adminUrl.toString(), ssl: false });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

beforeEach(async () => {
  assertSafeTestDatabaseUrl(dbUrl.toString());
  await admin(`DROP DATABASE IF EXISTS ${DB_NAME}`);
  await admin(`CREATE DATABASE ${DB_NAME}`);
  db = new Client({ connectionString: dbUrl.toString(), ssl: false });
  await db.connect();
  for (const file of BEFORE) await db.query(migration(file));
  await db.query(`
    INSERT INTO users (email, password_hash, email_verified) VALUES
      ('first@gmail.com', 'x', TRUE), ('second@outlook.com', 'y', FALSE);
  `);
});

afterEach(async () => {
  await db?.end();
  await admin(`DROP DATABASE IF EXISTS ${DB_NAME}`);
});

describe('migration 006', () => {
  it('marks every existing account as real, and changes nothing else about them', async () => {
    const before = (await db.query('SELECT id, email, password_hash, email_verified, created_at FROM users ORDER BY id')).rows;
    await db.query(migration('006_demo_accounts.sql'));
    const after = (await db.query('SELECT id, email, password_hash, email_verified, created_at, is_demo, demo_expires_at FROM users ORDER BY id')).rows;

    expect(after.map(({ is_demo: _d, demo_expires_at: _e, ...rest }) => rest)).toEqual(before);
    expect(after.every((u) => u.is_demo === false && u.demo_expires_at === null)).toBe(true);
  });

  it('changes nothing when run a second time', async () => {
    await db.query(migration('006_demo_accounts.sql'));
    const before = (await db.query('SELECT * FROM users ORDER BY id')).rows;
    await db.query(migration('006_demo_accounts.sql'));
    expect((await db.query('SELECT * FROM users ORDER BY id')).rows).toEqual(before);
  });

  it('the code that is live today can still create accounts afterwards', async () => {
    await db.query(migration('006_demo_accounts.sql'));
    const { rows } = await db.query(
      "INSERT INTO users (email, password_hash, email_verified) VALUES ('new@gmail.com', 'z', FALSE) RETURNING is_demo, demo_expires_at"
    );
    expect(rows[0]).toEqual({ is_demo: false, demo_expires_at: null });
  });

  it('if an existing account broke the rule, nothing would change at all (it is one transaction)', async () => {
    await db.query("INSERT INTO users (email, password_hash) VALUES ('odd@example.invalid', 'x')");
    await expect(db.query(migration('006_demo_accounts.sql'))).rejects.toThrow(/users_demo_shape_check/);
    await db.query('ROLLBACK').catch(() => {});
    const { rows } = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('is_demo', 'demo_expires_at')");
    expect(rows).toEqual([]);
  });
});
