// Shared helpers for API tests. Everything from src/ is loaded with
// Node's own require (not Vitest's import) so the test and the app share
// one module instance — one pool, one set of rate limiters, one outbox.
import { createRequire } from 'node:module';
import request from 'supertest';

const require = createRequire(import.meta.url);

export const pool = require('../src/db.js');
export const { createApp } = require('../src/app.js');
export const { testOutbox } = require('../src/email.js');
const bcrypt = require('bcrypt');

export const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN;

export async function resetDatabase() {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  testOutbox.length = 0;
}

// Rate limits are per client IP. The app trusts one proxy hop, so a test
// can give each simulated visitor its own address via X-Forwarded-For and
// stop unrelated tests sharing a rate-limit bucket. Tests that are about
// rate limits use a fixed address on purpose.
let ipCounter = 0;
export function uniqueIp() {
  ipCounter += 1;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

let sharedApp;
function defaultApp() {
  sharedApp ??= createApp();
  return sharedApp;
}

// A small client: every request carries the given cookie, IP and Origin.
export function api(app = defaultApp(), { cookie, ip = uniqueIp(), origin } = {}) {
  const decorate = (req) => {
    req.set('X-Forwarded-For', ip);
    if (cookie) req.set('Cookie', cookie);
    if (origin) req.set('Origin', origin);
    return req;
  };
  const agent = request(app);
  return {
    get: (path) => decorate(agent.get(path)),
    post: (path) => decorate(agent.post(path)),
    put: (path) => decorate(agent.put(path)),
    patch: (path) => decorate(agent.patch(path)),
    delete: (path) => decorate(agent.delete(path)),
  };
}

// The value to send back as a Cookie header, from a response's Set-Cookie.
export function sessionCookieFrom(res) {
  const header = [].concat(res.headers['set-cookie'] || []).find((c) => c.startsWith('token='));
  return header ? header.split(';')[0] : null;
}

let userCounter = 0;

// Creates a verified user directly in the database, then logs in through
// the real login endpoint, so the cookie is exactly what a browser gets.
export async function createUser({ email, password = 'correct-horse-battery', verified = true, app } = {}) {
  userCounter += 1;
  const address = email || `user${userCounter}.${Date.now()}@gmail.com`;
  const hash = await bcrypt.hash(password, 4);
  const { rows } = await pool.query(
    'INSERT INTO users (email, password_hash, email_verified) VALUES ($1, $2, $3) RETURNING id, email',
    [address, hash, verified]
  );
  const user = { ...rows[0], password };
  if (!verified) return user;

  const res = await api(app).post('/auth/login').send({ email: address, password });
  if (res.status !== 200) throw new Error(`Test login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { ...user, cookie: sessionCookieFrom(res) };
}

export async function createAccount(userId, name = 'Current', type = 'current') {
  const { rows } = await pool.query(
    'INSERT INTO accounts (user_id, name, type) VALUES ($1, $2, $3) RETURNING *',
    [userId, name, type]
  );
  return rows[0];
}

export async function createCategory(userId, name = 'Groceries') {
  const { rows } = await pool.query(
    'INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING *',
    [userId, name]
  );
  return rows[0];
}

// Inserts a transaction and moves the balance, as the API does.
export async function createTransaction(accountId, { amount = '-10.00', date = '2026-10-15', description = 'Corner shop', categoryId = null } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO transactions (account_id, category_id, amount, description, date)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [accountId, categoryId, amount, description, date]
  );
  await pool.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, accountId]);
  return rows[0];
}

export async function createRule(userId, accountId, { startDate, amount = '-9.99', frequency = 'monthly', description = 'Streaming plan' }) {
  const { rows } = await pool.query(
    `INSERT INTO recurring_transactions
       (user_id, account_id, amount, description, frequency, next_run_date, start_date, day_of_month)
     VALUES ($1, $2, $3, $4, $5, $6::date, $6::date, EXTRACT(DAY FROM $6::date))
     RETURNING *`,
    [userId, accountId, amount, description, frequency, startDate]
  );
  return rows[0];
}

export async function todayUtc() {
  const { rows } = await pool.query("SELECT ((NOW() AT TIME ZONE 'UTC')::date)::text AS d");
  return rows[0].d;
}

export function lastEmailTo(address) {
  const mail = [...testOutbox].reverse().find((m) => m.to === address);
  if (!mail) return null;
  return { ...mail, token: new URL(mail.link).searchParams.get('token') };
}

export async function count(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return Number(rows[0].count);
}

// Response text must never contain these.
export const SECRET_PATTERNS = [/password_hash/i, /\$2[aby]\$\d{2}\$/, /token_hash/i, new RegExp(process.env.JWT_SECRET)];
