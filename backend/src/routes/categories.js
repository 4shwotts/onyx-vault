const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// No GET /:id or DELETE /:id yet — categories are currently created
// on the fly (see resolveCategoryId in the frontend) and only ever
// listed or referenced by id elsewhere, never fetched/deleted individually.

// Matches the same pattern as MAX_ACCOUNTS_PER_USER (accounts.js) and
// MAX_RECURRING_RULES_PER_USER (recurring.js) — this route had no cap
// at all before, unlike every other create-a-thing route in the app.
// Set higher than those two since categories get created automatically
// during CSV import (one per distinct category guessed from each row),
// not just by direct user action.
const MAX_CATEGORIES_PER_USER = 40;
const MAX_NAME_LENGTH = 40;

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name FROM categories WHERE user_id = $1 ORDER BY name ASC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get categories error:', err.message);
    res.status(500).json({ error: 'Could not load categories' });
  }
});

router.post('/', async (req, res) => {
  const name = (req.body.name || '').trim();

  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  // No previous cap on length — an unbounded string here isn't a
  // security hole (React escapes it on render), but it can bloat
  // storage or break layout in the category selects/badges elsewhere
  // in the app, so it gets the same kind of limit as password length
  // already has on the auth routes.
  if (name.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ error: `Category name must be ${MAX_NAME_LENGTH} characters or fewer` });
  }

  try {
    // Counted here rather than relying on a DB constraint, so we can
    // return a clear message instead of a raw constraint violation —
    // same reasoning as the equivalent check in accounts.js.
    const countResult = await pool.query('SELECT COUNT(*) FROM categories WHERE user_id = $1', [req.userId]);
    if (Number(countResult.rows[0].count) >= MAX_CATEGORIES_PER_USER) {
      return res.status(403).json({ error: `You've reached the limit of ${MAX_CATEGORIES_PER_USER} categories` });
    }

    const result = await pool.query(
      'INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING *',
      [req.userId, name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create category error:', err.message);
    res.status(500).json({ error: 'Could not create category' });
  }
});

module.exports = router;