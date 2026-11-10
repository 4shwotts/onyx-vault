// Starts a throwaway Postgres and loads the schema. Shared by the API test
// suite (test/globalSetup.mjs) and the browser-test server
// (scripts/e2e-server.mjs).
//
// - On a developer machine: embedded-postgres in a temporary folder, on a
//   free port, deleted again by stop().
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
const { assertSafeTestDatabaseUrl } = require('../../src/testing/dbGuard.js');
const { Client } = require('pg');

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(here, '../../db/migrations');

// Match the live database's date parsing (confirmed on Neon: 'ISO, MDY').
// initdb picks DateStyle from the machine's locale (a UK Windows machine
// gets 'ISO, DMY'), so without this local and live behaviour could differ.
export const LIVE_DATESTYLE = 'ISO, MDY';

function migrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort()
    .map((f) => path.join(MIGRATIONS_DIR, f));
}

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
    const dbName = new URL(url).pathname.slice(1);
    await client.query(`ALTER DATABASE "${dbName}" SET DateStyle TO '${LIVE_DATESTYLE}'`);
    const files = migrationFiles();
    for (const file of files) await client.query(fs.readFileSync(file, 'utf8'));
    // Every migration is meant to be safe to paste into the live database
    // more than once; prove it by applying the whole set twice.
    for (const file of files) await client.query(fs.readFileSync(file, 'utf8'));
  } finally {
    await client.end();
  }
}

// On Windows a test server can be stopped abruptly (no chance to run its
// clean-up), leaving its Postgres running and holding the data folder.
// Postgres records its own process id in postmaster.pid inside that
// folder; stop exactly that process (ours) before reusing the folder.
async function stopLeftoverPostgres(dir) {
  const pidFile = path.join(dir, 'postmaster.pid');
  if (!fs.existsSync(pidFile)) return;
  // (On Windows the recorded id can carry a leading minus sign.)
  const pid = Math.abs(Number(fs.readFileSync(pidFile, 'utf8').split(/\r?\n/)[0]));
  if (!Number.isInteger(pid) || pid <= 0) return;
  try {
    process.kill(pid);
  } catch {
    return; // already gone
  }
  for (let i = 0; i < 50; i += 1) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

// With a TEST_DATABASE_URL (CI's Postgres service), a caller that needs a
// database of its own (e.g. two browser-test servers running side by side)
// gets one created next to it on the same server, rather than sharing.
async function separateDatabaseOn(serverUrl, dbName) {
  const target = new URL(serverUrl);
  target.pathname = `/${dbName}`;
  assertSafeTestDatabaseUrl(target.toString());
  const admin = new URL(serverUrl);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString(), ssl: false });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rowCount === 0) await client.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.end();
  }
  return target.toString();
}

export async function startTestDatabase({ dbName = 'onyx_vault_test', dataDir, separate = false } = {}) {
  let embedded = null;
  let dir = null;
  let url = process.env.TEST_DATABASE_URL;
  if (url && separate) url = await separateDatabaseOn(url, dbName);

  if (!url) {
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    const port = await freePort();
    dir = dataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'onyx-vault-pg-'));
    if (dataDir) {
      await stopLeftoverPostgres(dir);
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Still locked by something: use a fresh folder rather than fail.
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onyx-vault-pg-'));
      }
    }
    fs.rmSync(dir, { recursive: true, force: true });
    embedded = new EmbeddedPostgres({
      databaseDir: dir,
      user: 'postgres',
      password: 'postgres',
      port,
      persistent: false,
      onLog: () => {},
    });
    await embedded.initialise();
    await embedded.start();
    await embedded.createDatabase(dbName);
    url = `postgres://postgres:postgres@127.0.0.1:${port}/${dbName}`;
  }

  assertSafeTestDatabaseUrl(url);
  await applySchema(url);

  return {
    url,
    async stop() {
      if (embedded) {
        await embedded.stop();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}
