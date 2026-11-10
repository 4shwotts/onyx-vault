import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildDemoData } = require('../../src/demo/seedData.js');
const { penceToDecimal } = require('../../src/utils/money.js');

const TODAY = '2026-11-10';
const data = buildDemoData(TODAY);
const months = (list) => [...new Set(list.map((t) => t.date.slice(0, 7)))];

// Real brands that must never appear in the demo data (a spot check; the
// names are all invented).
const REAL_BRANDS = [
  'tesco', 'sainsbury', 'asda', 'aldi', 'lidl', 'waitrose', 'morrisons', 'co-op', 'iceland', 'ocado', 'm&s', 'marks',
  'netflix', 'spotify', 'disney', 'amazon', 'prime', 'apple', 'google', 'youtube', 'now tv', 'sky',
  'costa', 'starbucks', 'pret', 'greggs', 'nando', 'mcdonald', 'kfc', 'deliveroo', 'just eat', 'uber',
  'tfl', 'trainline', 'shell', 'bp', 'esso', 'british gas', 'octopus', 'edf', 'eon', 'e.on', 'ovo',
  'bt', 'virgin', 'vodafone', 'o2', 'ee', 'three', 'giffgaff', 'puregym', 'the gym group', 'odeon', 'vue', 'cineworld',
  'ikea', 'argos', 'john lewis', 'barclays', 'hsbc', 'lloyds', 'natwest', 'santander', 'monzo', 'revolut', 'starling',
];

describe('demo seed data', () => {
  it('covers the current month and the three before it, never after today', () => {
    expect(months(data.transactions)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
    expect(data.transactions.every((t) => t.date <= TODAY && t.date >= '2026-08-01')).toBe(true);
  });

  it('is in date order', () => {
    const dates = data.transactions.map((t) => t.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('has a monthly salary and rent, and subscriptions, in every month that has reached that day', () => {
    const salaries = data.transactions.filter((t) => t.description.startsWith('Salary'));
    expect(salaries.map((t) => t.date)).toEqual(['2026-08-28', '2026-09-28', '2026-10-28']);
    expect(salaries.every((t) => t.pence === 245000 && t.category === 'Income')).toBe(true);
    const rent = data.transactions.filter((t) => t.description.startsWith('Rent'));
    expect(rent.map((t) => t.date)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01']);
    expect(data.transactions.filter((t) => t.category === 'Subscriptions').length).toBeGreaterThanOrEqual(10);
  });

  it('uses several categories, with day-to-day spending in each month', () => {
    expect(data.categories).toEqual(expect.arrayContaining(['Income', 'Bills', 'Groceries', 'Subscriptions', 'Transport', 'Eating Out']));
    for (const month of ['2026-08', '2026-09', '2026-10']) {
      const inMonth = data.transactions.filter((t) => t.date.startsWith(month));
      expect(new Set(inMonth.map((t) => t.category)).size).toBeGreaterThanOrEqual(6);
      expect(inMonth.filter((t) => t.category === 'Groceries').length).toBeGreaterThanOrEqual(4);
    }
  });

  it('has two monthly recurring rules that continue after today', () => {
    expect(data.rules.map((r) => [r.description, r.dayOfMonth, r.nextRunDate, r.startDate])).toEqual([
      ['Salary – Brambleworth Ltd', 28, '2026-11-28', '2026-08-28'],
      ['Velvetreel Streaming', 14, '2026-11-14', '2026-08-14'],
    ]);
  });

  it('flags exactly one clearly unusual purchase', () => {
    const unusual = data.transactions.filter((t) => t.isAnomaly);
    expect(unusual).toHaveLength(1);
    expect(unusual[0]).toMatchObject({ category: 'Shopping', pence: -24900 });
  });

  it('every amount is a valid whole number of pence within the API’s limits', () => {
    for (const t of [...data.transactions, ...data.rules]) {
      expect(Number.isSafeInteger(t.pence)).toBe(true);
      expect(t.pence).not.toBe(0);
      expect(Math.abs(t.pence)).toBeLessThanOrEqual(99_999_999);
      expect(penceToDecimal(t.pence)).toMatch(/^-?\d+\.\d{2}$/);
    }
  });

  it('leaves the current account in credit (salary covers the spending)', () => {
    const current = data.transactions.filter((t) => t.account === 'current').reduce((s, t) => s + t.pence, 0);
    expect(current).toBeGreaterThan(0);
  });

  it('uses only made-up names, never a real brand', () => {
    const names = [...new Set([...data.transactions, ...data.rules].map((t) => t.description.toLowerCase()))];
    for (const name of names) {
      for (const brand of REAL_BRANDS) {
        expect(name.split(/[^a-z&.]+/), `"${name}" contains the real brand "${brand}"`).not.toContain(brand);
        if (brand.includes(' ')) expect(name).not.toContain(brand);
      }
    }
  });

  it('is the same every time for the same day (no hidden randomness)', () => {
    expect(buildDemoData(TODAY)).toEqual(data);
  });

  it('works on the 1st of a month, in January, and on 29 February', () => {
    for (const today of ['2026-11-01', '2027-01-15', '2028-02-29']) {
      const d = buildDemoData(today);
      expect(d.transactions.every((t) => t.date <= today)).toBe(true);
      expect(d.rules.every((r) => r.nextRunDate > today)).toBe(true);
      expect(months(d.transactions)).toHaveLength(4);
    }
  });

  it('refuses something that is not a date', () => {
    expect(() => buildDemoData('10/11/2026')).toThrow(/Not a date/);
  });
});
