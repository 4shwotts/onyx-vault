// Client-side checks for the add/edit transaction form. They mirror the
// API's rules (see backend/src/validation/schemas.js) so most mistakes are
// caught before a request is sent; the API still checks everything again.

const AMOUNT_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export const MAX_AMOUNT = '999999.99';

function isRealDate(value) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d
    && y >= 1970 && y <= 2100;
}

// values: { accountId, amount, date, description, isExpense }
// Returns { field: message } for every problem; empty when valid.
export function validateTransactionForm(values) {
  const errors = {};
  const amount = String(values.amount ?? '').trim();

  if (!values.accountId) errors.accountId = 'Choose an account.';

  if (!amount) {
    errors.amount = 'Enter an amount.';
  } else if (!AMOUNT_PATTERN.test(amount)) {
    errors.amount = 'Enter an amount in pounds, with up to 2 decimal places (e.g. 12.50).';
  } else if (Number(amount) === 0) {
    errors.amount = 'The amount can’t be zero.';
  } else if (Number(amount) > Number(MAX_AMOUNT)) {
    errors.amount = 'The amount can’t be more than £999,999.99.';
  }

  if (!values.date) errors.date = 'Choose a date.';
  else if (!isRealDate(values.date)) errors.date = 'Choose a valid date.';

  if ((values.description || '').length > 255) errors.description = 'Keep the description to 255 characters or fewer.';

  return errors;
}

// The signed amount as an exact decimal string for the API: expenses are
// stored as negative amounts, income as positive.
export function signedAmount(amount, isExpense) {
  const text = String(amount).trim();
  const [pounds, pence = ''] = text.split('.');
  const exact = `${Number(pounds)}.${pence.padEnd(2, '0')}`;
  return isExpense ? `-${exact}` : exact;
}
