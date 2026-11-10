const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// Connection-string parameters that would override the explicit `ssl`
// setting below. node-postgres merges parameters parsed from the URL over
// the config object, so `sslmode=no-verify` in the URL would silently turn
// certificate checks off, and pg v9 will change `sslmode=require` to mean
// "encrypt but don't verify". Removing them keeps the decision here.
const SSL_URL_PARAMS = ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'];

function isLocalHost(hostname) {
  return LOCAL_HOSTS.has(hostname);
}

// Returns the node-postgres Pool config for the given environment.
// - test: only TEST_DATABASE_URL, checked by the guard, never SSL.
// - otherwise: DATABASE_URL. A local Postgres connects without SSL; any
//   other host (Neon in production) must present a valid certificate.
function buildPoolConfig(env = process.env) {
  if (env.NODE_ENV === 'test') {
    const { assertSafeTestDatabaseUrl } = require('./testing/dbGuard');
    assertSafeTestDatabaseUrl(env.TEST_DATABASE_URL);
    return { connectionString: env.TEST_DATABASE_URL, ssl: false, max: 5 };
  }

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Refusing to start.');
  }

  const url = new URL(env.DATABASE_URL);
  for (const param of SSL_URL_PARAMS) url.searchParams.delete(param);

  return {
    connectionString: url.toString(),
    ssl: isLocalHost(url.hostname) ? false : { rejectUnauthorized: true },
    max: 10,
    idleTimeoutMillis: 30000,
  };
}

module.exports = { buildPoolConfig };
