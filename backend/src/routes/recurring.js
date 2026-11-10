const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, parseId, sendError, notFound } = require('../utils/http');
const { withUserLock } = require('../utils/locks');
const { penceToDecimal } = require('../utils/money');
const { schemas, validate } = require('../validation/schemas');
const { catchUpRule, processDueRulesForUser, todayUtc } = require('../cron/processRecurring');

const router = express.Router();
router.use(requireAuth);

const MAX_RECURRING_RULES_PER_USER = 15;

const RULE_COLUMNS = `r.id, r.account_id, r.category_id, r.amount, r.description, r.frequency,
  r.next_run_date, r.start_date, r.day_of_month, c.name AS category_name, a.name AS account_name`;

const runNowLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => sendError(res, 429, 'Too many requests. Please wait a minute and try again.'),
});

async function findRule(id, userId) {
  const { rows } = await pool.query(
    `SELECT ${RULE_COLUMNS}
     FROM recurring_transactions r
     JOIN accounts a ON a.id = r.account_id
     LEFT JOIN categories c ON c.id = r.category_id
     WHERE r.id = $1 AND r.user_id = $2`,
    [id, userId]
  );
  return rows[0] || null;
}

router.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT ${RULE_COLUMNS}
     FROM recurring_transactions r
     JOIN accounts a ON a.id = r.account_id
     LEFT JOIN categories c ON c.id = r.category_id
     WHERE r.user_id = $1
     ORDER BY r.next_run_date ASC, r.id ASC`,
    [req.userId]
  );
  res.json(result.rows);
}));

// Manually posts the CALLING USER'S due rules only (never anyone else's),
// catching up any missed payments. Defined before /:id so "run-now" is
// never read as an id.
router.post('/run-now', runNowLimiter, asyncHandler(async (req, res) => {
  const processed = await processDueRulesForUser(req.userId);
  res.json({ processed });
}));

router.post('/', asyncHandler(async (req, res) => {
  const input = validate(schemas.createRecurring, req.body);
  if (!input.ok) return sendError(res, 400, input.error);
  const { account_id: accountId, category_id: categoryId = null, amount, description = null, frequency, start_date: startDate } = input.data;

  const outcome = await withUserLock(req.userId, async (client) => {
    const owns = await client.query('SELECT id FROM accounts WHERE id = $1 AND user_id = $2', [accountId, req.userId]);
    if (owns.rows.length === 0) return { status: 404, error: 'Account not found' };
    if (categoryId) {
      const ownsCategory = await client.query('SELECT id FROM categories WHERE id = $1 AND user_id = $2', [categoryId, req.userId]);
      if (ownsCategory.rows.length === 0) return { status: 404, error: 'Category not found' };
    }

    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM recurring_transactions WHERE user_id = $1', [req.userId]);
    if (rows[0].n >= MAX_RECURRING_RULES_PER_USER) {
      return { status: 403, error: `You've reached the limit of ${MAX_RECURRING_RULES_PER_USER} recurring rules` };
    }

    // start_date and day_of_month are kept so a monthly rule always returns
    // to its own day (the 31st stays the 31st after a short month).
    const inserted = await client.query(
      `INSERT INTO recurring_transactions
         (user_id, account_id, category_id, amount, description, frequency, next_run_date, start_date, day_of_month)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date, $7::date, EXTRACT(DAY FROM $7::date)::smallint)
       RETURNING *`,
      [req.userId, accountId, categoryId, penceToDecimal(amount), description, frequency, startDate]
    );
    return { rule: inserted.rows[0] };
  });

  if (outcome.error) return sendError(res, outcome.status, outcome.error);

  // A start date that has already arrived posts what is due straight away
  // (each payment dated on its due day, at most 12 in one go).
  let paymentsPosted = 0;
  try {
    paymentsPosted = await catchUpRule(outcome.rule, await todayUtc());
  } catch (err) {
    console.error('Immediate recurring processing error for rule', outcome.rule.id, ':', err.message);
  }

  const rule = await findRule(outcome.rule.id, req.userId);
  res.status(201).json({ ...rule, first_transaction_created: paymentsPosted > 0, payments_posted: paymentsPosted });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res, 'Recurring rule not found');
  const rule = await findRule(id, req.userId);
  if (!rule) return notFound(res, 'Recurring rule not found');
  res.json(rule);
}));

// Amount, description and category only. The schedule can't be edited, so
// a payment can never be skipped or repeated by moving the next run date.
router.put('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res, 'Recurring rule not found');
  const input = validate(schemas.updateRecurring, req.body);
  if (!input.ok) return sendError(res, 400, input.error);
  const changes = input.data;

  if (!(await findRule(id, req.userId))) return notFound(res, 'Recurring rule not found');
  if (changes.category_id) {
    const { rows } = await pool.query('SELECT id FROM categories WHERE id = $1 AND user_id = $2', [changes.category_id, req.userId]);
    if (rows.length === 0) return notFound(res, 'Category not found');
  }

  const sets = [];
  const values = [];
  if (changes.amount !== undefined) { values.push(penceToDecimal(changes.amount)); sets.push(`amount = $${values.length}`); }
  if ('description' in changes) { values.push(changes.description); sets.push(`description = $${values.length}`); }
  if ('category_id' in changes) { values.push(changes.category_id); sets.push(`category_id = $${values.length}`); }
  values.push(id, req.userId);
  await pool.query(
    `UPDATE recurring_transactions SET ${sets.join(', ')} WHERE id = $${values.length - 1} AND user_id = $${values.length}`,
    values
  );

  res.json(await findRule(id, req.userId));
}));

// Payments the rule has already posted are kept.
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res, 'Recurring rule not found');
  const result = await pool.query(
    'DELETE FROM recurring_transactions WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, req.userId]
  );
  if (result.rows.length === 0) return notFound(res, 'Recurring rule not found');
  res.json({ success: true });
}));

module.exports = router;
