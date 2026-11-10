import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getAllowedOrigins } = require('../../src/config.js');
const { rejectCrossSiteWrites } = require('../../src/middleware/origin.js');

describe('ALLOWED_ORIGINS', () => {
  it('reads a comma-separated list, normalising and de-duplicating it', () => {
    expect(getAllowedOrigins({
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: ' https://onyx-vault-six.vercel.app/ , http://localhost:5173,https://onyx-vault-six.vercel.app ',
    })).toEqual(['https://onyx-vault-six.vercel.app', 'http://localhost:5173']);
  });

  it('ignores entries that are not URLs', () => {
    expect(getAllowedOrigins({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'not a url,https://ok.example' }))
      .toEqual(['https://ok.example']);
  });

  it('falls back to CLIENT_ORIGIN in production, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getAllowedOrigins({ NODE_ENV: 'production', CLIENT_ORIGIN: 'https://onyx-vault-six.vercel.app' }))
      .toEqual(['https://onyx-vault-six.vercel.app']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('refuses to start in production with neither set', () => {
    expect(() => getAllowedOrigins({ NODE_ENV: 'production' })).toThrow(/ALLOWED_ORIGINS/);
  });

  it('defaults to the local Vite servers in development', () => {
    expect(getAllowedOrigins({ NODE_ENV: 'development' })).toContain('http://localhost:5173');
  });
});

describe('cross-site write check', () => {
  const check = rejectCrossSiteWrites(['https://onyx-vault-six.vercel.app']);

  function run(method, headers) {
    const req = { method, get: (name) => headers[name] };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();
    check(req, res, next);
    return { allowed: next.mock.calls.length === 1, status: res.status.mock.calls[0]?.[0] };
  }

  it.each([
    ['GET from anywhere', 'GET', { Origin: 'https://evil.example' }, true],
    ['POST from our site', 'POST', { Origin: 'https://onyx-vault-six.vercel.app' }, true],
    ['POST with no browser headers (curl, server-to-server)', 'POST', {}, true],
    ['POST marked same-origin', 'POST', { 'Sec-Fetch-Site': 'same-origin' }, true],
    ['POST from another site', 'POST', { Origin: 'https://evil.example' }, false],
    ['DELETE from another site', 'DELETE', { Origin: 'https://evil.example' }, false],
    ['PUT with a "null" origin (sandboxed frame)', 'PUT', { Origin: 'null' }, false],
    ['POST marked cross-site with no Origin', 'POST', { 'Sec-Fetch-Site': 'cross-site' }, false],
    ['POST from a look-alike domain', 'POST', { Origin: 'https://onyx-vault-six.vercel.app.evil.example' }, false],
    ['POST from our domain over plain HTTP', 'POST', { Origin: 'http://onyx-vault-six.vercel.app' }, false],
  ])('%s', (_label, method, headers, allowed) => {
    const result = run(method, headers);
    expect(result.allowed).toBe(allowed);
    if (!allowed) expect(result.status).toBe(403);
  });
});
