// Starts a throwaway Postgres for the whole API test run (see
// support/testDatabase.mjs) and hands its URL to each test process.
import { startTestDatabase } from './support/testDatabase.mjs';

export default async function setup({ provide }) {
  delete process.env.DATABASE_URL;
  const db = await startTestDatabase();
  provide('testDatabaseUrl', db.url);
  return () => db.stop();
}
