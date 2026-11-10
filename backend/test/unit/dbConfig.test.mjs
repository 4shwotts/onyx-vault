import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildPoolConfig } = require('../../src/dbConfig.js');
const ConnectionParameters = require('pg/lib/connection-parameters');

const NEON = 'postgresql://app:secret@ep-quiet-sky-123456.eu-west-2.aws.neon.tech/neondb';

// What node-postgres will actually use once it has merged the URL's own
// parameters over the config object — the thing that matters in production.
function effectiveSsl(config) {
  return { connectionParams: new ConnectionParameters(config).ssl };
}

describe('production database config', () => {
  it.each([
    ['sslmode=require', `${NEON}?sslmode=require&channel_binding=require`],
    ['sslmode=no-verify', `${NEON}?sslmode=no-verify`],
    ['no sslmode', NEON],
  ])('verifies Neon certificates with %s in the URL', (_label, url) => {
    const config = buildPoolConfig({ NODE_ENV: 'production', DATABASE_URL: url });

    expect(config.ssl).toEqual({ rejectUnauthorized: true });
    expect(config.connectionString).not.toMatch(/sslmode/);
    expect(effectiveSsl(config).connectionParams).toEqual({ rejectUnauthorized: true });
  });

  it('keeps other URL parameters such as channel_binding', () => {
    const config = buildPoolConfig({ NODE_ENV: 'production', DATABASE_URL: `${NEON}?sslmode=require&channel_binding=require` });
    expect(config.connectionString).toMatch(/channel_binding=require/);
  });

  it.each([
    ['localhost', 'postgres://postgres:pw@localhost:5432/onyx_vault'],
    ['127.0.0.1', 'postgres://postgres:pw@127.0.0.1:5432/onyx_vault'],
  ])('connects to a local Postgres on %s without SSL', (_label, url) => {
    const config = buildPoolConfig({ NODE_ENV: 'development', DATABASE_URL: url });
    expect(config.ssl).toBe(false);
    expect(effectiveSsl(config).connectionParams).toBe(false);
  });

  it('refuses to start without DATABASE_URL', () => {
    expect(() => buildPoolConfig({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL is not set/);
  });
});

describe('test database config', () => {
  it('ignores DATABASE_URL entirely and uses the guarded TEST_DATABASE_URL', () => {
    const config = buildPoolConfig({
      NODE_ENV: 'test',
      DATABASE_URL: `${NEON}?sslmode=require`,
      TEST_DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5433/onyx_vault_test',
    });
    expect(config.connectionString).toBe('postgres://postgres:postgres@127.0.0.1:5433/onyx_vault_test');
    expect(config.ssl).toBe(false);
  });

  it('refuses a hosted TEST_DATABASE_URL', () => {
    expect(() => buildPoolConfig({ NODE_ENV: 'test', TEST_DATABASE_URL: `${NEON.replace('neondb', 'x_test')}` }))
      .toThrow(/hosted database/);
  });
});
