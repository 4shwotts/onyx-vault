import { describe, it, expect } from 'vitest';
import { validateTransactionForm, signedAmount } from './transactionForm';

const valid = { accountId: '1', amount: '12.50', date: '2026-11-10', description: '', isExpense: true };

describe('validateTransactionForm', () => {
  it('accepts valid values', () => {
    expect(validateTransactionForm(valid)).toEqual({});
  });

  it.each([
    ['accountId', ''],
    ['amount', ''],
    ['amount', '   '],
    ['amount', '1.234'],
    ['amount', '0'],
    ['amount', '1000000'],
    ['date', ''],
    ['date', '2026-02-30'],
    ['date', '30/10/2026'],
    ['description', 'x'.repeat(256)],
  ])('flags %s = %j', (field, value) => {
    expect(validateTransactionForm({ ...valid, [field]: value })).toHaveProperty(field);
  });
});

describe('signedAmount', () => {
  it.each([
    ['12.5', true, '-12.50'],
    ['12.5', false, '12.50'],
    ['7', true, '-7.00'],
    ['0.05', false, '0.05'],
    ['999999.99', true, '-999999.99'],
    ['  3.20 ', false, '3.20'],
  ])('%j (expense: %s) -> %s', (amount, isExpense, expected) => {
    expect(signedAmount(amount, isExpense)).toBe(expected);
  });
});
