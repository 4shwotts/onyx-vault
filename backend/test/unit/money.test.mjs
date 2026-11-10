import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { MAX_AMOUNT_PENCE, parseAmountToPence, numericToPence, penceToDecimal, formatGBP } = require('../../src/utils/money.js');

describe('parseAmountToPence', () => {
  it.each([
    [12.5, 1250],
    ['12.5', 1250],
    ['12.50', 1250],
    [-42.1, -4210],
    ['-42.10', -4210],
    [0.01, 1],
    [-0.01, -1],
    [1, 100],
    ['  7.99  ', 799],
    [999999.99, MAX_AMOUNT_PENCE],
    [-999999.99, -MAX_AMOUNT_PENCE],
  ])('parses %j as %i pence', (input, pence) => {
    expect(parseAmountToPence(input)).toEqual({ ok: true, pence });
  });

  it('does not inherit floating-point error: 0.1 + 0.2 is refused, not stored as 0.30', () => {
    const result = parseAmountToPence(0.1 + 0.2);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/2 decimal places/);
  });

  it('parses values that are not exact in binary without drift', () => {
    // 1.15 * 100 === 114.99999999999999 in floating point.
    expect(parseAmountToPence(1.15)).toEqual({ ok: true, pence: 115 });
    expect(parseAmountToPence('1234567.89').ok).toBe(false); // over the cap
    expect(parseAmountToPence('123456.78')).toEqual({ ok: true, pence: 12345678 });
  });

  it.each([
    ['zero', 0],
    ['zero string', '0.00'],
    ['negative zero', -0],
  ])('rejects %s by default', (_label, input) => {
    expect(parseAmountToPence(input)).toEqual({ ok: false, error: 'amount must not be zero' });
  });

  it('allows zero when asked (e.g. an opening balance)', () => {
    expect(parseAmountToPence('0', { allowZero: true })).toEqual({ ok: true, pence: 0 });
    expect(parseAmountToPence(-0, { allowZero: true })).toEqual({ ok: true, pence: 0 });
  });

  it.each([
    ['three decimal places', '1.234'],
    ['a fraction of a penny', 0.001],
    ['an empty string', ''],
    ['whitespace', '   '],
    ['a word', 'twelve'],
    ['a currency symbol', '£12'],
    ['a thousands separator', '1,000'],
    ['an exponent', '1e3'],
    ['a huge number in exponent form', 1e21],
    ['Infinity', Infinity],
    ['the string Infinity', 'Infinity'],
    ['NaN', NaN],
    ['a leading plus', '+5'],
    ['a trailing dot', '5.'],
    ['a leading dot', '.5'],
    ['a boolean', true],
    ['null', null],
    ['undefined', undefined],
    ['an object', { value: 5 }],
    ['an array', [5]],
    ['one penny over the cap', '1000000.00'],
    ['one penny under the negative cap', -1000000],
  ])('rejects %s', (_label, input) => {
    const result = parseAmountToPence(input);
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});

describe('numericToPence (values from Postgres)', () => {
  it.each([
    ['0.00', 0],
    ['-0.00', 0],
    ['12.50', 1250],
    ['-4210.07', -421007],
    ['9999999999.99', 999999999999],
    ['5', 500],
    ['5.5', 550],
  ])('converts %s to %i pence', (input, pence) => {
    expect(numericToPence(input)).toBe(pence);
  });

  it('throws on something that is not a money value', () => {
    expect(() => numericToPence('abc')).toThrow(/Not a money value/);
  });
});

describe('penceToDecimal (values sent to Postgres)', () => {
  it.each([
    [0, '0.00'],
    [1, '0.01'],
    [-1, '-0.01'],
    [1250, '12.50'],
    [-421007, '-4210.07'],
    [MAX_AMOUNT_PENCE, '999999.99'],
    [999999999999, '9999999999.99'],
  ])('converts %i pence to %s', (pence, text) => {
    expect(penceToDecimal(pence)).toBe(text);
  });

  it('round-trips with numericToPence', () => {
    for (const pence of [0, 1, 99, 100, 101, -1, -99, -100, 123456789, -987654321]) {
      expect(numericToPence(penceToDecimal(pence))).toBe(pence);
    }
  });

  it('refuses fractional pence', () => {
    expect(() => penceToDecimal(1.5)).toThrow(/whole number/);
  });
});

describe('totals in pence', () => {
  it('adds amounts exactly where floating point would not', () => {
    const amounts = ['0.10', '0.20', '0.30'];
    const floatTotal = amounts.reduce((sum, a) => sum + Number(a), 0);
    const penceTotal = amounts.reduce((sum, a) => sum + numericToPence(a), 0);

    expect(floatTotal).not.toBe(0.6); // float noise: 0.6000000000000001
    expect(penceTotal).toBe(60);
    expect(penceToDecimal(penceTotal)).toBe('0.60');
  });

  it('nets income against spending, including totals that cancel to zero', () => {
    const toTotal = (list) => list.reduce((sum, a) => sum + numericToPence(a), 0);
    expect(penceToDecimal(toTotal(['2100.00', '-950.00', '-42.17', '-7.83']))).toBe('1100.00');
    expect(toTotal(['12.34', '-12.34'])).toBe(0);
    expect(penceToDecimal(toTotal(['-0.01', '-0.01', '-0.01']))).toBe('-0.03');
    expect(toTotal([])).toBe(0);
  });

  it('sums ten thousand maximal transactions exactly and within NUMERIC(12,2)', () => {
    const total = Array.from({ length: 10000 }, () => MAX_AMOUNT_PENCE).reduce((a, b) => a + b, 0);
    expect(Number.isSafeInteger(total)).toBe(true);
    expect(penceToDecimal(total)).toBe('9999999900.00');
    expect(total).toBeLessThanOrEqual(999999999999);
  });
});

describe('formatGBP', () => {
  it.each([
    [0, '£0.00'],
    [1, '£0.01'],
    [1250, '£12.50'],
    [123456, '£1,234.56'],
    [-1250, '-£12.50'],
    [MAX_AMOUNT_PENCE, '£999,999.99'],
    [999999999999, '£9,999,999,999.99'],
  ])('formats %i pence as %s', (pence, text) => {
    expect(formatGBP(pence)).toBe(text);
  });
});
