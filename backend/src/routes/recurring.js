const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { processRecurringTransactions, processRule } = require('../cron/processRecurring');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
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
});

router.post('/', async (req, res) => {
  const { account_id, category_id, amount, description, frequency, start_date } = req.body;

  if (!account_id || amount === undefined || !frequency || !start_date) {
    return res.status(400).json({ error: 'account_id, amount, frequency, and start_date are required' });
  }

  if (!['weekly', 'monthly'].includes(frequency)) {
    return res.status(400).json({ error: 'frequency must be "weekly" or "monthly"' });
  }

  const owns = await pool.query('SELECT id FROM accounts WHERE id = $1 AND user_id = $2', [account_id, req.userId]);
  if (owns.rows.length === 0) {
    return res.status(403).json({ error: 'That account does not belong to you' });
  }

  // Same reasoning as the transactions route: without this, a user could
  // reference another user's category_id, which would then leak that
  // category's name into their own recurring-rules list via the
  // unfiltered JOIN in GET /.
  if (category_id) {
    const ownsCategory = await pool.query('SELECT id FROM categories WHERE id = $1 AND user_id = $2', [category_id, req.userId]);
    if (ownsCategory.rows.length === 0) {
      return res.status(403).json({ error: 'That category does not belong to you' });
    }
  }

  try {
    const inserted = await pool.query(
      `INSERT INTO recurring_transactions (user_id, account_id, category_id, amount, description, frequency, next_run_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.userId, account_id, category_id || null, Number(amount), description || null, frequency, start_date]
    );
    let rule = inserted.rows[0];
    let firstTransactionCreated = false;

    // If the chosen start date is today (or already in the past), process
    // it immediately rather than leaving it waiting for the next cron run
    // — mirrors real subscription billing: charged today, not "scheduled
    // to eventually be charged today."
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
});

router.delete('/:id', async (req, res) => {
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
});

// Manually triggers processing of all due recurring rules across all users.
// Exists so you (and anyone reviewing the project) can see the feature work
// immediately instead of waiting for the real daily cron to fire.
router.post('/run-now', async (req, res) => {
  try {
    const count = await processRecurringTransactions();
    res.json({ processed: count });
  } catch (err) {
    console.error('Manual recurring run error:', err.message);
    res.status(500).json({ error: 'Could not process recurring transactions' });
  }
});

module.exports = router;