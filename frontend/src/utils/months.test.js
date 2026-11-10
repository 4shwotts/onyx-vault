import { describe, it, expect, afterEach } from 'vitest';
import { buildMonthEntry, getAvailableMonths } from './months';

const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

describe('buildMonthEntry', () => {
  it.each([
    [2026, 0, '2026-01', '2026-01-01', '2026-01-31', 'January 2026'],
    [2026, 1, '2026-02', '2026-02-01', '2026-02-28', 'February 2026'],
    [2028, 1, '2028-02', '2028-02-01', '2028-02-29', 'February 2028'],
    [2026, 3, '2026-04', '2026-04-01', '2026-04-30', 'April 2026'],
    [2026, 11, '2026-12', '2026-12-01', '2026-12-31', 'December 2026'],
  ])('%i month %i -> %s (%s to %s)', (year, month, value, from, to, label) => {
    process.env.TZ = 'UTC';
    expect(buildMonthEntry(year, month)).toEqual({ year, month, value, from, to, label });
  });

  // The visitor's own time zone must not shift a month's date range.
  it.each([
    ['Europe/London', 6, '2026-07-01', '2026-07-31', 'British Summer Time'],
    ['Europe/London', 11, '2026-12-01', '2026-12-31', 'GMT'],
    ['Australia/Sydney', 0, '2026-01-01', '2026-01-31', 'ahead of UTC'],
    ['America/New_York', 6, '2026-07-01', '2026-07-31', 'behind UTC'],
  ])('in %s, month %i runs from %s to %s (%s)', (tz, month, from, to) => {
    process.env.TZ = tz;
    const entry = buildMonthEntry(2026, month);
    expect(entry.from).toBe(from);
    expect(entry.to).toBe(to);
  });
});

describe('getAvailableMonths', () => {
  it('returns each month that has transactions once, newest first', () => {
    process.env.TZ = 'UTC';
    const months = getAvailableMonths([
      { date: '2026-09-03' },
      { date: '2026-11-01' },
      { date: '2026-09-28' },
      { date: '2025-12-31' },
    ]);
    expect(months.map((m) => m.value)).toEqual(['2026-11', '2026-09', '2025-12']);
  });

  it('is empty when there are no transactions', () => {
    expect(getAvailableMonths([])).toEqual([]);
  });

  // The API currently sends DATE columns as UTC-midnight timestamps.
  it.each(['America/New_York', 'Europe/London'])('puts a transaction on the 1st into its own month in %s', (tz) => {
    process.env.TZ = tz;
    const months = getAvailableMonths([{ date: '2026-11-01T00:00:00.000Z' }]);
    expect(months.map((m) => m.value)).toEqual(['2026-11']);
  });
});
