const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const accountsRoutes = require('./routes/accounts');
const categoriesRoutes = require('./routes/categories');
const transactionsRoutes = require('./routes/transactions');
const recurringRoutes = require('./routes/recurring');
const rateLimit = require('express-rate-limit');
const pool = require('./db');
const { getAllowedOrigins, isPublicSignupEnabled } = require('./config');
const { rejectCrossSiteWrites } = require('./middleware/origin');
const { sendError, asyncHandler } = require('./utils/http');

// The sign-in page pings /wake each time it loads; this is generous for a
// person and stops anyone using it to hammer the database.
const wakeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => sendError(res, 429, 'Too many requests. Please wait a minute and try again.'),
});

const BODY_LIMIT = '100kb';

// Full details go to the server log (never to the client). Under test, a
// one-line summary is enough: some tests break the database on purpose to
// prove the client only ever sees a generic message.
function logUnexpectedError(err) {
  if (process.env.NODE_ENV === 'test') {
    console.error(`[expected in some tests] ${err.code || ''} ${err.message}`);
  } else {
    console.error(err);
  }
}

// Builds the Express app without starting a server, scheduling jobs or
// touching anything outside the request cycle. index.js calls listen() on
// the result in production; the test suite drives it with Supertest.
//
// Every error response, from any layer, has the same shape:
//   { "error": "A short, human-readable message" }
function createApp({ allowedOrigins = getAllowedOrigins() } = {}) {
  const app = express();

  // Behind Render's reverse proxy. A hop count of 1 means only the
  // right-most X-Forwarded-For entry (the one Render appends) is trusted,
  // so a client can't spoof its IP to dodge rate limits.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());

  // CORS only decides whether a page on another origin may *read* our
  // responses. Unknown origins simply get no CORS headers (rather than an
  // error, which used to surface as a 500); cross-site *writes* are refused
  // separately below.
  const allowed = new Set(allowedOrigins);
  app.use(cors({
    origin: (origin, callback) => callback(null, !origin || allowed.has(origin)),
    credentials: true,
  }));
  app.use(rejectCrossSiteWrites(allowedOrigins));

  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(cookieParser());

  // Health check for the host: answers without touching the database, so
  // it stays cheap and works even if the database is unavailable.
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Public settings the frontend needs before anyone signs in. No database.
  app.get('/config', (req, res) => {
    res.json({ publicSignupEnabled: isPublicSignupEnabled() });
  });

  // Called by the sign-in page as it loads. The free hosting plan puts the
  // server (and the database) to sleep when idle; one trivial query wakes
  // both, so the visitor's sign-in isn't the request that waits.
  app.get('/wake', wakeLimiter, asyncHandler(async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'awake' });
  }));

  app.use('/auth', authRoutes);
  app.use('/accounts', accountsRoutes);
  app.use('/categories', categoriesRoutes);
  app.use('/transactions', transactionsRoutes);
  app.use('/recurring', recurringRoutes);

  // Test-only helpers for the browser tests. Never mounted outside
  // NODE_ENV=test (and db.js refuses anything but a local test database
  // under NODE_ENV=test).
  if (process.env.NODE_ENV === 'test') {
    const { createTestRouter } = require('./testing/testRoutes');
    app.use('/__test__', createTestRouter());
  }

  app.use((req, res) => sendError(res, 404, 'Not found'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // Errors raised by the JSON body parser are the client's fault.
    if (err.type === 'entity.parse.failed') return sendError(res, 400, 'Request body is not valid JSON');
    if (err.type === 'entity.too.large') return sendError(res, 413, 'Request body is too large');
    if (err.status >= 400 && err.status < 500 && err.expose) return sendError(res, err.status, 'Bad request');

    logUnexpectedError(err);
    return sendError(res, 500, 'Internal server error');
  });

  return app;
}

module.exports = { createApp };
