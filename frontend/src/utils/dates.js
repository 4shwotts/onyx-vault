// Calendar dates are handled as 'YYYY-MM-DD' strings ("date keys") from
// the API to the screen. A transaction date is a day, not a moment, so it
// must never pass through a time-zone conversion: `new Date('2026-11-01')`
// is midnight UTC, which is still 31 October in New York, and
// `toISOString()` on a local midnight is the day before anywhere east of UTC
// (including the UK in summer).

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})/;

export const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_NAMES_SHORT = MONTH_NAMES_LONG.map((m) => m.slice(0, 3));

function pad(n, width = 2) {
  return String(n).padStart(width, '0');
}

export function makeDateKey(year, month, day) {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

// Accepts what the API sends — 'YYYY-MM-DD', or (older API) a UTC-midnight
// timestamp '2026-11-01T00:00:00.000Z' — and returns 'YYYY-MM-DD'. A Date
// object is read in local time, i.e. the day the user sees on their clock.
export function toDateKey(value) {
  if (value instanceof Date) {
    return makeDateKey(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  const match = DATE_KEY.exec(String(value ?? ''));
  if (!match) throw new Error(`Not a calendar date: ${JSON.stringify(value)}`);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function parseDateKey(key) {
  const [year, month, day] = toDateKey(key).split('-').map(Number);
  return { year, month, day };
}

// Today's date on the user's own clock.
export function todayKey(now = new Date()) {
  return toDateKey(now);
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// First and last day of a month (month is 1–12) as date keys.
export function monthRange(year, month) {
  return { from: makeDateKey(year, month, 1), to: makeDateKey(year, month, daysInMonth(year, month)) };
}

// '2026-11-15' -> '15 Nov'
export function formatShortDate(value) {
  const { month, day } = parseDateKey(value);
  return `${day} ${MONTH_NAMES_SHORT[month - 1]}`;
}

// 2026, 11 -> 'November 2026'
export function formatMonthYear(year, month) {
  return `${MONTH_NAMES_LONG[month - 1]} ${year}`;
}
