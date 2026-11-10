// Spending maths behind the dashboard: per-category totals for a month,
// the comparison with the month before, the projection for the current
// month, and the one-line spend insight. Pure functions with "today"
// passed in, so they can be tested with fake timers.
//
// Comparisons are like for like. While a month is still in progress, it
// is compared with the previous month *up to the same day*, not with the
// whole of the previous month — otherwise every month looks cheaper than
// the last until its final days.
import { toDateKey, todayKey, parseDateKey, makeDateKey, daysInMonth, monthRange, MONTH_NAMES_LONG } from '../utils/dates';
import { toPence, sumPence, percentChange, formatGBP } from '../utils/money';

// Changes smaller than this are treated as "about the same".
const NOTABLE_CHANGE_PCT = 5;

function splitMonthKey(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month };
}

function previousMonth({ year, month }) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function between(transactions, from, to) {
  return transactions.filter((t) => {
    const key = toDateKey(t.date);
    return key >= from && key <= to;
  });
}

export function transactionsInMonth(transactions, monthKey) {
  const { year, month } = splitMonthKey(monthKey);
  const { from, to } = monthRange(year, month);
  return between(transactions, from, to);
}

// Spending (money out) per category, in pence, as positive numbers.
// Income is ignored. Uncategorised spending is grouped as "Other".
export function spendByCategory(transactions) {
  const totals = {};
  for (const t of transactions) {
    const pence = toPence(t.amount);
    if (pence >= 0) continue;
    const name = t.category_name || 'Other';
    totals[name] = (totals[name] || 0) - pence;
  }
  return totals;
}

// Everything the dashboard's "Spend by Category" card shows for one month.
// Per category: `pence` this month, `prevPence` for the whole previous
// month (the "last month" marker on the bars), and `pct`, the like-for-like
// change — null when there is nothing to compare against.
export function summariseMonth(transactions, monthKey, today = new Date()) {
  const selected = splitMonthKey(monthKey);
  const prev = previousMonth(selected);
  const now = parseDateKey(todayKey(today));

  const monthDays = daysInMonth(selected.year, selected.month);
  const prevDays = daysInMonth(prev.year, prev.month);
  const isCurrentMonth = selected.year === now.year && selected.month === now.month;
  const daysElapsed = isCurrentMonth ? now.day : monthDays;

  const current = spendByCategory(transactionsInMonth(transactions, monthKey));
  const prevRange = monthRange(prev.year, prev.month);
  const previousWhole = spendByCategory(between(transactions, prevRange.from, prevRange.to));
  const previousToDate = isCurrentMonth
    ? spendByCategory(between(transactions, prevRange.from, makeDateKey(prev.year, prev.month, Math.min(daysElapsed, prevDays))))
    : previousWhole;

  const categories = Object.entries(current)
    .sort((a, b) => b[1] - a[1])
    .map(([name, pence]) => {
      const baseline = previousToDate[name] || 0;
      return { name, pence, prevPence: previousWhole[name] || 0, pct: baseline > 0 ? percentChange(pence, baseline) : null };
    });

  const totalPence = sumPence(Object.values(current));
  const prevTotalPence = sumPence(Object.values(previousWhole));
  const comparableTotalPence = sumPence(Object.values(previousToDate));

  // The projection compares the expected full month with the whole of last
  // month. For a month in progress, the rest of the month is assumed to go
  // as the same days of last month did, so a payment that falls early (like
  // rent on the 1st) is counted once rather than multiplied by the pace.
  // With no spending last month to go on, it falls back to the pace so far.
  const projectionBasis = isCurrentMonth && prevTotalPence > 0 ? 'last-month' : 'pace';
  const projectedPence = !isCurrentMonth
    ? totalPence
    : projectionBasis === 'last-month'
      ? totalPence + (prevTotalPence - comparableTotalPence)
      : Math.round((totalPence / daysElapsed) * monthDays);
  const pctVsLastMonth = prevTotalPence > 0 ? percentChange(projectedPence, prevTotalPence) : null;

  return {
    categories,
    totalPence,
    prevTotalPence,
    comparableTotalPence,
    projectedPence,
    projectionBasis,
    pctVsLastMonth,
    isCurrentMonth,
    daysElapsed,
    daysInMonth: monthDays,
    monthName: MONTH_NAMES_LONG[selected.month - 1],
    prevMonthName: MONTH_NAMES_LONG[prev.month - 1],
  };
}

function money(pence) {
  return formatGBP(pence, { decimals: pence >= 1000 ? 0 : 2 });
}

// One sentence describing the month's spending, or null with no spending.
// It only states what happened, compared like for like; it never suggests
// what to do about it.
export function buildInsight(summary) {
  const { categories, isCurrentMonth, monthName, prevMonthName, comparableTotalPence } = summary;
  if (categories.length === 0) return null;

  const notable = categories
    .filter((c) => c.pct !== null && Math.abs(c.pct) > NOTABLE_CHANGE_PCT)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || b.pence - a.pence);

  if (notable.length > 0) {
    const top = notable[0];
    const change = `${Math.round(Math.abs(top.pct))}% ${top.pct > 0 ? 'more' : 'less'}`;
    const text = isCurrentMonth
      ? `${top.name}: ${money(top.pence)} so far this month, ${change} than by the same day last month.`
      : `${top.name}: ${money(top.pence)} in ${monthName}, ${change} than in ${prevMonthName}.`;
    return { text, tone: 'neutral' };
  }

  const top = categories[0];
  let text = isCurrentMonth
    ? `${top.name} is the largest spending category so far this month (${money(top.pence)}).`
    : `${top.name} was the largest spending category in ${monthName} (${money(top.pence)}).`;
  if (comparableTotalPence === 0) {
    text += isCurrentMonth
      ? ' No spending was recorded by the same day last month.'
      : ` No spending was recorded in ${prevMonthName}.`;
  }
  return { text, tone: 'neutral' };
}
