const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isAnomalous } = require('../utils/anomaly');
const { asyncHandler, parseId, sendError, notFound } = require('../utils/http');
const { withUserLock } = require('../utils/locks');
const { penceToDecimal } = require('../utils/money');
const { schemas, validate } = require('../validation/schemas');

const router = express.Router();
router.use(requireAuth);

const MAX_TRANSACTIONS_PER_USER = 10000;

const SELECT_COLUMNS = `
  t.id, t.account_id, t.category_id, t.amount, t.description, t.date, t.is_recurring, t.is_anomaly,
  c.name AS category_name, a.name AS account_name`;

// Thrown inside a database transaction to roll it back and answer with a
// particular status, without the error middleware treating it as a 500.
class HttpOutcome extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function inTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function respondWithOutcome(res, err) {
  if (err instanceof HttpOutcome) return sendError(res, err.status, err.message);
  throw err;
}

async function ownsAccount(db, accountId, userId) {
  const { rows } = await db.query('SELECT id FROM accounts WHERE id = $1 AND user_id = $2', [accountId, userId]);
  return rows.length > 0;
}

// Without this, a user could attach another user's category to their own
// transaction and see its name through the JOIN in the list.
async function ownsCategory(db, categoryId, userId) {
  const { rows } = await db.query('SELECT id FROM categories WHERE id = $1 AND user_id = $2', [categoryId, userId]);
  return rows.length > 0;
}

// Moves balances for a change from (oldAccount, oldAmount) to (newAccount,
// newAmount). Accounts are always updated in id order so two edits
// touching the same pair of accounts can't deadlock.
async function applyBalanceChange(db, oldAccountId, oldAmount, newAccountId, newAmount) {
  if (oldAccountId === newAccountId) {
    await db.query('UPDATE accounts SET balance = balance - $1::numeric + $2::numeric WHERE id = $3', [oldAmount, newAmount, oldAccountId]);
    return;
  }
  const changes = [[oldAccountId, '-', oldAmount], [newAccountId, '+', newAmount]].sort((x, y) => x[0] - y[0]);
  for (const [accountId, sign, amount] of changes) {
    await db.query(`UPDATE accounts SET balance = balance ${sign} $1::numeric WHERE id = $2`, [amount, accountId]);
  }
}

function buildFilters(userId, query) {
  const conditions = ['a.user_id = $1'];
  const values = [userId];
  for (const [key, column, op] of [['account_id', 't.account_id', '='], ['category_id', 't.category_id', '='], ['from', 't.date', '>='], ['to', 't.date', '<=']]) {
    if (query[key] !== undefined) {
      values.push(query[key]);
      conditions.push(`${column} ${op} $${values.length}`);
    }
  }
  return { where: conditions.join(' AND '), values };
}

// Without page/limit: every matching transaction, as an array (what the
// dashboard uses today). With page and/or limit: one page, plus the total
// count and income/spending/net totals for everything matching the
// filters — summed by Postgres on NUMERIC, so they are exact.
router.get('/', asyncHandler(async (req, res) => {
  const input = validate(schemas.listTransactionsQuery, req.query);
  if (!input.ok) return sendError(res, 400, input.error);
  const query = input.data;
  const paginated = req.query.page !== undefined || req.query.limit !== undefined;
  const { where, values } = buildFilters(req.userId, query);

  const from = `
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE ${where}`;

  if (!paginated) {
    const result = await pool.query(`SELECT ${SELECT_COLUMNS} ${from} ORDER BY t.date DESC, t.id DESC`, values);
    return res.json(result.rows);
  }

  const offset = (query.page - 1) * query.limit;
  const [items, summary] = await Promise.all([
    pool.query(
      `SELECT ${SELECT_COLUMNS} ${from} ORDER BY t.date DESC, t.id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, query.limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0), 0)::numeric(14,2)::text AS income,
              COALESCE(SUM(t.amount) FILTER (WHERE t.amount < 0), 0)::numeric(14,2)::text AS spending,
              COALESCE(SUM(t.amount), 0)::numeric(14,2)::text AS net
       ${from}`,
      values
    ),
  ]);

  const { total, income, spending, net } = summary.rows[0];
  res.json({
    transactions: items.rows,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
    totals: { income, spending, net },
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res, 'Transaction not found');
  const result = await pool.query(
    `SELECT ${SELECT_COLUMNS}
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.id = $1 AND a.user_id = $2`,
    [id, req.userId]
  );
  if (result.rows.length === 0) return notFound(res, 'Transaction not found');
  res.json(result.rows[0]);
}));

router.post('/', asyncHandler(async (req, res) => {
  const input = validate(schemas.createTransaction, req.body);
  if (!input.ok) return sendError(res, 400, input.error);
  const { account_id: accountId, category_id: categoryId = null, amount, description = null, date } = input.data;
  const amountText = penceToDecimal(amount);

  try {
    // Ownership checks, the cap and the insert all happen under a lock on
    // the user, in one database transaction.
    const created = await withUserLock(req.userId, async (client) => {
      if (!(await ownsAccount(client, accountId, req.userId))) throw new HttpOutcome(404, 'Account not found');
      if (categoryId && !(await ownsCategory(client, categoryId, req.userId))) throw new HttpOutcome(404, 'Category not found');

      const { rows } = await client.query(
        'SELECT COUNT(*)::int AS n FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE a.user_id = $1',
        [req.userId]
      );
      if (rows[0].n >= MAX_TRANSACTIONS_PER_USER) {
        throw new HttpOutcome(403, `You've reached the limit of ${MAX_TRANSACTIONS_PER_USER} transactions`);
      }

      const flagged = await isAnomalous(client, req.userId, categoryId, amount / 100);
      const inserted = await client.query(
        `INSERT INTO transactions (account_id, category_id, amount, description, date, is_anomaly)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [accountId, categoryId, amountText, description, date, flagged]
      );
      await client.query('UPDATE accounts SET balance = balance + $1::numeric WHERE id = $2', [amountText, accountId]);
      return inserted.rows[0];
    });
    res.status(201).json(created);
  } catch (err) {
    respondWithOutcome(res, err);
  }
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res, 'Transaction not found');
  const input = validate(schemas.updateTransaction, req.body);
  if (!input.ok) return sendError(res, 400, input.error);
  const changes = input.data;

  try {
    const updated = await inTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT t.* FROM transactions t JOIN accounts a ON a.id = t.account_id
         WHERE t.id = $1 AND a.user_id = $2 FOR UPDATE OF t`,
        [id, req.userId]
      );
      if (rows.length === 0) throw new HttpOutcome(404, 'Transaction not found');
      const old = rows[0];

      const accountId = changes.account_id ?? old.account_id;
      if (accountId !== old.account_id && !(await ownsAccount(client, accountId, req.userId))) {
        throw new HttpOutcome(404, 'Account not found');
      }
      const categoryId = 'category_id' in changes ? changes.category_id : old.category_id;
      if ('category_id' in changes && categoryId && !(await ownsCategory(client, categoryId, req.userId))) {
        throw new HttpOutcome(404, 'Category not found');
      }
      const amountText = changes.amount !== undefined ? penceToDecimal(changes.amount) : old.amount;
      const description = 'description' in changes ? changes.description : old.description;
      const date = changes.date ?? old.date;

      await applyBalanceChange(client, old.account_id, old.amount, accountId, amountText);

      const flagged = changes.amount !== undefined || 'category_id' in changes
        ? await isAnomalous(client, req.userId, categoryId, Number(amountText))
        : old.is_anomaly;

      const result = await client.query(
        `UPDATE transactions
         SET account_id = $1, category_id = $2, amount = $3, description = $4, date = $5, is_anomaly = $6
         WHERE id = $7 RETURNING *`,
        [accountId, categoryId, amountText, description, date, flagged, id]
      );
      return result.rows[0];
    });
    res.json(updated);
  } catch (err) {
    respondWithOutcome(res, err);
  }
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res, 'Transaction not found');

  try {
    await inTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT t.id, t.account_id, t.amount FROM transactions t JOIN accounts a ON a.id = t.account_id
         WHERE t.id = $1 AND a.user_id = $2 FOR UPDATE OF t`,
        [id, req.userId]
      );
      if (rows.length === 0) throw new HttpOutcome(404, 'Transaction not found');
      const { account_id: accountId, amount } = rows[0];
      await client.query('DELETE FROM transactions WHERE id = $1', [id]);
      await client.query('UPDATE accounts SET balance = balance - $1::numeric WHERE id = $2', [amount, accountId]);
    });
    res.json({ success: true });
  } catch (err) {
    respondWithOutcome(res, err);
  }
}));

module.exports = router;
