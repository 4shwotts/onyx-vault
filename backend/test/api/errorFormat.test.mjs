// Every error, whatever produced it, has the same JSON shape:
// { "error": "<short message>" }.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { api, pool, createApp, resetDatabase, createUser, uniqueIp } from '../helpers.mjs';

let user;
beforeEach(async () => {
  await resetDatabase();
  user = await createUser();
});
afterAll(() => pool.end());

function expectStandardError(res, status) {
  expect(res.status).toBe(status);
  expect(res.headers['content-type']).toMatch(/^application\/json/);
  expect(res.body).toEqual({ error: expect.any(String) });
  expect(res.body.error.length).toBeGreaterThan(0);
}

describe('one error format', () => {
  it('400 from validation', async () => {
    expectStandardError(await api(undefined, { cookie: user.cookie }).post('/accounts').send({}), 400);
  });

  it('400 from malformed JSON', async () => {
    const res = await request(createApp()).post('/auth/login').set('Content-Type', 'application/json').send('{oops');
    expectStandardError(res, 400);
  });

  it('401 without a session', async () => {
    expectStandardError(await api().get('/accounts'), 401);
  });

  it('403 from a cross-site write', async () => {
    expectStandardError(await api(undefined, { cookie: user.cookie, origin: 'https://evil.example' }).post('/auth/logout'), 403);
  });

  it('403 from a cap', async () => {
    await pool.query("INSERT INTO accounts (user_id, name, type) SELECT $1, 'Current', 'current' FROM generate_series(1, 10)", [user.id]);
    expectStandardError(await api(undefined, { cookie: user.cookie }).post('/accounts').send({ name: 'Current', type: 'current' }), 403);
  });

  it('404 from an unknown route and from a missing record', async () => {
    expectStandardError(await api().get('/no/such/route'), 404);
    expectStandardError(await api(undefined, { cookie: user.cookie }).get('/accounts/999999'), 404);
  });

  it('409 from a duplicate sign-up', async () => {
    const body = { email: user.email, password: 'long-enough-pass', honeypot: '', formRenderedAt: Date.now() - 5000 };
    expectStandardError(await api().post('/auth/register').send(body), 409);
  });

  it('413 from an oversized body', async () => {
    expectStandardError(await api().post('/auth/login').send({ email: 'a@gmail.com', password: 'x'.repeat(200_000) }), 413);
  });

  it('429 from a rate limit', async () => {
    const ip = uniqueIp();
    let res;
    for (let i = 0; i < 11; i += 1) {
      res = await api(undefined, { ip }).post('/auth/login').send({ email: 'a@gmail.com', password: 'wrong-password' });
    }
    expectStandardError(res, 429);
  });
});
