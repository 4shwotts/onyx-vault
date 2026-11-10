const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { hashToken } = require('../utils/tokens');

// One lifetime for everything that makes up a session: the database row,
// the JWT inside the cookie, and the cookie itself.
const SESSION_TTL_SECONDS = 24 * 60 * 60;

function jwtSecret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set. Refusing to start.');
  return process.env.JWT_SECRET;
}

// Creates a session row and returns the signed JWT for the cookie. The
// JWT carries the random session id; only its hash is stored, so a copy
// of the sessions table can't be turned back into working cookies.
async function createSession(userId, db = pool) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  await db.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + make_interval(secs => $3))`,
    [userId, hashToken(sessionId), SESSION_TTL_SECONDS]
  );
  return jwt.sign({ userId, sid: sessionId }, jwtSecret(), { algorithm: 'HS256', expiresIn: SESSION_TTL_SECONDS });
}

// Returns { userId, sessionId } for a cookie whose JWT is valid AND whose
// session still exists and hasn't expired; otherwise null.
async function verifySession(token) {
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] });
  } catch {
    return null;
  }
  if (!payload || typeof payload.sid !== 'string' || !Number.isInteger(payload.userId)) return null;

  const { rows } = await pool.query(
    'SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > NOW()',
    [hashToken(payload.sid)]
  );
  if (rows.length === 0 || rows[0].user_id !== payload.userId) return null;
  return { userId: payload.userId, sessionId: payload.sid };
}

async function endSession(sessionId) {
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(sessionId)]);
}

async function endAllSessions(userId, db = pool) {
  await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

// Housekeeping: run on server start and hourly (see index.js).
async function deleteExpiredSessions() {
  const result = await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
  return result.rowCount;
}

module.exports = {
  SESSION_TTL_SECONDS,
  createSession,
  verifySession,
  endSession,
  endAllSessions,
  deleteExpiredSessions,
};
