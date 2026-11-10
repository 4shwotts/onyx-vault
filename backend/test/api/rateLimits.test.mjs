// Each limited endpoint answers 429 once a single address goes over its
// limit, while other addresses carry on unaffected.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api, pool, resetDatabase, createUser, uniqueIp } from '../helpers.mjs';

beforeEach(resetDatabase);
afterAll(() => pool.end());

async function hammer(makeRequest, times) {
  const statuses = [];
  let last;
  for (let i = 0; i < times; i += 1) {
    last = await makeRequest(i);
    statuses.push(last.status);
  }
  return { statuses, last };
}

function expect429(last) {
  expect(last.status).toBe(429);
  expect(last.body).toEqual({ error: expect.any(String) });
  expect(last.headers.ratelimit || last.headers['ratelimit-policy']).toBeTruthy();
}

describe('rate limits', () => {
  it('login: 10 attempts per 15 minutes per address', async () => {
    const ip = uniqueIp();
    const { statuses, last } = await hammer(() => api(undefined, { ip }).post('/auth/login').send({ email: 'x@gmail.com', password: 'wrong-password' }), 11);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect429(last);

    const other = await api().post('/auth/login').send({ email: 'x@gmail.com', password: 'wrong-password' });
    expect(other.status).toBe(401);
  });

  it('sign-up: 5 per hour per address', async () => {
    const ip = uniqueIp();
    const { statuses, last } = await hammer((i) => api(undefined, { ip }).post('/auth/register')
      .send({ email: `signup${i}@gmail.com`, password: 'long-enough-pass', honeypot: '', formRenderedAt: Date.now() - 5000 }), 6);
    expect(statuses.slice(0, 5).every((s) => s === 201)).toBe(true);
    expect429(last);
  });

  it.each(['/auth/forgot-password', '/auth/resend-verification'])('%s: 5 per 15 minutes per address', async (path) => {
    const ip = uniqueIp();
    const { statuses, last } = await hammer(() => api(undefined, { ip }).post(path).send({ email: 'someone@gmail.com' }), 6);
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect429(last);
  });

  it('recurring run-now: limited per address', async () => {
    const user = await createUser();
    const ip = uniqueIp();
    const { statuses, last } = await hammer(() => api(undefined, { cookie: user.cookie, ip }).post('/recurring/run-now'), 11);
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect429(last);
  });
});
