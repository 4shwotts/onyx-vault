require('dotenv').config();
const cron = require('node-cron');

const { createApp } = require('./app');
const { processRecurringTransactions } = require('./cron/processRecurring');
const { deleteExpiredSessions } = require('./auth/sessions');
const { runInBackground } = require('./background');
const { cleanupExpiredDemos } = require('./demo/demoAccounts');

const app = createApp();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Onyx Vault API running on port ${PORT}`);
});

// Housekeeping that must not depend on the server being awake at a fixed
// time: the free hosting plan puts the server to sleep when idle, so a
// single nightly job could simply never run. Instead it runs as soon as
// the server starts (i.e. wakes) and then every hour while it is awake.
// Both jobs are safe to overlap or repeat: recurring payments are claimed
// atomically, and deleting expired sessions is idempotent.
function housekeeping(reason) {
  runInBackground(`Recurring payments (${reason})`, async () => {
    const count = await processRecurringTransactions();
    console.log(`Recurring payments (${reason}): posted ${count}.`);
  });
  runInBackground(`Expired sessions (${reason})`, async () => {
    const count = await deleteExpiredSessions();
    console.log(`Expired sessions (${reason}): removed ${count}.`);
  });
  // Demos last 24 hours. (Ending a demo deletes it at once, and starting a
  // new demo also clears out expired ones.)
  runInBackground(`Expired demos (${reason})`, async () => {
    const count = await cleanupExpiredDemos();
    console.log(`Expired demos (${reason}): removed ${count}.`);
  });
}

housekeeping('server start');
cron.schedule('0 * * * *', () => housekeeping('hourly'), { timezone: 'UTC' });
