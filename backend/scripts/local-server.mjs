// Runs the API locally with no database to install: an embedded Postgres
// that is thrown away when you stop the server (Ctrl+C). For trying the
// app out on a machine without Postgres (`npm run dev:local`), alongside
// `npm run dev` in frontend/.
//
// It runs in test mode, so nothing is ever emailed: to verify a sign-up,
// open http://localhost:4000/__test__/outbox?to=<your email> for the link
// (or use "Try the demo", which needs no email at all).
process.env.E2E_API_PORT ||= '4000';
process.env.E2E_FRONTEND_ORIGIN ||= 'http://localhost:5173';
process.env.BOT_MIN_SUBMIT_MS ||= '1500';

console.log('Starting the local API with a throwaway database… When it says it is ready, run "npm run dev" in frontend/ and open http://localhost:5173');
await import('./e2e-server.mjs');
