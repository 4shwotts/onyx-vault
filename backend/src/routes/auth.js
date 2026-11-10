const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, sendError } = require('../utils/http');
const { generateToken, hashToken } = require('../utils/tokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../email');
const { schemas, validate } = require('../validation/schemas');
const { SESSION_TTL_SECONDS, createSession, endSession, endAllSessions, verifySession } = require('../auth/sessions');
const { processDueRulesForUser } = require('../cron/processRecurring');
const { runInBackground } = require('../background');
const { isPublicSignupEnabled } = require('../config');
const { createDemoAccount, endDemo, isDemoEmail } = require('../demo/demoAccounts');

const router = express.Router();
const SALT_ROUNDS = 12;

// SameSite=Lax: the browser only talks to the API through its own origin
// (the Vercel /api proxy in production, the Vite /api proxy in
// development), so the cookie is always first-party and never needs to be
// sent on cross-site requests. Secure in production (HTTPS only).
function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
}

function setSessionCookie(res, token) {
  res.cookie('token', token, { ...cookieOptions(), maxAge: SESSION_TTL_SECONDS * 1000 });
}

function clearSessionCookie(res) {
  res.clearCookie('token', cookieOptions());
}

const VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour

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

// Bot protection for registration — no CAPTCHA, no third-party
// service, both checks are self-contained. honeypot is a field the
// frontend renders off-screen with no tab stop; a real person never
// sees or fills it, but many automated form-fillers populate every
// field they find. formRenderedAt is a timestamp the frontend records
// when the form appeared; MIN_SUBMIT_MS rejects submissions that
// arrive faster than a human could plausibly have typed an email and
// password. Both are checked before touching the database.
const DEFAULT_MIN_SUBMIT_MS = 1500;

// Test seam: under NODE_ENV=test only, BOT_MIN_SUBMIT_MS can shorten the
// wait so browser tests don't have to sit idle. Ignored everywhere else.
function minSubmitMs() {
  if (process.env.NODE_ENV === 'test' && process.env.BOT_MIN_SUBMIT_MS !== undefined) {
    const value = Number(process.env.BOT_MIN_SUBMIT_MS);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return DEFAULT_MIN_SUBMIT_MS;
}

// Deliberately identical to a real success response. If a bot got a
// distinguishable error here, it could learn to detect and route
// around the honeypot/timing checks — a real user will never trip
// either one, so they never see this path regardless.
const SIGN_UP_RESPONSE = {
  message: 'Account created. Please check your email to verify your account before logging in.',
};

function looksLikeBot(body) {
  const { honeypot, formRenderedAt } = body || {};
  if (honeypot) return true;
  if (!formRenderedAt || typeof formRenderedAt !== 'number') return true;
  const elapsed = Date.now() - formRenderedAt;
  return elapsed < minSubmitMs();
}

// Precomputed bcrypt hash of an arbitrary fixed string. Used only as a
// comparison target when no matching user is found, so bcrypt.compare
// still runs and takes roughly the same time as a real password check.
// Without this, "email not found" returns near instantly while "wrong
// password" takes bcrypt's full comparison time, letting response
// timing reveal which emails are registered.
const DUMMY_HASH = '$2b$12$CwTycUXWue0Thq9StjUM0uJ8s4NwHXR9jVJvT7hpUFzXW8DQqiaZ2';

function limiter(windowMs, max, message) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => sendError(res, 429, message),
  });
}

// Limits login attempts per IP: stops brute-force password guessing
// without affecting normal use.
const authLimiter = limiter(15 * 60 * 1000, 10, 'Too many attempts. Please try again in a few minutes.');
// Account creation is cheaper to attempt than login guessing, so it gets
// its own stricter cap.
const registerLimiter = limiter(60 * 60 * 1000, 5, 'Too many accounts created from this address. Please try again later.');
// Stop anyone mail-bombing an inbox with reset or verification links, or
// probing which emails exist.
const forgotPasswordLimiter = limiter(15 * 60 * 1000, 5, 'Too many requests. Please try again in a few minutes.');
const resendVerificationLimiter = limiter(15 * 60 * 1000, 5, 'Too many requests. Please try again in a few minutes.');
// Each demo is a whole account full of data, so one address can start only
// a handful an hour.
const demoLimiter = limiter(60 * 60 * 1000, 5, 'Too many demos started from this address. Please try again later.');

const SIGNUP_CLOSED = 'Sign-up is closed on the live site. Try the demo instead.';
const DEMO_NO_EMAIL = 'Demo accounts have no email address or password, so they can’t receive email or reset a password.';

// Refuses requests that would email a demo account or change its
// password. Demo addresses use the reserved .invalid domain, so this can
// be decided from the address alone.
function rejectDemoEmail(req, res, next) {
  if (isDemoEmail(req.body?.email)) return sendError(res, 403, DEMO_NO_EMAIL);
  return next();
}

async function isDemoUser(userId) {
  const { rows } = await pool.query('SELECT is_demo FROM users WHERE id = $1', [userId]);
  return Boolean(rows[0]?.is_demo);
}

router.post('/register', registerLimiter, asyncHandler(async (req, res) => {
  // With public sign-up switched off (the live site), no new real accounts
  // can be created at all; the demo is the way in.
  if (!isPublicSignupEnabled()) return sendError(res, 403, SIGNUP_CLOSED);

  // Checked next, before any validation or database work: a bot-like
  // submission gets the same response a real sign-up would.
  if (looksLikeBot(req.body)) {
    return res.status(201).json(SIGN_UP_RESPONSE);
  }

  const input = validate(schemas.register, req.body);
  if (!input.ok) return sendError(res, 400, input.error);
  const { email, password } = input.data;

  if (!ALLOWED_DOMAINS.includes(email.split('@')[1])) {
    return sendError(res, 400, 'Please use a verified email provider, such as Gmail');
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return sendError(res, 409, 'An account with that email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await pool.query(
    'INSERT INTO users (email, password_hash, email_verified) VALUES ($1, $2, FALSE) RETURNING id, email',
    [email, passwordHash]
  );
  const user = result.rows[0];

  const { token, tokenHash } = generateToken();
  await pool.query(
    'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, tokenHash, new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS)]
  );

  try {
    await sendVerificationEmail(user.email, token);
  } catch (emailErr) {
    console.error('Verification email failed to send:', emailErr.message);
  }

  res.status(201).json(SIGN_UP_RESPONSE);
}));

router.post('/verify-email', asyncHandler(async (req, res) => {
  const input = validate(schemas.verifyEmail, req.body);
  if (!input.ok) return sendError(res, 400, 'This verification link is invalid or has expired');

  const result = await pool.query(
    'SELECT user_id FROM email_verification_tokens WHERE token_hash = $1 AND expires_at > NOW()',
    [hashToken(input.data.token)]
  );
  if (result.rows.length === 0) {
    return sendError(res, 400, 'This verification link is invalid or has expired');
  }

  const { user_id: userId } = result.rows[0];
  await pool.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [userId]);
  await pool.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);

  res.json({ message: 'Email verified. You can now log in.' });
}));

router.post('/resend-verification', resendVerificationLimiter, rejectDemoEmail, asyncHandler(async (req, res) => {
  const input = validate(schemas.emailOnly, req.body);
  if (!input.ok) return sendError(res, 400, input.error);

  const genericResponse = {
    message: 'If an account with that email exists and is not yet verified, a new verification link has been sent.',
  };

  const result = await pool.query('SELECT id, email, email_verified FROM users WHERE email = $1', [input.data.email]);
  const user = result.rows[0];

  if (user && !user.email_verified) {
    await pool.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [user.id]);
    const { token, tokenHash } = generateToken();
    await pool.query(
      'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS)]
    );
    try {
      await sendVerificationEmail(user.email, token);
    } catch (emailErr) {
      console.error('Resend verification email failed to send:', emailErr.message);
    }
  }

  res.json(genericResponse);
}));

router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const input = validate(schemas.login, req.body);
  if (!input.ok) return sendError(res, 400, 'Email and password are required');
  const { email, password } = input.data;

  const result = await pool.query(
    'SELECT id, email, password_hash, email_verified, is_demo FROM users WHERE email = $1',
    [email]
  );
  // Demo accounts have no password and can't be signed into this way; they
  // get the same answer (and the same timing) as an unknown address.
  const user = result.rows[0]?.is_demo ? undefined : result.rows[0];
  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !valid) {
    return sendError(res, 401, 'Invalid email or password');
  }
  if (!user.email_verified) {
    return sendError(res, 403, 'Please verify your email before logging in');
  }

  setSessionCookie(res, await createSession(user.id));
  res.json({ user: { id: user.id, email: user.email } });

  // Recurring payments that fell due while the server was asleep are
  // posted after the response has gone, so login never waits for them.
  runInBackground('Catching up recurring payments after login', () => processDueRulesForUser(user.id));
}));

// Starts a fresh demo: a throwaway account full of made-up data, signed in
// straight away, with no email or password. Also reachable from /demo.
router.post('/demo', demoLimiter, asyncHandler(async (req, res) => {
  const result = await createDemoAccount();
  if (result.busy) {
    res.set('Retry-After', '300');
    return sendError(res, 503, 'The demo is busy right now. Please try again in a few minutes.');
  }
  setSessionCookie(res, result.sessionToken);
  res.status(201).json({
    user: { id: result.user.id, isDemo: true, demoExpiresAt: result.user.demo_expires_at },
  });
}));

// Ends this browser's session (other devices stay signed in). Works, and
// clears the cookie, even if the session had already ended. For a demo,
// logging out ("End demo") deletes the demo account and all its data
// straight away.
router.post('/logout', asyncHandler(async (req, res) => {
  const session = await verifySession(req.cookies?.token);
  if (session) {
    const deleted = await endDemo(session.userId);
    if (!deleted) await endSession(session.sessionId);
  }
  clearSessionCookie(res);
  res.json({ success: true });
}));

router.post('/forgot-password', forgotPasswordLimiter, rejectDemoEmail, asyncHandler(async (req, res) => {
  const input = validate(schemas.emailOnly, req.body);
  if (!input.ok) return sendError(res, 400, input.error);

  const genericResponse = {
    message: 'If an account with that email exists, a password reset link has been sent.',
  };

  const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [input.data.email]);
  const user = result.rows[0];

  if (user) {
    const { token, tokenHash } = generateToken();
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, new Date(Date.now() + RESET_TOKEN_TTL_MS)]
    );
    try {
      await sendPasswordResetEmail(user.email, token);
    } catch (emailErr) {
      console.error('Password reset email failed to send:', emailErr.message);
    }
  }

  res.json(genericResponse);
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
  const input = validate(schemas.resetPassword, req.body);
  if (!input.ok) {
    return sendError(res, 400, 'A valid reset link and a password between 8 and 72 characters are required');
  }
  const { token, password } = input.data;

  const result = await pool.query(
    'SELECT user_id FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL',
    [hashToken(token)]
  );
  if (result.rows.length === 0) {
    return sendError(res, 400, 'This reset link is invalid or has expired');
  }

  const { user_id: userId } = result.rows[0];
  if (await isDemoUser(userId)) return sendError(res, 403, DEMO_NO_EMAIL);
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // New password, used-up token and every existing session ended, all or
  // nothing: whoever had the old password is signed out everywhere.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    await endAllSessions(userId, client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json({ message: 'Password updated. You can now log in with your new password.' });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT id, email, is_demo, demo_expires_at FROM users WHERE id = $1', [req.userId]);
  if (result.rows.length === 0) return sendError(res, 401, 'Not signed in, or your session has ended');
  const { id, email, is_demo: isDemo, demo_expires_at: demoExpiresAt } = result.rows[0];
  // A demo's made-up .invalid address isn't shown anywhere.
  res.json({ user: isDemo ? { id, email: null, isDemo, demoExpiresAt } : { id, email, isDemo } });
}));

router.delete('/account', requireAuth, asyncHandler(async (req, res) => {
  if (await isDemoUser(req.userId)) {
    return sendError(res, 403, 'A demo has no password. Use “End demo” to delete it and all its data.');
  }
  const input = validate(schemas.deleteAccount, req.body);
  if (!input.ok) return sendError(res, 400, 'Password confirmation is required to delete your account');

  const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
  const user = result.rows[0];
  if (!user) return sendError(res, 401, 'Not signed in, or your session has ended');

  const valid = await bcrypt.compare(input.data.password, user.password_hash);
  if (!valid) return sendError(res, 401, 'Incorrect password');

  // ON DELETE CASCADE removes accounts (and through them transactions),
  // categories, recurring rules, tokens and sessions.
  await pool.query('DELETE FROM users WHERE id = $1', [req.userId]);

  clearSessionCookie(res);
  res.json({ message: 'Account deleted' });
}));

module.exports = router;
