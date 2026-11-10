-- 006_demo_accounts.sql
-- Throwaway demo accounts ("Try the demo"), and database rules that make it
-- impossible for the demo clean-up to ever match a real account.
--
-- A demo account:  is_demo = TRUE, an address ending
--                  @demo.onyx-vault.invalid, and an expiry time.
-- A real account:  is_demo = FALSE, an address that does NOT end in
--                  .invalid, and no expiry time.
-- The CHECK constraint enforces exactly one of those two shapes, and the
-- trigger stops any row ever switching between them. The clean-up deletes
-- only rows with is_demo = TRUE, an expiry in the past and a demo address,
-- so it cannot reach a real account even by mistake.
--
-- Safe to run more than once, and safe for the code that is live today:
-- the new columns have defaults that every existing (real) account
-- already satisfies, and the old code never reads them. The whole file is
-- one transaction: if any existing row didn't fit the rule, nothing would
-- change. (Check first with the read-only query in the hand-over notes.)

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_demo_shape_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_demo_shape_check CHECK (
      (is_demo AND email LIKE '%@demo.onyx-vault.invalid' AND demo_expires_at IS NOT NULL)
      OR
      (NOT is_demo AND email NOT LIKE '%.invalid' AND demo_expires_at IS NULL)
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION users_keep_demo_flag() RETURNS trigger AS $$
BEGIN
  IF NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
    RAISE EXCEPTION 'An account cannot be switched between real and demo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_keep_demo_flag ON users;
CREATE TRIGGER users_keep_demo_flag
  BEFORE UPDATE OF is_demo ON users
  FOR EACH ROW EXECUTE FUNCTION users_keep_demo_flag();

CREATE INDEX IF NOT EXISTS idx_users_demo_expiry ON users (demo_expires_at) WHERE is_demo;

COMMIT;
