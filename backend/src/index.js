require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const cron = require('node-cron');

const authRoutes = require('./routes/auth');
const accountsRoutes = require('./routes/accounts');
const categoriesRoutes = require('./routes/categories');
const transactionsRoutes = require('./routes/transactions');
const recurringRoutes = require('./routes/recurring');
const { processRecurringTransactions } = require('./cron/processRecurring');

const app = express();

// Required behind Railway/Render's reverse proxy — without this, Express
// can't correctly determine the real client IP (from X-Forwarded-For) or
// whether the original request was HTTPS. That affects express-rate-limit
// (would otherwise bucket all users behind the proxy under one IP) and
// secure-cookie/HTTPS detection.
app.set('trust proxy', 1);

app.use(helmet());

// Vite picks the next free port (5173, 5174, ...) whenever more than one
// dev server is running, so a single hardcoded CLIENT_ORIGIN breaks CORS
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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Onyx Vault API running on port ${PORT}`);
});

// Runs once a day at 1am UTC — checks every user's recurring rules and
// creates real transactions for anything due. Timezone is pinned explicitly
// so "1am" means the same moment regardless of the host machine's local
// system timezone, matching the UTC-based due-date logic in processRecurring.js.
cron.schedule('0 1 * * *', async () => {
  console.log('Running scheduled recurring transaction check...');
  const count = await processRecurringTransactions();
  console.log(`Processed ${count} recurring transaction(s).`);
}, { timezone: 'UTC' });