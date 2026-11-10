const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, parseId, sendError, notFound } = require('../utils/http');
const { withUserLock } = require('../utils/locks');
const { schemas, validate } = require('../validation/schemas');

const router = express.Router();
router.use(requireAuth);

// Higher than the other caps, since categories are also created
// automatically during CSV import.
const MAX_CATEGORIES_PER_USER = 40;

router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, name FROM categories WHERE user_id = $1 ORDER BY name ASC, id ASC',
    [req.userId]
  );
  res.json(result.rows);
}));

router.post('/', asyncHandler(async (req, res) => {
  const input = validate(schemas.createCategory, req.body);
  if (!input.ok) return sendError(res, 400, input.error);

  const created = await withUserLock(req.userId, async (client) => {
    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM categories WHERE user_id = $1', [req.userId]);
    if (rows[0].n >= MAX_CATEGORIES_PER_USER) return null;
    const result = await client.query(
      'INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING id, name',
      [req.userId, input.data.name]
    );
    return result.rows[0];
  });

  if (!created) return sendError(res, 403, `You've reached the limit of ${MAX_CATEGORIES_PER_USER} categories`);
  res.status(201).json(created);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res, 'Category not found');
  const result = await pool.query('SELECT id, name FROM categories WHERE id = $1 AND user_id = $2', [id, req.userId]);
  if (result.rows.length === 0) return notFound(res, 'Category not found');
  res.json(result.rows[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res, 'Category not found');
  const input = validate(schemas.updateCategory, req.body);
  if (!input.ok) return sendError(res, 400, input.error);

  const result = await pool.query(
    'UPDATE categories SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name',
    [input.data.name, id, req.userId]
  );
  if (result.rows.length === 0) return notFound(res, 'Category not found');
  res.json(result.rows[0]);
}));

// Transactions and rules in the category are kept and become
// uncategorised (ON DELETE SET NULL).
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res, 'Category not found');
  const result = await pool.query('DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id', [id, req.userId]);
  if (result.rows.length === 0) return notFound(res, 'Category not found');
  res.json({ success: true });
}));

module.exports = router;
