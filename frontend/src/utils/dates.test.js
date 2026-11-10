import { describe, it, expect, afterEach } from 'vitest';
import { toDateKey, todayKey, monthRange, formatShortDate, formatMonthYear, daysInMonth } from './dates';

const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

const ZONES = ['UTC', 'Europe/London', 'America/New_York', 'Australia/Sydney', 'Pacific/Kiritimati'];

describe('toDateKey', () => {
  it.each(ZONES)('reads both API date formats as the same day in %s', (tz) => {
    process.env.TZ = tz;
    expect(toDateKey('2026-11-01')).toBe('2026-11-01');
    expect(toDateKey('2026-11-01T00:00:00.000Z')).toBe('2026-11-01');
    expect(toDateKey('2026-07-31T00:00:00.000Z')).toBe('2026-07-31');
  });

  it('reads a Date object as the day on the local clock', () => {
    process.env.TZ = 'Europe/London';
    expect(toDateKey(new Date(2026, 6, 1))).toBe('2026-07-01'); // local midnight in BST
  });

  it.each([[''], [null], [undefined], ['31/10/2026'], ['yesterday']])('refuses %j', (value) => {
    expect(() => toDateKey(value)).toThrow(/Not a calendar date/);
  });
});

describe('todayKey', () => {
  it('is the date on the user’s clock, not in UTC', () => {
    process.env.TZ = 'Europe/London';
    // 00:30 on 1 July in London is still 30 June in UTC.
    expect(todayKey(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07-01');
    process.env.TZ = 'America/New_York';
    expect(todayKey(new Date('2026-07-01T02:00:00Z'))).toBe('2026-06-30');
  });
});

describe('monthRange and daysInMonth', () => {
  it.each(ZONES)('is the same in every time zone (%s)', (tz) => {
    process.env.TZ = tz;
    expect(monthRange(2026, 7)).toEqual({ from: '2026-07-01', to: '2026-07-31' });
    expect(monthRange(2026, 2)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange(2028, 2)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthRange(2026, 12)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it.each([[2026, 4, 30], [2100, 2, 28], [2000, 2, 29]])('%i-%i has %i days', (y, m, days) => {
    expect(daysInMonth(y, m)).toBe(days);
  });
});

describe('formatting', () => {
  it.each(ZONES)('formats a date without shifting it in %s', (tz) => {
    process.env.TZ = tz;
    expect(formatShortDate('2026-11-01')).toBe('1 Nov');
    expect(formatShortDate('2026-11-01T00:00:00.000Z')).toBe('1 Nov');
    expect(formatShortDate('2026-12-31')).toBe('31 Dec');
  });

  it('names a month in UK English', () => {
    expect(formatMonthYear(2026, 8)).toBe('August 2026');
  });
});
