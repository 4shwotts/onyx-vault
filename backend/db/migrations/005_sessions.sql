-- 005_sessions.sql
-- Server-side sessions, so logging out, resetting a password or deleting
-- an account really ends a session (see BUGS.md). Each login creates one
-- row; the session cookie's JWT carries the session id, and only a SHA-256
-- hash of that id is stored here.
--
-- Safe to run more than once (IF NOT EXISTS) and safe for the code that is
-- live today: it only adds a new table, which the old code never touches.

CREATE TABLE IF NOT EXISTS sessions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) NOT NULL UNIQUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
