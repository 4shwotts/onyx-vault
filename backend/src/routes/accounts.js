const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const MAX_ACCOUNTS_PER_USER = 10;

// Every route below is scoped to req.userId (set by requireAuth from the
// verified JWT), so a user can only ever see or modify their own accounts.

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, type, balance, created_at FROM accounts WHERE user_id = $1 ORDER BY created_at ASC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get accounts error:', err.message);
    res.status(500).json({ error: 'Could not load accounts' });
  }
});

router.post('/', async (req, res) => {
  const { name, type } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  try {
    // Counted here rather than relying on a DB constraint, so we can
    // return a clear message instead of a raw constraint violation.
    const countResult = await pool.query('SELECT COUNT(*) FROM accounts WHERE user_id = $1', [req.userId]);
    if (Number(countResult.rows[0].count) >= MAX_ACCOUNTS_PER_USER) {
      return res.status(403).json({ error: `You've reached the limit of ${MAX_ACCOUNTS_PER_USER} accounts` });
    }

    const result = await pool.query(
      'INSERT INTO accounts (user_id, name, type, balance) VALUES ($1, $2, $3, 0) RETURNING *',
      [req.userId, name, type]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create account error:', err.message);
    res.status(500).json({ error: 'Could not create account' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, type, balance, created_at FROM accounts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get account error:', err.message);
    res.status(500).json({ error: 'Could not load account' });
  }
});

// ON DELETE CASCADE on transactions.account_id (see schema) means deleting
// an account also deletes every transaction tied to it at the database
// level — no separate cleanup query needed here.
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM accounts WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err.message);
    res.status(500).json({ error: 'Could not delete account' });
  }
});

module.exports = router;