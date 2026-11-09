require('dotenv').config();
const cron = require('node-cron');

const { createApp } = require('./app');
const { processRecurringTransactions } = require('./cron/processRecurring');

const app = createApp();

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
