export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Builds one month's full metadata bundle from a year/month pair:
// - value: the "YYYY-MM" key used as the <select>/filter identifier
// - label: the human-readable "August 2026" form shown in the UI
// - from/to: the month's first and last calendar dates (as
//   'YYYY-MM-DD' strings), used to filter transactions by date range
// Centralising this in one function keeps the value/label/range trio
// consistent everywhere a month needs to be represented, rather than
// each caller recomputing its own version of "last day of the month".
export function buildMonthEntry(year, month) {
  const from = new Date(year, month, 1).toISOString().slice(0, 10);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = new Date(year, month, lastDay).toISOString().slice(0, 10);
  const label = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return { year, month, value: `${year}-${String(month + 1).padStart(2, '0')}`, label, from, to };
}

// Derives the unique set of year-month combos actually present in the given
// transactions (based on their date field), sorted most recent first.
export function getAvailableMonths(transactions) {
  const seen = new Map();
  transactions.forEach((t) => {
    const d = new Date(t.date);
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = `${year}-${month}`;
    if (!seen.has(key)) seen.set(key, buildMonthEntry(year, month));
  });
  return Array.from(seen.values()).sort((a, b) => (b.year - a.year) || (b.month - a.month));
}