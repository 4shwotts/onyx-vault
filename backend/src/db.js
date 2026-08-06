const { Pool } = require('pg');

// Shared connection pool for the app; allows concurrent queries across
// requests instead of serializing through a single client.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

// Required: an unhandled error on an idle client otherwise crashes the
// process (e.g. dropped connection, network blip).
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
});

module.exports = pool;