// Turns rows from a parsed CSV statement into transactions ready to send
// to the API, and reports every row that can't be used — before anything
// is saved, so an import never stops half-way through.
//
// This is a UK app, so day-first dates are read as day first: 01/08/2026
// is 1 August, never 8 January.

import { makeDateKey, daysInMonth } from '../utils/dates';

// Category guesses use generic words only, never shop or brand names.
const CATEGORY_RULES = [
  { keywords: ['salary', 'wage', 'payroll', 'pension', 'refund'], category: 'Income' },
  { keywords: ['grocer', 'supermarket', 'market', 'bakery', 'butcher'], category: 'Groceries' },
  { keywords: ['subscription', 'membership', 'streaming', 'music plan'], category: 'Subscriptions' },
  { keywords: ['rail', 'train', 'bus', 'taxi', 'fuel', 'petrol', 'parking', 'travel'], category: 'Transport' },
  { keywords: ['cafe', 'café', 'coffee', 'restaurant', 'takeaway', 'pizza', 'bistro'], category: 'Eating Out' },
  { keywords: ['energy', 'water', 'council tax', 'broadband', 'phone', 'insurance', 'rent'], category: 'Bills' },
  { keywords: ['cinema', 'theatre', 'concert', 'tickets', 'games'], category: 'Entertainment' },
  { keywords: ['homeware', 'clothing', 'books', 'hardware', 'garden'], category: 'Shopping' },
];

export function guessCategory(description) {
  const lower = (description || '').toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) return rule.category;
  }
  return 'Other';
}

// Accepts 2026-08-01 (ISO), and day-first 01/08/2026, 1/8/2026, 01-08-2026
// or 01.08.2026. Returns 'YYYY-MM-DD', or null if it isn't a real date.
export function parseStatementDate(raw) {
  const text = String(raw ?? '').trim();
  let y;
  let m;
  let d;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (match) {
    [, y, m, d] = match.map(Number);
  } else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
    if (!match) return null;
    [, d, m, y] = match.map(Number);
  }
  if (y < 1970 || y > 2100 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return makeDateKey(y, m, d);
}

// Accepts 12.50, -12.50, £1,234.56, -£4.20, (12.50) for money out, and
// trailing CR/DR markers. Returns the amount as an exact decimal string
// ("-12.50"), or null if it isn't a usable amount.
export function parseStatementAmount(raw) {
  let text = String(raw ?? '').trim();
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) { negative = true; text = text.slice(1, -1).trim(); }
  if (/\s*DR$/i.test(text)) { negative = true; text = text.replace(/\s*DR$/i, ''); }
  text = text.replace(/\s*CR$/i, '');
  if (text.startsWith('-')) { negative = !negative; text = text.slice(1).trim(); }
  if (text.startsWith('+')) text = text.slice(1).trim();
  text = text.replace(/^£/, '').replace(/,(?=\d{3}(\D|$))/g, '');
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const pence = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  if (pence === 0) return null;
  const fixed = `${Math.floor(pence / 100)}.${String(pence % 100).padStart(2, '0')}`;
  return negative ? `-${fixed}` : fixed;
}

function pick(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && String(row[name]).trim() !== '') return row[name];
  }
  return undefined;
}

// rows: objects keyed by the CSV's header names (as Papa Parse produces).
// Returns { transactions, errors }, where errors are { line, message } with
// the spreadsheet line number (the header is line 1).
export function prepareImport(rows) {
  const transactions = [];
  const errors = [];

  rows.forEach((row, i) => {
    const line = i + 2;
    const description = String(pick(row, ['Description', 'description', 'Details', 'Payee', 'Merchant']) ?? '').trim();
    const rawDate = pick(row, ['Date', 'date', 'Transaction Date']);
    const rawAmount = pick(row, ['Amount', 'amount', 'Value', 'value']);

    const date = parseStatementDate(rawDate);
    const amount = parseStatementAmount(rawAmount);
    const problems = [];
    if (rawDate === undefined) problems.push('no date');
    else if (!date) problems.push(`the date “${rawDate}” isn’t a valid DD/MM/YYYY or YYYY-MM-DD date`);
    if (rawAmount === undefined) problems.push('no amount');
    else if (!amount) problems.push(`the amount “${rawAmount}” isn’t a valid non-zero amount`);
    if (description.length > 255) problems.push('the description is longer than 255 characters');

    if (problems.length > 0) {
      errors.push({ line, message: `Line ${line}: ${problems.join('; ')}.` });
    } else {
      transactions.push({ id: i, description, amount, date, category: guessCategory(description) });
    }
  });

  return { transactions, errors };
}
