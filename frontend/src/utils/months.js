export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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