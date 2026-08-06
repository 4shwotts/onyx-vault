const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 12;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 1000 * 60 * 60 * 24, // 24 hours
};

// Precomputed bcrypt hash of an arbitrary fixed string. Used only as a
// comparison target when no matching user is found, so bcrypt.compare
// still runs and takes roughly the same time as a real password check.
// Without this, "email not found" returns near-instantly while "wrong
// password" takes bcrypt's full comparison time, letting response
// timing reveal which emails are registered.
const DUMMY_HASH = '$2b$12$CwTycUXWue0Thq9StjUM0uJ8s4NwHXR9jVJvT7hpUFzXW8DQqiaZ2';

// Limits login/register attempts per IP — stops brute-force password
// guessing and account-creation spam without affecting normal use.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window per IP
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

router.post('/register', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!email || !password || password.length < 8 || password.length > 72) {
    return res.status(400).json({ error: 'Email and a password between 8 and 72 characters are required' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Something went wrong creating your account' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    // Always run bcrypt.compare, against a dummy hash if no user was
    // found, so this route takes the same amount of time either way.
    const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Something went wrong logging in' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({ success: true });
});

// Lets the frontend check "am I still logged in?" without triggering
// a 500 on some unrelated page — used by ProtectedRoute.
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Me error:', err.message);
    res.status(500).json({ error: 'Could not verify session' });
  }
});

module.exports = router;