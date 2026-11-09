const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, parseId } = require('../utils/http');
const { processRecurringTransactions, processRule } = require('../cron/processRecurring');

const router = express.Router();
router.use(requireAuth);

const MAX_RECURRING_RULES_PER_USER = 15;

router.get('/', asyncHandler(async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.account_id, r.category_id, r.amount, r.description, r.frequency, r.next_run_date,
              c.name AS category_name, a.name AS account_name
       FROM recurring_transactions r
       JOIN accounts a ON a.id = r.account_id
       LEFT JOIN categories c ON c.id = r.category_id
       WHERE r.user_id = $1
       ORDER BY r.next_run_date ASC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get recurring error:', err.message);
    res.status(500).json({ error: 'Could not load recurring transactions' });
  }
}));

router.post('/', asyncHandler(async (req, res) => {
  const { account_id, category_id, amount, description, frequency, start_date } = req.body;

  if (!account_id || amount === undefined || !frequency || !start_date) {
    return res.status(400).json({ error: 'account_id, amount, frequency, and start_date are required' });
  }

  if (!['weekly', 'monthly'].includes(frequency)) {
    return res.status(400).json({ error: 'frequency must be "weekly" or "monthly"' });
  }

  // Ids are checked before they reach a query: a malformed id used to make
  // Postgres reject outside any error handling and take the API down.
  const accountId = parseId(account_id);
  if (accountId === null) {
    return res.status(400).json({ error: 'account_id must be a positive whole number' });
  }

  const hasCategory = category_id !== undefined && category_id !== null && category_id !== '';
  const categoryId = hasCategory ? parseId(category_id) : null;
  if (hasCategory && categoryId === null) {
    return res.status(400).json({ error: 'category_id must be a positive whole number' });
  }

  const owns = await pool.query('SELECT id FROM accounts WHERE id = $1 AND user_id = $2', [accountId, req.userId]);
  if (owns.rows.length === 0) {
    return res.status(403).json({ error: 'That account does not belong to you' });
  }

  if (categoryId) {
    const ownsCategory = await pool.query('SELECT id FROM categories WHERE id = $1 AND user_id = $2', [categoryId, req.userId]);
    if (ownsCategory.rows.length === 0) {
      return res.status(403).json({ error: 'That category does not belong to you' });
    }
  }

  const countResult = await pool.query('SELECT COUNT(*) FROM recurring_transactions WHERE user_id = $1', [req.userId]);
  if (Number(countResult.rows[0].count) >= MAX_RECURRING_RULES_PER_USER) {
    return res.status(403).json({ error: `You've reached the limit of ${MAX_RECURRING_RULES_PER_USER} recurring rules` });
  }

  try {
    const inserted = await pool.query(
      `INSERT INTO recurring_transactions (user_id, account_id, category_id, amount, description, frequency, next_run_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.userId, accountId, categoryId, Number(amount), description || null, frequency, start_date]
    );
    let rule = inserted.rows[0];
    let firstTransactionCreated = false;

    const dueCheck = await pool.query(
      "SELECT $1::date <= (NOW() AT TIME ZONE 'UTC')::date AS is_due",
      [rule.next_run_date]
    );

    if (dueCheck.rows[0].is_due) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const newNextRun = await processRule(client, rule);
        await client.query('COMMIT');
        rule = { ...rule, next_run_date: newNextRun };
        firstTransactionCreated = true;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Immediate recurring processing error for rule', rule.id, ':', err.message);
      } finally {
        client.release();
      }
    }

    res.status(201).json({ ...rule, first_transaction_created: firstTransactionCreated });
  } catch (err) {
    console.error('Create recurring error:', err.message);
    res.status(500).json({ error: 'Could not create recurring transaction' });
  }
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM recurring_transactions WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recurring transaction not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete recurring error:', err.message);
    res.status(500).json({ error: 'Could not delete recurring transaction' });
  }
}));

// Manually triggers processing of the REQUESTING USER'S OWN due
// recurring rules only. Previously this called processRecurringTransactions()
// directly, which processes every user's due rules with no scoping at
// all — any authenticated user could trigger a batch job touching the
// entire user base, not just their own data, and with no rate limit on
// top of that. Reimplemented here using the same processRule pattern
// the POST / handler already uses for immediate processing, scoped to
// req.userId via the WHERE clause below, so it can only ever affect
// the calling user's own rules.
router.post('/run-now', asyncHandler(async (req, res) => {
  try {
    const dueRules = await pool.query(
      `SELECT * FROM recurring_transactions
       WHERE user_id = $1 AND next_run_date <= (NOW() AT TIME ZONE 'UTC')::date`,
      [req.userId]
    );

    let processed = 0;
    for (const rule of dueRules.rows) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await processRule(client, rule);
        await client.query('COMMIT');
        processed += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Manual recurring run error for rule', rule.id, ':', err.message);
      } finally {
        client.release();
      }
    }

    res.json({ processed });
  } catch (err) {
    console.error('Manual recurring run error:', err.message);
    res.status(500).json({ error: 'Could not process recurring transactions' });
  }
}));

module.exports = router;