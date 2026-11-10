// Pure date logic for recurring rules (no database), shared by the
// recurring-payment job and the demo data generator.

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

// Splits a date into calendar parts without any time-zone conversion.
// DATE columns arrive as 'YYYY-MM-DD' strings (see db.js). A Date object
// is read with *local* getters, because that is how node-postgres builds
// one from a DATE (local midnight) — UTC getters would move it a day.
function dateParts(value) {
  if (value instanceof Date) {
    return [value.getFullYear(), value.getMonth() + 1, value.getDate()];
  }
  const match = DATE_KEY.exec(String(value));
  if (!match) throw new Error(`Not a calendar date: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function toKey(y, m, d) {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// Day of the month a monthly rule is anchored to. Rules created before
// day_of_month existed (or in the gap between the migration and this code
// deploying) fall back to the day of their next run date.
function anchorDayOf(rule) {
  return rule.day_of_month || dateParts(rule.next_run_date)[2];
}

// Next run date after `current`, as 'YYYY-MM-DD'.
// - weekly: seven days later.
// - monthly: the rule's own day of the month (`anchorDay`, e.g. 31) in the
//   following month, moved back to that month's last day only when the
//   month is too short — so a rule on the 31st goes Jan 31 -> Feb 28 ->
//   Mar 31, rather than drifting to the 28th for good. Without an anchor
//   day, the current date's day is used.
function nextDate(current, frequency, anchorDay) {
  const [y, m, d] = dateParts(current);

  if (frequency === 'weekly') {
    const next = new Date(Date.UTC(y, m - 1, d + 7));
    return toKey(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  }

  const targetYear = m === 12 ? y + 1 : y;
  const targetMonth = m === 12 ? 1 : m + 1;
  const day = Math.min(anchorDay || d, daysInMonth(targetYear, targetMonth));
  return toKey(targetYear, targetMonth, day);
}

module.exports = { dateParts, anchorDayOf, nextDate, daysInMonth };
