const pool = require('../db');

// Runs `fn(client)` inside a database transaction that holds a row lock on
// the user (SELECT ... FOR UPDATE). Anything else that takes the same lock
// for the same user waits until this transaction commits or rolls back.
//
// Used for the per-user caps: "count, then insert if under the cap" is
// only safe if no other request for that user can count in between. The
// lock is only ever taken inside BEGIN ... COMMIT, so it is held for the
// whole check-and-insert and released by COMMIT or ROLLBACK.
async function withUserLock(userId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { withUserLock };
