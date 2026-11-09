const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const accountsRoutes = require('./routes/accounts');
const categoriesRoutes = require('./routes/categories');
const transactionsRoutes = require('./routes/transactions');
const recurringRoutes = require('./routes/recurring');

// Builds the Express app without starting a server, scheduling cron jobs
// or touching anything outside the request cycle. index.js calls listen()
// on the result in production; the test suite drives it with Supertest.
function createApp() {
  const app = express();

  // Required behind Render's reverse proxy — without this, Express can't
  // determine the real client IP (from X-Forwarded-For) or whether the
  // original request was HTTPS. That affects express-rate-limit (which
  // would otherwise bucket every user behind the proxy under one IP) and
  // secure-cookie/HTTPS detection. A hop count of 1 means only the
  // right-most X-Forwarded-For entry (the one Render appends) is trusted,
  // so a client can't spoof its IP by sending its own header.
  app.set('trust proxy', 1);

  app.use(helmet());

  // Vite picks the next free port (5173, 5174, ...) whenever more than one
  // dev server is running, so a single hard-coded CLIENT_ORIGIN breaks CORS
  // as soon as that happens. In development, trust any localhost/127.0.0.1
  // origin regardless of port; in production, stay locked to CLIENT_ORIGIN.
  const isDev = process.env.NODE_ENV !== 'production';
  const localOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isDev && localOriginPattern.test(origin)) return callback(null, true);
      if (origin === process.env.CLIENT_ORIGIN) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/auth', authRoutes);
  app.use('/accounts', accountsRoutes);
  app.use('/categories', categoriesRoutes);
  app.use('/transactions', transactionsRoutes);
  app.use('/recurring', recurringRoutes);

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
