import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { assertSafeTestDatabaseUrl } = require('../../src/testing/dbGuard.js');

describe('test database guard', () => {
  it.each([
    ['postgres://postgres:postgres@127.0.0.1:5433/onyx_vault_test'],
    ['postgresql://postgres:postgres@localhost:5432/onyx_vault_test'],
    ['postgres://postgres:postgres@postgres:5432/onyx_vault_test'],
    ['postgres://postgres:postgres@[::1]:5432/onyx_vault_test?sslmode=disable'],
  ])('accepts a local throwaway database: %s', (url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).not.toThrow();
  });

  it.each([
    ['missing URL', undefined, /not set/],
    ['empty URL', '', /not set/],
    ['Neon host', 'postgres://u:p@ep-cool-name-123.eu-west-2.aws.neon.tech/onyx_vault_test', /hosted database/],
    ['Render host', 'postgres://u:p@dpg-abc.frankfurt-postgres.render.com/onyx_vault_test', /hosted database/],
    ['AWS host', 'postgres://u:p@db.abc.eu-west-2.rds.amazonaws.com/onyx_vault_test', /hosted database/],
    ['other remote host', 'postgres://u:p@db.example.com:5432/onyx_vault_test', /not a local test database/],
    ['SSL required', 'postgres://u:p@localhost:5432/onyx_vault_test?sslmode=require', /must not use SSL/],
    ['database not named *_test', 'postgres://u:p@localhost:5432/onyx_vault', /must end in "_test"/],
    ['wrong protocol', 'mysql://u:p@localhost:3306/onyx_vault_test', /postgres:\/\//],
    ['not a URL', 'definitely not a url', /not a valid URL/],
  ])('refuses %s', (_label, url, message) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow(message);
  });

  it('db.js refuses to build a pool for a hosted URL when NODE_ENV=test', () => {
    const original = process.env.TEST_DATABASE_URL;
    const dbPath = require.resolve('../../src/db.js');
    delete require.cache[dbPath];
    process.env.TEST_DATABASE_URL = 'postgres://u:p@ep-x.eu-west-2.aws.neon.tech/neondb?sslmode=require';
    try {
      expect(() => require(dbPath)).toThrow(/hosted database/);
    } finally {
      process.env.TEST_DATABASE_URL = original;
      delete require.cache[dbPath];
    }
  });

  it('the test environment never sees the real DATABASE_URL', () => {
    expect(process.env.DATABASE_URL).toBeUndefined();
    expect(process.env.NODE_ENV).toBe('test');
  });
});
