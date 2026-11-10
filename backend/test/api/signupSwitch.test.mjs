// PUBLIC_SIGNUP_ENABLED, tested both on and off.
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { api, pool, resetDatabase, createUser, lastEmailTo, count } from '../helpers.mjs';

const original = process.env.PUBLIC_SIGNUP_ENABLED;
const register = (email) => api().post('/auth/register').send({ email, password: 'long-enough-pass', honeypot: '', formRenderedAt: Date.now() - 5000 });

beforeEach(resetDatabase);
afterEach(() => {
  if (original === undefined) delete process.env.PUBLIC_SIGNUP_ENABLED;
  else process.env.PUBLIC_SIGNUP_ENABLED = original;
});
afterAll(() => pool.end());

describe('sign-up switched on (the default)', () => {
  it('reports it, and sign-up works', async () => {
    delete process.env.PUBLIC_SIGNUP_ENABLED;
    expect((await api().get('/config')).body).toEqual({ publicSignupEnabled: true });
    expect((await register('open@gmail.com')).status).toBe(201);
    expect(await count('SELECT COUNT(*) FROM users')).toBe(1);
  });
});

describe('sign-up switched off (the live site)', () => {
  beforeEach(() => {
    process.env.PUBLIC_SIGNUP_ENABLED = 'false';
  });

  it('reports it to the frontend', async () => {
    expect((await api().get('/config')).body).toEqual({ publicSignupEnabled: false });
  });

  it('refuses sign-up with a 403, creating nothing and sending nothing', async () => {
    const res = await register('closed@gmail.com');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Sign-up is closed on the live site. Try the demo instead.' });
    expect(await count('SELECT COUNT(*) FROM users')).toBe(0);
    expect(lastEmailTo('closed@gmail.com')).toBeNull();
  });

  it('refuses even a bot-looking sign-up with the 403 (no fake success)', async () => {
    const res = await api().post('/auth/register').send({ email: 'bot@gmail.com', password: 'long-enough-pass', honeypot: 'x' });
    expect(res.status).toBe(403);
  });

  it('existing accounts still log in', async () => {
    const user = await createUser();
    expect((await api().post('/auth/login').send({ email: user.email, password: user.password })).status).toBe(200);
  });

  it('existing accounts can still reset their password', async () => {
    const user = await createUser({ email: 'reset-closed@gmail.com' });
    expect((await api().post('/auth/forgot-password').send({ email: user.email })).status).toBe(200);
    const { token } = lastEmailTo(user.email);
    expect((await api().post('/auth/reset-password').send({ token, password: 'a-new-password' })).status).toBe(200);
    expect((await api().post('/auth/login').send({ email: user.email, password: 'a-new-password' })).status).toBe(200);
  });

  it('accounts that signed up earlier can still verify their email', async () => {
    delete process.env.PUBLIC_SIGNUP_ENABLED;
    await register('verify-later@gmail.com');
    process.env.PUBLIC_SIGNUP_ENABLED = 'false';
    const { token } = lastEmailTo('verify-later@gmail.com');
    expect((await api().post('/auth/verify-email').send({ token })).status).toBe(200);
    expect((await api().post('/auth/resend-verification').send({ email: 'verify-later@gmail.com' })).status).toBe(200);
  });

  it('the demo stays open', async () => {
    expect((await api().post('/auth/demo')).status).toBe(201);
  });
});
