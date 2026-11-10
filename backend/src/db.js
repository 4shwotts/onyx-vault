const { Pool, types } = require('pg');
const { buildPoolConfig } = require('./dbConfig');

// DATE columns (type OID 1082) come back as their 'YYYY-MM-DD' text.
// node-postgres would otherwise build a JavaScript Date at *local*
// midnight, which shifts the day whenever the server clock isn't UTC
// (a UK machine in summer, for instance), and the shifted day then
// flowed into recurring-rule scheduling and API responses.
const DATE_OID = 1082;
types.setTypeParser(DATE_OID, (value) => value);

// Shared connection pool for the app; allows concurrent queries across
// requests instead of serialising through a single client. Under test,
// buildPoolConfig only ever returns the guarded local test database.
const pool = new Pool(buildPoolConfig());

// Required: an unhandled error on an idle client otherwise crashes the
// process (e.g. dropped connection, network blip).
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
});

module.exports = pool;
