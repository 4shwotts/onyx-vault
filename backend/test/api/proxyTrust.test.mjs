// Guards the fix for the critical proxy-addr advisory (GHSA-jqcg-44mw-7w3h)
// and checks the behaviour that depends on it: the rate limiter must key on
// the address Render's proxy appends, not on anything a client can forge.
import { describe, it, expect, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import request from 'supertest';
import { pool, createApp } from '../helpers.mjs';

const require = createRequire(import.meta.url);

function versionAtLeast(actual, minimum) {
  const a = actual.split('.').map(Number);
  const m = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== m[i]) return a[i] > m[i];
  }
  return true;
}

afterAll(async () => {
  await pool.end();
});

describe('proxy trust', () => {
  it('uses a proxy-addr release with the IP-spoofing fix (>= 2.0.8)', () => {
    const expressDir = require.resolve('express');
    const proxyAddrPkg = require(require.resolve('proxy-addr/package.json', { paths: [expressDir] }));
    expect(versionAtLeast(proxyAddrPkg.version, '2.0.8')).toBe(true);
  });

  it('a forged left-most X-Forwarded-For entry cannot dodge the login rate limit', async () => {
    const app = createApp();
    const statuses = [];
    // authLimiter allows 10 attempts per 15 minutes per IP. Each request
    // claims a different client IP at the front of the header, but the
    // proxy-appended (right-most) address is always the same.
    for (let i = 0; i < 11; i += 1) {
      const res = await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', `198.51.100.${i + 1}, 203.0.113.9`)
        .send({ email: 'nobody@gmail.com', password: 'wrong-password' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
