// Money is stored as NUMERIC(12,2) in Postgres (exact) and handled in
// application code as an integer number of pence, never as a floating
// point number of pounds. Amounts are parsed from their decimal text,
// so 0.1 + 0.2 style rounding errors can't creep in.

// Largest amount a single transaction or recurring rule may carry:
// £999,999.99. With the 10,000-transaction cap per user, even a maximal
// account balance stays inside NUMERIC(12,2) (just under £10 billion).
const MAX_AMOUNT_PENCE = 99_999_999;

const DECIMAL_PATTERN = /^(-)?(\d{1,9})(?:\.(\d{1,2}))?$/;

// Parses a client-supplied amount (a number or a decimal string, in
// pounds) into integer pence. Returns { ok: true, pence } or
// { ok: false, error }. Rejects zero, more than two decimal places,
// exponents, non-finite values and anything outside ±MAX_AMOUNT_PENCE.
function parseAmountToPence(value, { allowZero = false } = {}) {
  let text;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { ok: false, error: 'amount must be a finite number' };
    // String(n) gives the shortest round-tripping decimal for the number
    // the client actually sent: 12.5 -> "12.5", 0.1 + 0.2 -> "0.30000000000000004".
    text = String(value);
  } else if (typeof value === 'string') {
    text = value.trim();
  } else {
    return { ok: false, error: 'amount must be a number' };
  }

  const match = DECIMAL_PATTERN.exec(text);
  if (!match) {
    return { ok: false, error: 'amount must be a number with at most 2 decimal places' };
  }

  const [, minus, pounds, fraction = ''] = match;
  const magnitude = Number(pounds) * 100 + Number(fraction.padEnd(2, '0'));
  if (magnitude > MAX_AMOUNT_PENCE) {
    return { ok: false, error: 'amount must be no more than £999,999.99 either way' };
  }
  if (magnitude === 0 && !allowZero) {
    return { ok: false, error: 'amount must not be zero' };
  }

  const pence = minus && magnitude !== 0 ? -magnitude : magnitude;
  return { ok: true, pence };
}

// Converts a NUMERIC(12,2) value as node-postgres returns it ("-12.50")
// into integer pence without going through a float.
function numericToPence(value) {
  const text = String(value).trim();
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error(`Not a money value: ${text}`);
  const [, minus, pounds, fraction = ''] = match;
  const magnitude = Number(pounds) * 100 + Number(fraction.padEnd(2, '0'));
  return minus && magnitude !== 0 ? -magnitude : magnitude;
}

// Converts integer pence into the exact decimal text to send to Postgres.
function penceToDecimal(pence) {
  if (!Number.isSafeInteger(pence)) throw new Error(`Not a whole number of pence: ${pence}`);
  const sign = pence < 0 ? '-' : '';
  const abs = Math.abs(pence);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

// Formats pence as UK currency text, e.g. 123456 -> "£1,234.56" and
// -1250 -> "-£12.50".
function formatGBP(pence) {
  return gbp.format(pence / 100);
}

module.exports = { MAX_AMOUNT_PENCE, parseAmountToPence, numericToPence, penceToDecimal, formatGBP };
