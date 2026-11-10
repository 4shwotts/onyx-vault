// Every way a session can be bad must end in a clean 401.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { api, pool, resetDatabase, createUser } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

const PROTECTED = [
  ['GET', '/auth/me'],
  ['GET', '/accounts'],
  ['GET', '/transactions'],
  ['GET', '/categories'],
  ['GET', '/recurring'],
  ['POST', '/recurring/run-now'],
];

let user;

beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
});
afterAll(() => pool.end());

function send(method, path, cookie) {
  const client = api(undefined, { cookie });
  return method === 'GET' ? client.get(path) : client.post(path);
}

function payloadOf(cookie) {
  return jwt.decode(cookie.replace(/^token=/, ''));
}

describe.each(PROTECTED)('%s %s', (method, path) => {
  it('works with a valid session', async () => {
    expect((await send(method, path, user.cookie)).status).toBe(200);
  });

  it.each([
    ['no cookie', () => undefined],
    ['an empty cookie', () => 'token='],
    ['a cookie that is not a JWT', () => 'token=not-a-jwt'],
    ['a tampered signature', () => `${user.cookie.slice(0, -4)}AAAA`],
    ['a token signed with another secret', () => `token=${jwt.sign(payloadOf(user.cookie), 'some-other-secret')}`],
    ['an unsigned token (alg: none)', () => `token=${jwt.sign(payloadOf(user.cookie), null, { algorithm: 'none' })}`],
    ['an expired token', () => {
      const { exp: _e, iat: _i, ...claims } = payloadOf(user.cookie);
      return `token=${jwt.sign({ ...claims, iat: Math.floor(Date.now() / 1000) - 7200 }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
    }],
  ])('is refused with %s', async (_label, makeCookie) => {
    const res = await send(method, path, makeCookie());
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: expect.any(String) });
  });
});

describe('session lifetime', () => {
  const { SESSION_TTL_SECONDS, deleteExpiredSessions } = require('../../src/auth/sessions.js');

  it('the session row, the JWT and the cookie all last 24 hours', async () => {
    const res = await api().post('/auth/login').send({ email: user.email, password: user.password });
    const setCookie = [].concat(res.headers['set-cookie']).find((c) => c.startsWith('token='));
    const { iat, exp } = payloadOf(setCookie.split(';')[0]);

    expect(SESSION_TTL_SECONDS).toBe(86400);
    expect(exp - iat).toBe(86400);
    expect(setCookie).toMatch(/Max-Age=86400/);
    const { rows } = await pool.query(
      `SELECT EXTRACT(EPOCH FROM (expires_at - created_at))::int AS seconds
       FROM sessions WHERE user_id = $1 ORDER BY id DESC LIMIT 1`,
      [user.id]
    );
    expect(rows[0].seconds).toBe(86400);
  });

  it('an expired session is refused even though its JWT is still valid', async () => {
    await pool.query("UPDATE sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE user_id = $1", [user.id]);
    expect((await send('GET', '/accounts', user.cookie)).status).toBe(401);
  });

  it('clean-up deletes expired sessions only', async () => {
    const other = await createUser();
    await pool.query("UPDATE sessions SET expires_at = NOW() - INTERVAL '1 hour' WHERE user_id = $1", [user.id]);

    expect(await deleteExpiredSessions()).toBe(1);
    const { rows } = await pool.query('SELECT user_id FROM sessions');
    expect(rows).toEqual([{ user_id: other.id }]);
    expect((await send('GET', '/auth/me', other.cookie)).status).toBe(200);
    expect(await deleteExpiredSessions()).toBe(0);
  });

  it('stores only a hash of the session id', async () => {
    const { sid } = payloadOf(user.cookie);
    const { rows } = await pool.query('SELECT token_hash FROM sessions WHERE user_id = $1', [user.id]);
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].token_hash).not.toBe(sid);
  });
});

describe('sessions that outlive their user', () => {
  it('a session for a user who no longer exists is refused everywhere', async () => {
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    for (const [method, path] of PROTECTED) {
      expect((await send(method, path, user.cookie)).status, `${method} ${path}`).toBe(401);
    }
  });

  it('a token minted by hand for a real user id, with no session behind it, is refused', async () => {
    const forged = `token=${jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
    expect((await send('GET', '/accounts', forged)).status).toBe(401);
  });
});
