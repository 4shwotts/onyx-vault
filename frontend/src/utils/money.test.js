import { describe, it, expect } from 'vitest';
import { toPence, sumPence, percentChange, formatGBP, formatSignedGBP } from './money';

describe('toPence', () => {
  it.each([
    ['-12.50', -1250],
    ['12.5', 1250],
    ['0.00', 0],
    ['-0.00', 0],
    ['9999999999.99', 999999999999],
    [12.5, 1250],
    [-0.01, -1],
    [1.15, 115],
    ['  4.20 ', 420],
  ])('%j -> %i', (input, pence) => {
    expect(toPence(input)).toBe(pence);
  });

  it.each([['abc'], [''], [null], [undefined], ['1.234'], ['1e3'], [NaN], [Infinity]])('refuses %j', (input) => {
    expect(() => toPence(input)).toThrow(/Not a money value/);
  });
});

describe('totals', () => {
  it('adds exactly where floating point does not', () => {
    const values = ['0.10', '0.20', '0.30'];
    expect(values.reduce((s, v) => s + Number(v), 0)).not.toBe(0.6);
    expect(sumPence(values.map(toPence))).toBe(60);
  });

  it('handles an empty list, negatives and zero', () => {
    expect(sumPence([])).toBe(0);
    expect(sumPence([toPence('12.34'), toPence('-12.34')])).toBe(0);
    expect(sumPence([toPence('-0.01'), toPence('0'), toPence('-0.02')])).toBe(-3);
  });
});

describe('percentChange', () => {
  it.each([
    [150, 100, 50],
    [50, 100, -50],
    [100, 100, 0],
    [0, 100, -100],
  ])('%i vs %i is %i%%', (current, previous, pct) => {
    expect(percentChange(current, previous)).toBe(pct);
  });

  it('returns null when there was nothing last time', () => {
    expect(percentChange(500, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
});

describe('formatGBP', () => {
  it.each([
    [0, '£0.00'],
    [1, '£0.01'],
    [123456, '£1,234.56'],
    [-1250, '−£12.50'],
    [999999999999, '£9,999,999,999.99'],
  ])('%i pence -> %s', (pence, text) => {
    expect(formatGBP(pence)).toBe(text);
  });

  it.each([
    [63349, '£633'],
    [250, '£3'],
    [249, '£2'],
    [-250, '−£3'],
    [49, '£0'],
    [-49, '£0'],
    [123456789, '£1,234,568'],
  ])('%i pence to the nearest pound -> %s', (pence, text) => {
    expect(formatGBP(pence, { decimals: 0 })).toBe(text);
  });

  it('never shows floating-point noise', () => {
    const total = sumPence(['0.10', '0.20'].map(toPence));
    expect(formatGBP(total)).toBe('£0.30');
  });
});

describe('formatSignedGBP', () => {
  it.each([
    [210000, '+£2,100.00'],
    [-4210, '−£42.10'],
    [0, '£0.00'],
  ])('%i -> %s', (pence, text) => {
    expect(formatSignedGBP(pence)).toBe(text);
  });
});
