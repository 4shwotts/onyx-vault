// Next-run-date calculation for recurring rules. The monthly cases follow
// the rule the README promises: a rule lands on the same day of the month
// it started on, moved back to the last day only when that month is too
// short — and returns to its own day afterwards.
import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { nextDate } = require('../../src/cron/processRecurring.js');

// Runs nextDate repeatedly, the way the cron job advances a rule month
// after month, and returns every date the rule would post on.
function schedule(start, frequency, count) {
  const dates = [start];
  while (dates.length < count) dates.push(nextDate(dates[dates.length - 1], frequency, Number(start.slice(8, 10))));
  return dates;
}

describe('weekly rules', () => {
  it.each([
    ['2026-11-09', '2026-11-16', 'mid-month'],
    ['2026-11-27', '2026-12-04', 'across a 30-day month end'],
    ['2026-12-29', '2027-01-05', 'across the year boundary'],
    ['2028-02-22', '2028-02-29', 'onto a leap day'],
    ['2028-02-26', '2028-03-04', 'across a leap-year February'],
    ['2027-02-26', '2027-03-05', 'across a non-leap February'],
    ['2026-03-26', '2026-04-02', 'across the clocks going forward (UK)'],
    ['2026-10-22', '2026-10-29', 'across the clocks going back (UK)'],
  ])('%s -> %s (%s)', (from, to) => {
    expect(nextDate(from, 'weekly')).toBe(to);
  });
});

describe('monthly rules: single step', () => {
  it.each([
    ['2026-01-15', '2026-02-15', 'an ordinary day'],
    ['2026-12-15', '2027-01-15', 'December to January'],
    ['2026-12-31', '2027-01-31', 'year boundary on the 31st'],
    ['2026-01-31', '2026-02-28', '31st into a non-leap February'],
    ['2028-01-31', '2028-02-29', '31st into a leap February'],
    ['2026-01-30', '2026-02-28', '30th into February'],
    ['2026-01-29', '2026-02-28', '29th into a non-leap February'],
    ['2028-01-29', '2028-02-29', '29th into a leap February'],
    ['2026-03-31', '2026-04-30', '31st into a 30-day month'],
    ['2026-08-31', '2026-09-30', 'August 31st into September'],
    ['2100-01-29', '2100-02-28', '2100 is not a leap year'],
    ['2000-01-29', '2000-02-29', '2000 is a leap year'],
  ])('%s -> %s (%s)', (from, to) => {
    expect(nextDate(from, 'monthly', Number(from.slice(8, 10)))).toBe(to);
  });
});

describe('monthly rules: returning to the start day after a short month', () => {
  it('a rule on the 31st returns to the 31st after February', () => {
    expect(schedule('2026-01-31', 'monthly', 6)).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30',
    ]);
  });

  it('a rule on the 30th returns to the 30th after February', () => {
    expect(schedule('2026-01-30', 'monthly', 3)).toEqual(['2026-01-30', '2026-02-28', '2026-03-30']);
  });

  it('a rule on the 29th returns to the 29th after a non-leap February', () => {
    expect(schedule('2026-01-29', 'monthly', 3)).toEqual(['2026-01-29', '2026-02-28', '2026-03-29']);
  });

  it('a leap-day rule continues on the 29th', () => {
    expect(schedule('2028-02-29', 'monthly', 3)).toEqual(['2028-02-29', '2028-03-29', '2028-04-29']);
  });

  it('a rule on the 31st crosses the year boundary correctly', () => {
    expect(schedule('2026-11-30', 'monthly', 4)).toEqual(['2026-11-30', '2026-12-30', '2027-01-30', '2027-02-28']);
  });
});

describe('time zones', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('accepts a Date at midnight on a server running on UTC', () => {
    // Pinned to UTC: a "UTC midnight" Date only names a calendar day
    // unambiguously when the process itself is on UTC.
    process.env.TZ = 'UTC';
    expect(nextDate(new Date(Date.UTC(2026, 5, 15)), 'monthly', 15)).toBe('2026-07-15');
  });

  it('refuses something that is not a calendar date', () => {
    expect(() => nextDate('15/06/2026', 'monthly')).toThrow(/Not a calendar date/);
  });

  // node-postgres turns a DATE column into a Date at *local* midnight. On a
  // server whose clock is not UTC — a developer machine in the UK during
  // British Summer Time, say — that is 23:00 UTC on the previous day.
  it.each([
    ['Europe/London', 'British Summer Time'],
    ['Australia/Sydney', 'a zone well ahead of UTC'],
    ['America/New_York', 'a zone behind UTC'],
  ])('gives the same answer for a DATE value parsed in %s (%s)', (tz) => {
    process.env.TZ = tz;
    const asPgReturnsIt = new Date(2026, 5, 15); // 2026-06-15 local midnight
    expect(nextDate(asPgReturnsIt, 'monthly', 15)).toBe('2026-07-15');
    expect(nextDate(asPgReturnsIt, 'weekly')).toBe('2026-06-22');
  });
});
