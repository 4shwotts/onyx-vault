-- 003_recurring_and_anomaly.sql
-- Recurring rules and the anomaly flag. These already existed in the live
-- database but had never been added to the repo, so a database built from
-- the repo could not run the app (see BUGS.md). Matches the live definitions
-- exactly (checked with a read-only schema query), so applying this file
-- to the live database is a no-op.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_anomaly BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  amount         NUMERIC(12,2) NOT NULL,
  description    VARCHAR(255),
  frequency      VARCHAR(20) NOT NULL,
  next_run_date  DATE NOT NULL,
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_next_run ON recurring_transactions(next_run_date);
