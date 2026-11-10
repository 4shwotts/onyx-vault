// All money arithmetic in the browser happens in integer pence. The API
// returns amounts as exact decimal strings ("-12.50", from Postgres
// NUMERIC), which are parsed as text, never added up as floating-point
// pounds. Pounds only reappear at the very end, for display.

const MONEY_TEXT = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

// "-12.50" | "12.5" | 12.5 | -0 -> integer pence. Throws on anything else,
// so a malformed value is noticed instead of silently becoming NaN.
export function toPence(value) {
  const text = typeof value === 'number' ? String(value) : String(value ?? '').trim();
  const match = MONEY_TEXT.exec(text);
  if (!match) throw new Error(`Not a money value: ${JSON.stringify(value)}`);
  const [, minus, pounds, fraction = ''] = match;
  const magnitude = Number(pounds) * 100 + Number(fraction.padEnd(2, '0'));
  return minus && magnitude !== 0 ? -magnitude : magnitude;
}

export function sumPence(values) {
  return values.reduce((total, pence) => total + pence, 0);
}

// Percentage change from `previous` to `current`, or null when there is
// nothing to compare against (previous is zero).
export function percentChange(currentPence, previousPence) {
  if (previousPence === 0) return null;
  return ((currentPence - previousPence) / previousPence) * 100;
}

const formatters = new Map();
function formatter(decimals) {
  if (!formatters.has(decimals)) {
    formatters.set(decimals, new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }));
  }
  return formatters.get(decimals);
}

// Whole pence -> "£1,234.56". With { decimals: 0 }, rounds to the nearest
// pound, halves away from zero (£2.50 -> £3, -£2.50 -> -£3).
export function formatGBP(pence, { decimals = 2 } = {}) {
  if (decimals === 0) {
    const pounds = Math.sign(pence) * Math.round(Math.abs(pence) / 100);
    return formatter(0).format(pounds === 0 ? 0 : pounds).replace('-', '−');
  }
  return formatter(2).format(pence / 100).replace('-', '−');
}

// Transaction-list style: "+£2,100.00" for money in, "−£42.10" for money
// out (a true minus sign, not a hyphen).
export function formatSignedGBP(pence, options) {
  const magnitude = formatGBP(Math.abs(pence), options);
  if (pence > 0) return `+${magnitude}`;
  if (pence < 0) return `−${magnitude}`;
  return magnitude;
}
