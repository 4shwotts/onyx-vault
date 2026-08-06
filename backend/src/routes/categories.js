const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// No GET /:id or DELETE /:id yet — categories are currently created
// on the fly (see resolveCategoryId in the frontend) and only ever
// listed or referenced by id elsewhere, never fetched/deleted individually.

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
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
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