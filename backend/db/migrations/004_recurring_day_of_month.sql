-- 004_recurring_day_of_month.sql
-- Fixes monthly recurring rules drifting to the 28th (see BUGS.md).
--
-- Adds start_date and day_of_month so a monthly rule always returns to its
-- own day of the month, backfills both for existing rules, and moves any
-- rule that has already drifted back to its proper day for its next run.
--
-- Safe to run more than once: columns use IF NOT EXISTS, every UPDATE
-- only touches rows that still need it, and the constraint is added only
-- if missing.
--
-- Safe for the code that is live today: both new columns are nullable
-- with no default the old code would trip over, and the old code never
-- reads or writes them. Rules the old code creates after this has run get
-- NULLs, and the new code falls back to the next run date's day for them.

BEGIN;

ALTER TABLE recurring_transactions ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE recurring_transactions ADD COLUMN IF NOT EXISTS day_of_month SMALLINT;

-- The original start date was never stored, but a rule's first payment is
-- always posted on its start date, so the earliest recurring transaction
-- that matches the rule (same account, amount and description, posted
-- after the rule was created) recovers it — including for rules that have
-- since drifted. A rule that has never posted hasn't drifted, so its next
-- run date is its start date.
UPDATE recurring_transactions r
SET start_date = COALESCE(
  (
    SELECT MIN(t.date)
    FROM transactions t
    WHERE t.is_recurring
      AND t.account_id = r.account_id
      AND t.amount = r.amount
      AND t.description IS NOT DISTINCT FROM r.description
      AND t.created_at >= r.created_at - INTERVAL '1 minute'
  ),
  r.next_run_date
)
WHERE r.start_date IS NULL;

UPDATE recurring_transactions
SET day_of_month = EXTRACT(DAY FROM start_date)::smallint
WHERE day_of_month IS NULL AND start_date IS NOT NULL;

-- Move a drifted monthly rule's pending run forward to its own day in the
-- same month (e.g. 28 Nov -> 30 Nov for a rule on the 31st). Only ever
-- moves later within the month the payment is still due in, so nothing is
-- skipped or posted twice.
UPDATE recurring_transactions
SET next_run_date = make_date(
  EXTRACT(YEAR FROM next_run_date)::int,
  EXTRACT(MONTH FROM next_run_date)::int,
  LEAST(day_of_month, EXTRACT(DAY FROM (date_trunc('month', next_run_date) + INTERVAL '1 month - 1 day'))::int)
)
WHERE frequency = 'monthly'
  AND day_of_month IS NOT NULL
  AND EXTRACT(DAY FROM next_run_date) < LEAST(
    day_of_month,
    EXTRACT(DAY FROM (date_trunc('month', next_run_date) + INTERVAL '1 month - 1 day'))::int
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recurring_transactions_day_of_month_check'
  ) THEN
    ALTER TABLE recurring_transactions
      ADD CONSTRAINT recurring_transactions_day_of_month_check
      CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31);
  END IF;
END $$;

COMMIT;
