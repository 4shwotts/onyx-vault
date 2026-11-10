import { monthRange, formatMonthYear, toDateKey, parseDateKey } from './dates';

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Builds one month's full metadata bundle from a year/month pair
// (month is 0-based, as elsewhere in the UI):
// - value: the "YYYY-MM" key used as the picker/filter identifier
// - label: the human-readable "August 2026" form shown in the UI
// - from/to: the month's first and last calendar dates as 'YYYY-MM-DD',
//   built from the numbers directly so the visitor's time zone can't
//   shift them (see utils/dates.js).
export function buildMonthEntry(year, month) {
  const { from, to } = monthRange(year, month + 1);
  return {
    year,
    month,
    value: `${year}-${String(month + 1).padStart(2, '0')}`,
    label: formatMonthYear(year, month + 1),
    from,
    to,
  };
}

// The unique set of year-month combos present in the given transactions,
// read from each date's own calendar day, sorted most recent first.
export function getAvailableMonths(transactions) {
  const seen = new Map();
  transactions.forEach((t) => {
    const { year, month } = parseDateKey(toDateKey(t.date));
    const key = `${year}-${month}`;
    if (!seen.has(key)) seen.set(key, buildMonthEntry(year, month - 1));
  });
  return Array.from(seen.values()).sort((a, b) => (b.year - a.year) || (b.month - a.month));
}
