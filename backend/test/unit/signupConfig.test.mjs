import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isPublicSignupEnabled, maxLiveDemos, DEFAULT_MAX_LIVE_DEMOS } = require('../../src/config.js');

describe('PUBLIC_SIGNUP_ENABLED', () => {
  it.each([[undefined], [''], ['true'], ['TRUE'], ['1'], ['yes'], ['on']])('%j leaves sign-up open (the default)', (value) => {
    expect(isPublicSignupEnabled({ PUBLIC_SIGNUP_ENABLED: value })).toBe(true);
  });

  it.each([['false'], ['FALSE'], [' false '], ['0'], ['no'], ['off']])('%j closes sign-up', (value) => {
    expect(isPublicSignupEnabled({ PUBLIC_SIGNUP_ENABLED: value })).toBe(false);
  });
});

describe('MAX_LIVE_DEMOS', () => {
  it('defaults to 50', () => {
    expect(DEFAULT_MAX_LIVE_DEMOS).toBe(50);
    expect(maxLiveDemos({})).toBe(50);
  });

  it.each([['10', 10], ['0', 0]])('reads %j as %i', (value, expected) => {
    expect(maxLiveDemos({ MAX_LIVE_DEMOS: value })).toBe(expected);
  });

  it.each([['-1'], ['ten'], ['2.5']])('ignores %j and uses the default', (value) => {
    expect(maxLiveDemos({ MAX_LIVE_DEMOS: value })).toBe(50);
  });
});
