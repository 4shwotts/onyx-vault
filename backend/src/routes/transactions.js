const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isAnomalous } = require('../utils/anomaly');

const router = express.Router();
router.use(requireAuth);

const MAX_TRANSACTIONS_PER_USER = 10000;

async function assertAccountOwnership(accountId, userId, client = pool) {
  const result = await client.query(
    'SELECT id FROM accounts WHERE id = $1 AND user_id = $2',
    [accountId, userId]
  );
  return result.rows.length > 0;
}

// Same pattern as account ownership — prevents a user from referencing
// another user's category_id when creating a transaction, which would
// otherwise leak that category's name into their own transaction list
// via the unfiltered JOIN in GET /.
async function assertCategoryOwnership(categoryId, userId, client = pool) {
  const result = await client.query(
    'SELECT id FROM categories WHERE id = $1 AND user_id = $2',
    [categoryId, userId]
  );
  return result.rows.length > 0;
}

// Counts transactions via a join back to accounts, since transactions
// has no user_id column of its own, ownership only exists through the
// account it belongs to.
async function countUserTransactions(userId, client = pool) {
  const result = await client.query(
    `SELECT COUNT(*) FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE a.user_id = $1`,
    [userId]
  );
  return Number(result.rows[0].count);
}

router.get('/', async (req, res) => {
  const { account_id, category_id, from, to } = req.query;

  const conditions = ['a.user_id = $1'];
  const values = [req.userId];

  if (account_id) {
    values.push(account_id);
    conditions.push(`t.account_id = $${values.length}`);
  }
  if (category_id) {
    values.push(category_id);
    conditions.push(`t.category_id = $${values.length}`);
  }
  if (from) {
    values.push(from);
    conditions.push(`t.date >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    conditions.push(`t.date <= $${values.length}`);
  }

  const query = `
    SELECT t.id, t.account_id, t.category_id, t.amount, t.description, t.date, t.is_recurring, t.is_anomaly,
           c.name AS category_name, a.name AS account_name
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY t.date DESC, t.id DESC
  `;

  try {
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Get transactions error:', err.message);
    res.status(500).json({ error: 'Could not load transactions' });
  }
});

router.post('/', async (req, res) => {
  const { account_id, category_id, amount, description, date } = req.body;

  if (!account_id || amount === undefined || !date) {
    return res.status(400).json({ error: 'account_id, amount, and date are required' });
  }

  const numericAmount = Number(amount);
  if (Number.isNaN(numericAmount)) {
    return res.status(400).json({ error: 'amount must be a number' });
  }

  const owns = await assertAccountOwnership(account_id, req.userId);
  if (!owns) {
    return res.status(403).json({ error: 'That account does not belong to you' });
  }

  // Ownership check on category_id specifically: without this, a user
  // could submit another user's category id and have it silently accepted,
  // since categories are otherwise only ever filtered by ownership on the
  // list endpoint, not when referenced by id elsewhere.
  if (category_id) {
    const ownsCategory = await assertCategoryOwnership(category_id, req.userId);
    if (!ownsCategory) {
      return res.status(403).json({ error: 'That category does not belong to you' });
    }
  }

  const existingCount = await countUserTransactions(req.userId);
  if (existingCount >= MAX_TRANSACTIONS_PER_USER) {
    return res.status(403).json({ error: `You've reached the limit of ${MAX_TRANSACTIONS_PER_USER} transactions` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const flagged = await isAnomalous(client, req.userId, category_id, numericAmount);

    const txResult = await client.query(
      `INSERT INTO transactions (account_id, category_id, amount, description, date, is_anomaly)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [account_id, category_id || null, numericAmount, description || null, date, flagged]
    );

    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [numericAmount, account_id]
    );

    await client.query('COMMIT');
    res.status(201).json(txResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create transaction error:', err.message);
    res.status(500).json({ error: 'Could not create transaction' });
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT t.id, t.account_id, t.amount
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       WHERE t.id = $1 AND a.user_id = $2`,
      [req.params.id, req.userId]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const { account_id, amount } = existing.rows[0];

    await client.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);
    await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, account_id]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete transaction error:', err.message);
    res.status(500).json({ error: 'Could not delete transaction' });
  } finally {
    client.release();
  }
});

module.exports = router;