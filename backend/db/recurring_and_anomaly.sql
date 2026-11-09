-- 003_recurring_and_anomaly.sql
-- PROVISIONAL: reconstructed from the application code, because these
-- objects exist in the live database but were never added to the repo.
-- Used only to build the throwaway test database for now. It will be
-- reconciled against the live schema (read-only query) before it is
-- treated as a real migration. Do not run this against production.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_anomaly BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  amount         NUMERIC(12,2) NOT NULL,
  description    VARCHAR(255),
  frequency      VARCHAR(10) NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  next_run_date  DATE NOT NULL,
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next_run ON recurring_transactions(next_run_date);
