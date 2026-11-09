// Shared helpers for API tests. Everything from src/ is loaded with
// Node's own require (not Vitest's import) so the test and the app share
// one module instance — one pool, one set of rate limiters.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const pool = require('../src/db.js');
export const { createApp } = require('../src/app.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

export async function resetDatabase() {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
}

let userCounter = 0;

// Creates a verified user directly in the database and returns it with a
// valid session cookie, for tests that aren't about sign-up itself.
export async function createUser({ email, password = 'correct-horse-battery', verified = true } = {}) {
  userCounter += 1;
  const address = email || `user${userCounter}@gmail.com`;
  const hash = await bcrypt.hash(password, 4);
  const { rows } = await pool.query(
    'INSERT INTO users (email, password_hash, email_verified) VALUES ($1, $2, $3) RETURNING id, email',
    [address, hash, verified]
  );
  const user = rows[0];
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { ...user, password, cookie: `token=${token}` };
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
