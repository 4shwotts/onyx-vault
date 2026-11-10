// The honeypot and the minimum-time check. A rejected sign-up gets the
// same 201 as a real one on purpose (so a bot can't learn to dodge the
// checks), but no account is created and no email is sent.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api, pool, resetDatabase, testOutbox, count } from '../helpers.mjs';

const base = { email: 'maybe-a-bot@gmail.com', password: 'long-enough-pass' };

beforeEach(resetDatabase);
afterAll(() => pool.end());

// body is a function so timestamps are taken at the moment of sending,
// not before the earlier (slow, bcrypt-hashing) human sign-up.
async function expectSilentlyRejected(makeBody) {
  const real = await api().post('/auth/register').send({ ...base, email: 'human@gmail.com', honeypot: '', formRenderedAt: Date.now() - 5000 });
  testOutbox.length = 0;

  const res = await api().post('/auth/register').send({ ...base, ...makeBody() });
  expect(res.status).toBe(201);
  expect(res.body).toEqual(real.body);
  expect(await count('SELECT COUNT(*) FROM users WHERE email = $1', [base.email])).toBe(0);
  expect(testOutbox).toHaveLength(0);
}

describe('bot protection on sign-up', () => {
  it('a filled-in honeypot', () => expectSilentlyRejected(() => ({ honeypot: 'https://spam.example', formRenderedAt: Date.now() - 5000 })));
  it('a form submitted 200ms after it appeared', () => expectSilentlyRejected(() => ({ honeypot: '', formRenderedAt: Date.now() - 200 })));
  it('a form submitted just under the 1.5s minimum', () => expectSilentlyRejected(() => ({ honeypot: '', formRenderedAt: Date.now() - 1400 })));
  it('a missing timestamp', () => expectSilentlyRejected(() => ({ honeypot: '' })));
  it('a timestamp from the future', () => expectSilentlyRejected(() => ({ honeypot: '', formRenderedAt: Date.now() + 60_000 })));
  it('a timestamp sent as text', () => expectSilentlyRejected(() => ({ honeypot: '', formRenderedAt: String(Date.now() - 5000) })));

  it('a person who took a few seconds gets a real account and an email', async () => {
    const res = await api().post('/auth/register').send({ ...base, honeypot: '', formRenderedAt: Date.now() - 3000 });
    expect(res.status).toBe(201);
    expect(await count('SELECT COUNT(*) FROM users WHERE email = $1', [base.email])).toBe(1);
    expect(testOutbox).toHaveLength(1);
  });
});
