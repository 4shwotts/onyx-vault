const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, parseId, sendError, notFound } = require('../utils/http');
const { withUserLock } = require('../utils/locks');
const { schemas, validate } = require('../validation/schemas');

const router = express.Router();
router.use(requireAuth);

const MAX_ACCOUNTS_PER_USER = 10;

// Every route below is scoped to req.userId (set by requireAuth from the
// session), so a user can only ever see or modify their own accounts.
// An id that doesn't exist and an id that belongs to someone else get the
// same 404.
router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, type, balance, created_at FROM accounts WHERE user_id = $1 ORDER BY created_at ASC, id ASC',
    [req.userId]
  );
  res.json(result.rows);
}));

router.post('/', asyncHandler(async (req, res) => {
  const input = validate(schemas.createAccount, req.body);
  if (!input.ok) return sendError(res, 400, input.error);
  const { name, type } = input.data;

  // Count and insert under a lock on the user, so simultaneous requests
  // can't each see "9 accounts" and all insert.
  const created = await withUserLock(req.userId, async (client) => {
    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM accounts WHERE user_id = $1', [req.userId]);
    if (rows[0].n >= MAX_ACCOUNTS_PER_USER) return null;
    const result = await client.query(
      'INSERT INTO accounts (user_id, name, type, balance) VALUES ($1, $2, $3, 0) RETURNING id, name, type, balance, created_at',
      [req.userId, name, type]
    );
    return result.rows[0];
  });

  if (!created) return sendError(res, 403, `You've reached the limit of ${MAX_ACCOUNTS_PER_USER} accounts`);
  res.status(201).json(created);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res, 'Account not found');
  const result = await pool.query(
    'SELECT id, name, type, balance, created_at FROM accounts WHERE id = $1 AND user_id = $2',
    [id, req.userId]
  );
  if (result.rows.length === 0) return notFound(res, 'Account not found');
  res.json(result.rows[0]);
}));

// ON DELETE CASCADE on transactions.account_id means deleting an account
// also deletes every transaction tied to it at the database level.
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res, 'Account not found');
  const result = await pool.query(
    'DELETE FROM accounts WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, req.userId]
  );
  if (result.rows.length === 0) return notFound(res, 'Account not found');
  res.json({ success: true });
}));

module.exports = router;
