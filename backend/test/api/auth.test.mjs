// Sign-up, verification, login, logout and password reset, end to end
// through the API. Email goes to the test outbox, never to a real inbox.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api, pool, resetDatabase, createUser, sessionCookieFrom, lastEmailTo, testOutbox, count } from '../helpers.mjs';

const PASSWORD = 'correct-horse-battery';
// The bot check rejects forms submitted faster than a person could.
const humanTiming = () => ({ honeypot: '', formRenderedAt: Date.now() - 5000 });

async function register(email, password = PASSWORD) {
  return api().post('/auth/register').send({ email, password, ...humanTiming() });
}

async function login(email, password = PASSWORD) {
  return api().post('/auth/login').send({ email, password });
}

beforeEach(resetDatabase);
afterAll(() => pool.end());

describe('sign-up and email verification', () => {
  it('creates an unverified account, stores only a password hash and sends a verification link', async () => {
    const res = await register('newcomer@gmail.com');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: expect.stringMatching(/check your email/i) });
    const { rows } = await pool.query('SELECT email_verified, password_hash FROM users WHERE email = $1', ['newcomer@gmail.com']);
    expect(rows[0].email_verified).toBe(false);
    expect(rows[0].password_hash).not.toContain(PASSWORD);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/);

    const mail = lastEmailTo('newcomer@gmail.com');
    expect(mail.link).toMatch(/^http:\/\/localhost:5173\/verify-email\?token=[0-9a-f]{64}$/);
  });

  it('normalises the email address', async () => {
    expect((await register('  MixedCase@Gmail.com ')).status).toBe(201);
    expect(await count('SELECT COUNT(*) FROM users WHERE email = $1', ['mixedcase@gmail.com'])).toBe(1);
  });

  it('refuses a second account with the same email', async () => {
    await register('taken@gmail.com');
    const res = await register('TAKEN@gmail.com');
    expect(res.status).toBe(409);
    expect(await count('SELECT COUNT(*) FROM users')).toBe(1);
  });

  it.each([
    ['an unsupported email provider', 'someone@example.com', PASSWORD],
    ['a malformed email', 'not-an-email', PASSWORD],
    ['a 7-character password', 'short@gmail.com', 'seven77'],
    ['a 73-character password', 'long@gmail.com', 'x'.repeat(73)],
  ])('refuses %s with a 400', async (_label, email, password) => {
    const res = await register(email, password);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(await count('SELECT COUNT(*) FROM users')).toBe(0);
  });

  it('will not log in before the email is verified', async () => {
    await register('pending@gmail.com');
    const res = await login('pending@gmail.com');
    expect(res.status).toBe(403);
    expect(sessionCookieFrom(res)).toBeNull();
  });

  it('verifies with the emailed link, then allows login', async () => {
    await register('verifyme@gmail.com');
    const { token } = lastEmailTo('verifyme@gmail.com');

    expect((await api().post('/auth/verify-email').send({ token })).status).toBe(200);
    const res = await login('verifyme@gmail.com');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: { id: expect.any(Number), email: 'verifyme@gmail.com' } });
  });

  it('refuses a verification link used twice, made up or expired', async () => {
    await register('once@gmail.com');
    const { token } = lastEmailTo('once@gmail.com');
    await api().post('/auth/verify-email').send({ token });
    expect((await api().post('/auth/verify-email').send({ token })).status).toBe(400);
    expect((await api().post('/auth/verify-email').send({ token: 'f'.repeat(64) })).status).toBe(400);

    await register('expired@gmail.com');
    const expired = lastEmailTo('expired@gmail.com').token;
    await pool.query("UPDATE email_verification_tokens SET expires_at = NOW() - INTERVAL '1 minute'");
    expect((await api().post('/auth/verify-email').send({ token: expired })).status).toBe(400);
    expect((await login('expired@gmail.com')).status).toBe(403);
  });

  it('resending a verification link replaces the old one', async () => {
    await register('resend@gmail.com');
    const first = lastEmailTo('resend@gmail.com').token;
    const res = await api().post('/auth/resend-verification').send({ email: 'resend@gmail.com' });
    expect(res.status).toBe(200);
    const second = lastEmailTo('resend@gmail.com').token;

    expect(second).not.toBe(first);
    expect((await api().post('/auth/verify-email').send({ token: first })).status).toBe(400);
    expect((await api().post('/auth/verify-email').send({ token: second })).status).toBe(200);
  });

  it('gives the same answer to a resend request for an unknown address, and sends nothing', async () => {
    const res = await api().post('/auth/resend-verification').send({ email: 'nobody@gmail.com' });
    expect(res.status).toBe(200);
    expect(testOutbox).toHaveLength(0);
  });
});

describe('login', () => {
  it('sets an httpOnly session cookie, and the session works', async () => {
    const user = await createUser({ email: 'cookie@gmail.com' });
    const res = await login('cookie@gmail.com', user.password);

    const setCookie = [].concat(res.headers['set-cookie']).find((c) => c.startsWith('token='));
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(res.body).not.toHaveProperty('token');

    const me = await api(undefined, { cookie: sessionCookieFrom(res) }).get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('cookie@gmail.com');
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    await createUser({ email: 'real@gmail.com' });
    const wrongPassword = await login('real@gmail.com', 'not-the-password');
    const unknown = await login('ghost@gmail.com', 'not-the-password');

    expect(wrongPassword.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknown.body);
  });
});

describe('logout', () => {
  it('clears the cookie', async () => {
    const user = await createUser();
    const res = await api(undefined, { cookie: user.cookie }).post('/auth/logout');
    expect(res.status).toBe(200);
    expect([].concat(res.headers['set-cookie']).join(';')).toMatch(/token=;/);
  });

  it('a copy of the cookie taken before logout no longer works', async () => {
    const user = await createUser();
    const copied = user.cookie;
    expect((await api(undefined, { cookie: copied }).get('/accounts')).status).toBe(200);

    await api(undefined, { cookie: user.cookie }).post('/auth/logout');

    expect((await api(undefined, { cookie: copied }).get('/accounts')).status).toBe(401);
    expect((await api(undefined, { cookie: copied }).get('/auth/me')).status).toBe(401);
  });

  it('logging out on one device leaves another device signed in', async () => {
    const user = await createUser();
    const second = sessionCookieFrom(await login(user.email, user.password));

    await api(undefined, { cookie: user.cookie }).post('/auth/logout');

    expect((await api(undefined, { cookie: second }).get('/auth/me')).status).toBe(200);
  });
});

describe('password reset', () => {
  it('resets the password with the emailed link; the old password stops working', async () => {
    const user = await createUser({ email: 'forgetful@gmail.com' });
    expect((await api().post('/auth/forgot-password').send({ email: 'forgetful@gmail.com' })).status).toBe(200);
    const { token, link } = lastEmailTo('forgetful@gmail.com');
    expect(link).toMatch(/\/reset-password\?token=/);

    const res = await api().post('/auth/reset-password').send({ token, password: 'a-brand-new-password' });
    expect(res.status).toBe(200);
    expect((await login('forgetful@gmail.com', user.password)).status).toBe(401);
    expect((await login('forgetful@gmail.com', 'a-brand-new-password')).status).toBe(200);
  });

  it('a reset link works only once, and not after it expires', async () => {
    await createUser({ email: 'once-reset@gmail.com' });
    await api().post('/auth/forgot-password').send({ email: 'once-reset@gmail.com' });
    const { token } = lastEmailTo('once-reset@gmail.com');
    await api().post('/auth/reset-password').send({ token, password: 'first-new-password' });
    expect((await api().post('/auth/reset-password').send({ token, password: 'second-new-password' })).status).toBe(400);

    await api().post('/auth/forgot-password').send({ email: 'once-reset@gmail.com' });
    const later = lastEmailTo('once-reset@gmail.com').token;
    await pool.query("UPDATE password_reset_tokens SET expires_at = NOW() - INTERVAL '1 minute'");
    expect((await api().post('/auth/reset-password').send({ token: later, password: 'third-new-password' })).status).toBe(400);
    expect((await login('once-reset@gmail.com', 'first-new-password')).status).toBe(200);
  });

  it('signs out every existing session when the password is reset', async () => {
    const user = await createUser({ email: 'stolen@gmail.com' });
    await api().post('/auth/forgot-password').send({ email: 'stolen@gmail.com' });
    const { token } = lastEmailTo('stolen@gmail.com');
    await api().post('/auth/reset-password').send({ token, password: 'locked-out-the-thief' });

    expect((await api(undefined, { cookie: user.cookie }).get('/auth/me')).status).toBe(401);
  });

  it('answers the same for an unknown email and sends nothing', async () => {
    const known = await createUser({ email: 'known@gmail.com' });
    const a = await api().post('/auth/forgot-password').send({ email: known.email });
    testOutbox.length = 0;
    const b = await api().post('/auth/forgot-password').send({ email: 'unknown@gmail.com' });

    expect(a.status).toBe(200);
    expect(b.body).toEqual(a.body);
    expect(testOutbox).toHaveLength(0);
  });
});
