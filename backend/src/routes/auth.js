const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { generateToken, hashToken } = require('../utils/tokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../email');

const router = express.Router();
const SALT_ROUNDS = 12;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 1000 * 60 * 60 * 24, // 24 hours
};

const VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour

// Mirrors the frontend's Login.jsx checks exactly. Client-side
// validation is a UX nicety, not enforcement — a direct API call
// bypasses the browser entirely, so this needs to exist here too, not
// just there.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'live.co.uk', 'msn.com',
  'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com',
  'protonmail.com', 'proton.me', 'pm.me',
  'zoho.com', 'zohomail.com',
  'gmx.com', 'gmx.us',
  'mail.com',
  'yandex.com', 'yandex.ru',
  'fastmail.com', 'fastmail.fm',
  'tutanota.com', 'tuta.io',
];

function getEmailError(email) {
  if (!EMAIL_SHAPE.test(email)) {
    return 'That doesn\'t look like a valid email address';
  }
  const domain = email.split('@')[1];
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return 'Please use a verified email provider, such as Gmail';
  }
  return null;
}

// Precomputed bcrypt hash of an arbitrary fixed string. Used only as a
// comparison target when no matching user is found, so bcrypt.compare
// still runs and takes roughly the same time as a real password check.
// Without this, "email not found" returns near instantly while "wrong
// password" takes bcrypt's full comparison time, letting response
// timing reveal which emails are registered.
const DUMMY_HASH = '$2b$12$CwTycUXWue0Thq9StjUM0uJ8s4NwHXR9jVJvT7hpUFzXW8DQqiaZ2';

// Limits login attempts per IP, stops brute force password guessing
// without affecting normal use.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter than authLimiter, account creation and spam bots are cheaper
// to attempt than login guessing, so this route gets its own stricter cap.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many accounts created from this address. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Prevents an attacker from mail bombing a victim's inbox with reset
// links, or using response timing/behavior to probe which emails exist.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Same reasoning as forgotPasswordLimiter — stops someone hammering
// this endpoint to spam a victim's inbox or probe which emails exist.
const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

router.post('/register', registerLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!email || !password || password.length < 8 || password.length > 72) {
    return res.status(400).json({ error: 'Email and a password between 8 and 72 characters are required' });
  }

  const emailError = getEmailError(email);
  if (emailError) {
    return res.status(400).json({ error: emailError });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      'INSERT INTO users (email, password_hash, email_verified) VALUES ($1, $2, FALSE) RETURNING id, email',
      [email, passwordHash]
    );
    const user = result.rows[0];

    const { token, tokenHash } = generateToken();
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
    await pool.query(
      'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    try {
      await sendVerificationEmail(user.email, token);
    } catch (emailErr) {
      console.error('Verification email failed to send:', emailErr.message);
      // The account still exists, do not fail the request, the user can
      // use the resend-verification endpoint if this becomes a real problem.
    }

    // No cookie is set here, accounts are inactive until the email link
    // is clicked, so login is not possible yet regardless.
    res.status(201).json({
      message: 'Account created. Please check your email to verify your account before logging in.',
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Something went wrong creating your account' });
  }
});

router.post('/verify-email', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  try {
    const tokenHash = hashToken(token);
    const result = await pool.query(
      'SELECT user_id FROM email_verification_tokens WHERE token_hash = $1 AND expires_at > NOW()',
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'This verification link is invalid or has expired' });
    }

    const { user_id: userId } = result.rows[0];

    await pool.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [userId]);
    // Clean up all outstanding verification tokens for this user, not
    // just the one used, so an older copied link cannot be reused.
    await pool.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);

    res.json({ message: 'Email verified. You can now log in.' });
  } catch (err) {
    console.error('Verify email error:', err.message);
    res.status(500).json({ error: 'Something went wrong verifying your email' });
  }
});

router.post('/resend-verification', resendVerificationLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const genericResponse = {
    message: 'If an account with that email exists and is not yet verified, a new verification link has been sent.',
  };

  try {
    const result = await pool.query('SELECT id, email, email_verified FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (user && !user.email_verified) {
      await pool.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [user.id]);

      const { token, tokenHash } = generateToken();
      const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
      await pool.query(
        'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, tokenHash, expiresAt]
      );

      try {
        await sendVerificationEmail(user.email, token);
      } catch (emailErr) {
        console.error('Resend verification email failed to send:', emailErr.message);
      }
    }

    res.json(genericResponse);
  } catch (err) {
    console.error('Resend verification error:', err.message);
    res.json(genericResponse);
  }
});

router.post('/login', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, email_verified FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email before logging in' });
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

router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const genericResponse = {
    message: 'If an account with that email exists, a password reset link has been sent.',
  };

  try {
    const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (user) {
      const { token, tokenHash } = generateToken();
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, tokenHash, expiresAt]
      );

      try {
        await sendPasswordResetEmail(user.email, token);
      } catch (emailErr) {
        console.error('Password reset email failed to send:', emailErr.message);
      }
    }

    res.json(genericResponse);
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.json(genericResponse);
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password || password.length < 8 || password.length > 72) {
    return res.status(400).json({ error: 'A valid token and a password between 8 and 72 characters are required' });
  }

  try {
    const tokenHash = hashToken(token);
    const result = await pool.query(
      'SELECT user_id FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL',
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired' });
    }

    const { user_id: userId } = result.rows[0];
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);

    res.json({ message: 'Password updated. You can now log in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ error: 'Something went wrong resetting your password' });
  }
});

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

router.delete('/account', requireAuth, async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password confirmation is required to delete your account' });
  }

  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [req.userId]);

    res.clearCookie('token', COOKIE_OPTIONS);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('Delete account error:', err.message);
    res.status(500).json({ error: 'Something went wrong deleting your account' });
  }
});

module.exports = router;