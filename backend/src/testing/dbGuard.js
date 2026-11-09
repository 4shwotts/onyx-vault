// Refuses any database URL that could point at real data. Used by db.js
// whenever NODE_ENV=test and by the test suite's global set-up, so a test
// run can only ever reach a throwaway local Postgres (embedded-postgres on
// a developer machine, or the Postgres service container in CI).

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'postgres']);
const FORBIDDEN_FRAGMENTS = ['neon.tech', 'neon.build', 'render.com', 'amazonaws.com', 'supabase', 'vercel'];

function assertSafeTestDatabaseUrl(rawUrl) {
  if (!rawUrl) {
    throw new Error('Refusing to run tests: TEST_DATABASE_URL is not set.');
  }

  const lowered = String(rawUrl).toLowerCase();
  const forbidden = FORBIDDEN_FRAGMENTS.find((fragment) => lowered.includes(fragment));
  if (forbidden) {
    throw new Error(`Refusing to run tests against a hosted database (matched "${forbidden}").`);
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Refusing to run tests: TEST_DATABASE_URL is not a valid URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('Refusing to run tests: TEST_DATABASE_URL must be a postgres:// URL.');
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing to run tests: host "${url.hostname}" is not a local test database.`);
  }

  const sslmode = url.searchParams.get('sslmode');
  if (sslmode && sslmode !== 'disable') {
    throw new Error('Refusing to run tests: the test database must not use SSL (hosted databases do).');
  }

  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to run tests: database name "${dbName}" must end in "_test".`);
  }

  return url;
}

module.exports = { assertSafeTestDatabaseUrl };
