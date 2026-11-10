import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { schemas, validate } = require('../../src/validation/schemas.js');

const TOKEN = 'a'.repeat(64);

function ok(schema, input) {
  const result = validate(schemas[schema], input);
  expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
  return result.data;
}

function fails(schema, input, message) {
  const result = validate(schemas[schema], input);
  expect(result.ok).toBe(false);
  if (message) expect(result.error).toMatch(message);
  expect(result.error).not.toMatch(/\n|at .*\.js|ZodError/);
  return result.error;
}

describe('createTransaction', () => {
  const valid = { account_id: 3, category_id: 7, amount: -12.5, description: 'Corner shop', date: '2026-10-31' };

  it('accepts a valid body and normalises it', () => {
    expect(ok('createTransaction', valid)).toEqual({ ...valid, amount: -1250 });
  });

  it('accepts ids and amounts sent as strings, and no category or description', () => {
    expect(ok('createTransaction', { account_id: '3', amount: '2100.00', date: '2026-10-28' }))
      .toEqual({ account_id: 3, amount: 210000, date: '2026-10-28' });
  });

  it.each([[null], ['']])('treats category_id %j as no category', (cat) => {
    expect(ok('createTransaction', { ...valid, category_id: cat }).category_id).toBeNull();
  });

  it('trims the description and stores an empty one as null', () => {
    expect(ok('createTransaction', { ...valid, description: '  Corner shop  ' }).description).toBe('Corner shop');
    expect(ok('createTransaction', { ...valid, description: '   ' }).description).toBeNull();
  });

  it.each(['account_id', 'amount', 'date'])('reports a missing %s', (field) => {
    const body = { ...valid };
    delete body[field];
    fails('createTransaction', body, new RegExp(`^${field} is required`));
  });

  it.each([
    ['account_id', 'abc', /account_id must be a positive whole number/],
    ['account_id', -1, /account_id/],
    ['category_id', 1.5, /category_id/],
    ['amount', 0, /amount must not be zero/],
    ['amount', '12.345', /amount must be a number with at most 2 decimal places/],
    ['amount', 'Infinity', /amount/],
    ['amount', 1000000, /£999,999.99/],
    ['date', '31/10/2026', /date must be a date in YYYY-MM-DD format/],
    ['date', '2026-02-30', /date/],
    ['date', '1899-01-01', /between 1970 and 2100/],
    ['description', 'x'.repeat(256), /255 characters/],
    ['description', 42, /description/],
  ])('rejects a bad %s (%j)', (field, value, message) => {
    fails('createTransaction', { ...valid, [field]: value }, message);
  });

  it.each([
    ['user_id', 2],
    ['balance', 1000000],
    ['is_anomaly', false],
    ['is_recurring', true],
    ['id', 99],
  ])('rejects the server-owned field %s', (field, value) => {
    fails('createTransaction', { ...valid, [field]: value }, new RegExp(`Unexpected field: ${field}`));
  });

  it('lists every unexpected field', () => {
    fails('createTransaction', { ...valid, user_id: 2, balance: 5 }, /Unexpected fields: user_id, balance/);
  });

  it('treats a missing body as missing fields, not a crash', () => {
    fails('createTransaction', undefined, /is required/);
  });
});

describe('updateTransaction', () => {
  it('accepts a partial update', () => {
    expect(ok('updateTransaction', { amount: '-3.20' })).toEqual({ amount: -320 });
  });

  it('refuses an empty update', () => {
    fails('updateTransaction', {}, /Nothing to update/);
  });

  it('refuses server-owned fields', () => {
    fails('updateTransaction', { amount: 1, account_balance: 5 }, /Unexpected field/);
  });
});

describe('createRecurring', () => {
  const valid = { account_id: 1, amount: -9.99, frequency: 'monthly', start_date: '2026-11-30' };

  it('accepts a valid rule', () => {
    expect(ok('createRecurring', valid)).toEqual({ ...valid, amount: -999 });
  });

  it.each([['daily'], ['Monthly'], [''], [null]])('rejects frequency %j', (frequency) => {
    fails('createRecurring', { ...valid, frequency }, /frequency/);
  });

  it('reports a missing start_date', () => {
    const { start_date: _omit, ...body } = valid;
    fails('createRecurring', body, /start_date is required/);
  });

  it.each([['next_run_date'], ['user_id']])('rejects the server-owned field %s', (field) => {
    fails('createRecurring', { ...valid, [field]: '2026-12-01' }, /Unexpected field/);
  });
});

describe('auth bodies', () => {
  it('normalises the email on register', () => {
    expect(ok('register', { email: '  Someone@Gmail.COM ', password: 'longenough', honeypot: '', formRenderedAt: 1 }))
      .toMatchObject({ email: 'someone@gmail.com' });
  });

  it.each([
    ['a short password', { email: 'a@gmail.com', password: 'short' }, /password must be between 8 and 72/],
    ['a 73-character password', { email: 'a@gmail.com', password: 'x'.repeat(73) }, /password/],
    ['a malformed email', { email: 'not-an-email', password: 'longenough' }, /email/],
    ['a missing email', { password: 'longenough' }, /email is required/],
    ['an extra field', { email: 'a@gmail.com', password: 'longenough', email_verified: true }, /Unexpected field: email_verified/],
    ['a non-string password', { email: 'a@gmail.com', password: 12345678 }, /password/],
  ])('rejects %s', (_label, body, message) => {
    fails('register', body, message);
  });

  it('accepts a valid verification token and rejects malformed ones', () => {
    ok('verifyEmail', { token: TOKEN });
    fails('verifyEmail', { token: 'abc' }, /token is invalid/);
    fails('verifyEmail', { token: TOKEN.toUpperCase() }, /token is invalid/);
    fails('verifyEmail', {}, /token is required/);
    fails('verifyEmail', { token: TOKEN, userId: 1 }, /Unexpected field/);
  });

  it('requires both token and new password for a reset', () => {
    ok('resetPassword', { token: TOKEN, password: 'brand-new-pass' });
    fails('resetPassword', { token: TOKEN }, /password is required/);
    fails('resetPassword', { password: 'brand-new-pass' }, /token is required/);
  });

  it('requires a password to delete an account', () => {
    fails('deleteAccount', {}, /password is required/);
    fails('deleteAccount', { password: '' }, /password is required/);
  });
});

describe('accounts and categories', () => {
  it('accepts a valid account and rejects unknown types or a client-set balance', () => {
    ok('createAccount', { name: 'Current', type: 'current' });
    fails('createAccount', { name: 'Current', type: 'isa' }, /type must be current, savings or credit/);
    fails('createAccount', { name: 'Current', type: 'current', balance: 1000000 }, /Unexpected field: balance/);
    fails('createAccount', { name: '   ', type: 'current' }, /name is required/);
  });

  it('caps category names at 40 characters', () => {
    ok('createCategory', { name: 'x'.repeat(40) });
    fails('createCategory', { name: 'x'.repeat(41) }, /40 characters/);
  });
});

describe('listTransactionsQuery', () => {
  it('applies defaults', () => {
    expect(ok('listTransactionsQuery', {})).toEqual({ page: 1, limit: 25 });
  });

  it('coerces query-string numbers', () => {
    expect(ok('listTransactionsQuery', { page: '3', limit: '50', account_id: '2' }))
      .toEqual({ page: 3, limit: 50, account_id: 2 });
  });

  it.each([
    [{ page: '0' }, /page must be 1 or more/],
    [{ page: '-1' }, /page/],
    [{ page: 'two' }, /page/],
    [{ limit: '101' }, /limit must be between 1 and 100/],
    [{ limit: '1.5' }, /limit/],
    [{ from: '2026-11-01', to: '2026-10-01' }, /from must be on or before to/],
    [{ sort: 'amount' }, /Unexpected field: sort/],
  ])('rejects %j', (query, message) => {
    fails('listTransactionsQuery', query, message);
  });
});
