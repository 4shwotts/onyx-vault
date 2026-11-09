const { Pool } = require('pg');

// Under test, only ever connect to the throwaway local database named in
// TEST_DATABASE_URL, never DATABASE_URL (which on a developer machine
// points at the live database). The guard throws before a pool exists if
// the URL looks remotely like a hosted database.
function buildPoolConfig() {
  if (process.env.NODE_ENV === 'test') {
    const { assertSafeTestDatabaseUrl } = require('./testing/dbGuard');
    assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL);
    return {
      connectionString: process.env.TEST_DATABASE_URL,
      ssl: false,
      max: 5,
    };
  }

  return {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
  };
}

// Shared connection pool for the app; allows concurrent queries across
// requests instead of serialising through a single client.
const pool = new Pool(buildPoolConfig());

// Required: an unhandled error on an idle client otherwise crashes the
// process (e.g. dropped connection, network blip).
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
});

module.exports = pool;
