const express = require('express');
const { testOutbox } = require('../email');

// Routes that exist ONLY when NODE_ENV=test (see app.js), for the browser
// tests: they let a Playwright test read the verification or reset link
// that would have been emailed. Under test, email never leaves the
// process, and the database is the guarded local test database.
function createTestRouter() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Test routes can only be created when NODE_ENV=test.');
  }
  const router = express.Router();

  router.get('/outbox', (req, res) => {
    const to = String(req.query.to || '').toLowerCase();
    const mail = [...testOutbox].reverse().find((m) => m.to === to);
    if (!mail) return res.status(404).json({ error: 'No email for that address' });
    res.json({ to: mail.to, subject: mail.subject, link: mail.link });
  });

  return router;
}

module.exports = { createTestRouter };
