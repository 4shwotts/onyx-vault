// Starts a throwaway Postgres for the whole test run and loads the schema.
//
// - On a developer machine: embedded-postgres, in a fresh temporary folder,
//   on a free port, deleted again afterwards. No install needed.
// - In CI: TEST_DATABASE_URL points at the Postgres service container.
//
// Either way the URL goes through the same guard db.js uses, so a hosted
// database (Neon, etc.) is refused before any connection is made. The real
// DATABASE_URL and backend/.env are never read.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { assertSafeTestDatabaseUrl } = require('../src/testing/dbGuard.js');
const { Client } = require('pg');

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_FILES = [
  '../db/schema.sql',
  '../db/auth_hardening.sql',
  '../db/recurring_and_anomaly.sql',
].map((f) => path.resolve(here, f));

const DB_NAME = 'onyx_vault_test';

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function applySchema(url) {
  const client = new Client({ connectionString: url, ssl: false });
  await client.connect();
  try {
    for (const file of SCHEMA_FILES) {
      await client.query(fs.readFileSync(file, 'utf8'));
    }
  } finally {
    await client.end();
  }
}

export default async function setup({ provide }) {
  delete process.env.DATABASE_URL;

  let embedded = null;
  let dataDir = null;
  let url = process.env.TEST_DATABASE_URL;

  if (!url) {
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    const port = await freePort();
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onyx-vault-pg-'));
    embedded = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: 'postgres',
      password: 'postgres',
      port,
      persistent: false,
      onLog: () => {},
    });
    await embedded.initialise();
    await embedded.start();
    await embedded.createDatabase(DB_NAME);
    url = `postgres://postgres:postgres@127.0.0.1:${port}/${DB_NAME}`;
  }

  assertSafeTestDatabaseUrl(url);
  await applySchema(url);
  provide('testDatabaseUrl', url);

  return async function teardown() {
    if (embedded) {
      await embedded.stop();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  };
}
