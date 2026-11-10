# Onyx Vault

A personal finance tracker for recording accounts, transactions and recurring payments, with spending charts and summaries — built as a portfolio project to show full-stack engineering and testing.

**[Try the live demo](https://onyx-vault-six.vercel.app/demo)** · **[Live site](https://onyx-vault-six.vercel.app)** · **[Source code](https://github.com/4shwotts/onyx-vault)**

[![CI](https://github.com/4shwotts/onyx-vault/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/4shwotts/onyx-vault/actions/workflows/ci.yml)
[![Server coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/4shwotts/onyx-vault/badges/coverage-server.json)](TESTING.md)

> **This is a portfolio project, not a real financial service.** It isn't connected to any bank, doesn't move or hold money, isn't regulated by the FCA and doesn't give financial advice. **The demo uses made-up data only**, and demo accounts are deleted after 24 hours. Please don't enter real financial details.

Developed with AI-assisted tooling (Claude Code). Test strategy, review, manual exploratory testing and bug triage by me.

## What it is

Onyx Vault lets you keep track of your own accounts and spending by typing them in (or importing a CSV file). It shows where the money went each month, how this month compares with the last, and what's coming up from recurring payments.

It's built to the standard you'd expect of a small production app: exact money handling, server-side sessions, strict input validation, per-user limits, protection against bots and cross-site requests, accessibility, and **1,073 automated tests** across unit, integration, API, component and browser levels, run on every push. The focus of the project is engineering and quality assurance; see [TESTING.md](TESTING.md) and [BUGS.md](BUGS.md).

## Try the demo

Open **[the demo](https://onyx-vault-six.vercel.app/demo)**, or choose **Try the demo** on the sign-in page. You get a fresh throwaway account straight away, with no email or password, filled with four months of made-up data: a salary, rent, bills, subscriptions, groceries and day-to-day spending, two recurring payments and several categories. Every name in it is invented.

The demo is deleted after 24 hours, or as soon as you choose **End demo**. If the site hasn't been used for a while, the server takes up to a minute to wake up; the page tells you when that's happening.

![Signing up: entering an email and password, checking email, verifying, then signing in to an empty dashboard](docs/media/signup-flow.gif)

*Sign-up, recorded against a local copy. **Public sign-up is closed on the live site**, so use the demo there instead.*

## Features

- **Accounts** (current, savings and credit) with balances kept exactly in step with their transactions.
- **Transactions:** add, edit and delete; filter by account, category and month; server-side pagination; an automatic "unusual" label for spending more than three times your usual in a category.
- **Categories** with icons, created as you go.
- **Recurring payments** (weekly or monthly) that post themselves on the right day, return to the 31st after a short month, and catch up anything missed while the server was asleep — never posting the same payment twice.
- **Dashboard:** total balance, a donut chart of spending by category, this month against last (compared like for like), a projection for the month, and a one-line spending summary that describes what happened without giving advice. Animated count-ups and skeleton loading.
- **Command palette** (Ctrl/Cmd+K) to jump anywhere or find a transaction.
- **CSV import** with a preview and editable categories before anything is saved; reads UK dates (DD/MM/YYYY). A made-up sample file is included.
- **Sign-up, email verification and password reset**, with server-side sessions that really end on logout, password reset or account deletion.
- **Demo mode** and a switch to close public sign-up.
- **Settings:** add due recurring payments now, delete your account and everything in it.
- **Security:** rate limits, bot protection without a CAPTCHA (a hidden honeypot field and a minimum time to fill the form), per-user caps, cross-site request protection, strict validation and security headers.
- **Accessible and responsive:** keyboard and screen-reader friendly, checked with axe on every page, and laid out for phones, tablets and desktops (tested at seven screen sizes in Chromium and WebKit).
- **A WebGL brushed-metal background and spinning gem**, loaded only when they'll be shown, with still versions when WebGL isn't available or reduced motion is preferred.
- **[Privacy notice](https://onyx-vault-six.vercel.app/privacy)** and **[disclaimer](https://onyx-vault-six.vercel.app/disclaimer)**, readable without signing in.

## Tech stack

| Area | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Three.js with react-three-fiber, Papa Parse; self-hosted Inter and Orbitron fonts; Material Symbols icons |
| Backend | Node.js (22 or later), Express 4, zod, bcrypt, jsonwebtoken, express-rate-limit, helmet, node-cron, node-postgres |
| Database | PostgreSQL 18 (Neon, London region) |
| Email | Brevo (transactional email over HTTPS) |
| Hosting | Vercel (website and API proxy), Render (API) |
| Testing | Vitest, Supertest, Testing Library, Playwright (Chromium and WebKit), axe-core, embedded-postgres |
| CI | GitHub Actions |

## Architecture and key design decisions

```mermaid
flowchart LR
  B[Browser] -->|"pages, and /api/* on the same origin"| V[Vercel]
  V -->|"/api/* proxied"| R[Render: Express API]
  R --> N[(Neon: PostgreSQL 18)]
  R -->|"verification and reset emails"| E[Brevo]
```

- `frontend/`: the React app. `src/lib` and `src/utils` hold the pure logic (money, dates, spending summaries, CSV parsing), which is where most frontend tests point.
- `backend/`: the Express API. `src/app.js` builds the app without starting a server (so tests can drive it); `src/index.js` starts it and schedules housekeeping. Schema changes live in `db/migrations/` as numbered, idempotent SQL files.

**How money is stored and calculated**

- Amounts and balances are stored in Postgres as **`NUMERIC(12,2)`**: exact decimals, never floating point.
- In JavaScript, money is handled as an **integer number of pence**, parsed from its decimal text (so `0.1 + 0.2` style errors can't occur), and formatted as pounds only for display.
- The API sends and receives amounts as **exact decimal strings** (`"-12.50"`); totals are summed by Postgres, on `NUMERIC`.
- Spending is stored as **negative** amounts and income as positive. Each amount must have at most two decimal places, be non-zero and be within **±£999,999.99** — a cap chosen so that even 10,000 maximum transactions can't overflow an account balance.

**Other decisions**

- **Dates are calendar days, not moments.** They travel as `YYYY-MM-DD` text from the database to the screen and never pass through a time-zone conversion; the API accepts only that format, so a database's locale can't change what a date means.
- **Same-origin API.** The browser only ever talks to its own origin (`/api`, proxied by Vercel), so the session cookie is first-party: `httpOnly`, `Secure`, `SameSite=Lax`. State-changing requests from any other site are refused.
- **Server-side sessions.** The cookie's JWT names a session; only a hash of it is stored. Logging out, resetting a password or deleting an account ends sessions for real.
- **Recurring payments are claimed atomically.** A payment is claimed, posted and added to the balance in one database transaction, so overlapping runs can't post it twice and a failure part-way leaves it still due.
- **A sleeping server.** The free hosting plan sleeps when idle, so due payments are caught up when the server wakes, hourly and after sign-in; the sign-in page wakes the server as it loads and explains any wait.
- **Limits that hold under load.** Per-user caps are checked under a row lock, and the cap on live demos under a database-wide lock.
- **Demo accounts can never touch real ones.** A database constraint and trigger guarantee a demo always has a reserved `.invalid` address and an expiry, and that a real account can never become a demo, so the clean-up cannot match a real account.
- **Tests can't reach the live database.** A guard refuses any test database that isn't local and named `*_test`, and the real `DATABASE_URL` is never read in tests.
- **Progressive enhancement for the 3D graphics.** Three.js is loaded only when the animated versions are shown; the first page load is about 370 kB of JavaScript (115 kB compressed) instead of 1.2 MB.

## Testing

**1,073 automated tests, all passing**, run on every push and pull request:

| Level | Tests |
|---|---|
| Unit | 389 |
| Integration (real database) | 31 |
| API (real database) | 426 |
| Component | 98 |
| Browser (Chromium and WebKit) | 113 |
| Image-size checks | 16 |

Server coverage is **96.2% of lines** (87.3% of branches). The browser tests cover five end-to-end journeys (sign-up to sign-in with data kept, forgotten password, add/edit/delete, recurring payments, account deletion) and more besides, an axe accessibility scan of every page, and layout checks at seven screen sizes.

The strategy, what each level covers, what's deliberately not tested and how to run everything are in **[TESTING.md](TESTING.md)**.

## Bugs found and fixed

Writing these tests found **18 real bugs**, including a request that could crash the whole API, sessions that never really ended, recurring payments that drifted or could post twice, dates shifted by time zones, and a blank page for browsers without WebGL. Each was confirmed by a failing test before being fixed, and each is now guarded by one.

Every bug, with steps to reproduce, expected and actual results, root cause, fix and guarding test, is in **[BUGS.md](BUGS.md)**.

## Running it locally on Windows

You need **Node.js 22 or later** (24 recommended) and Git. You don't need Postgres or Docker for the simplest way.

**The quick way, with a throwaway database.** In one PowerShell window:

```powershell
cd backend
npm ci
npm run dev:local
```

and in a second one:

```powershell
cd frontend
npm ci
npm run dev
```

Then open <http://localhost:5173> and choose **Try the demo**. This runs the API in test mode against an embedded Postgres that's deleted when you stop it (Ctrl+C). No email is sent: if you sign up, open `http://localhost:4000/__test__/outbox?to=<your email>` to get the verification link.

**With your own Postgres.** Copy `backend/.env.example` to `backend/.env` and fill it in (it explains each setting, including the Brevo email keys). Apply the migrations in order, for example with `psql`:

```powershell
cd backend
$env:DATABASE_URL = 'postgresql://user:password@localhost:5432/onyx_vault'   # the same as in .env
Get-ChildItem db\migrations\*.sql | Sort-Object Name | ForEach-Object { psql $env:DATABASE_URL -f $_.FullName }
npm run dev
```

and run the frontend with `npm run dev` as above.

**Tests:** see [Running the tests on Windows](TESTING.md#running-the-tests-on-windows).

## Known limitations

- **It runs on free hosting plans.** After a while without visitors, the first request can take up to a minute while the server wakes, and scheduled jobs only run while it's awake (missed recurring payments are caught up when it wakes).
- **Recurring payments catch up at most 12 missed payments per rule at a time**; anything older follows on the next run.
- **Imports are saved one row at a time.** Every row is checked before anything is saved, but if the server fails part-way, the rows already imported stay (the page says exactly how many). The import flow has no browser test; its parsing has unit tests.
- **The dashboard loads all of a user's transactions** to draw its charts. That's fine up to the 10,000-transaction cap but wouldn't scale much beyond it.
- **Rate limits are kept in the server's memory**, so they reset when it restarts and wouldn't be shared across several servers.
- **Only some email providers are accepted at sign-up** (Gmail, Outlook, Yahoo, iCloud, Proton and similar) to cut down on throwaway addresses.
- **There's no two-factor authentication**, and no way to change your email address or export your data from the app (a copy can be requested by email).
- **Frontend coverage (62% of lines) counts only unit and component tests**; pages are tested mainly in the browser, which isn't measured.
- **Browser testing uses Playwright's Chromium and WebKit.** Real iOS Safari, Firefox and real assistive technology haven't been tested.
- **The privacy notice and disclaimer are written in plain English from what the code does**, but haven't been reviewed by a lawyer.

## Privacy and disclaimer

- **[Privacy notice](https://onyx-vault-six.vercel.app/privacy):** what's stored and why, the single strictly necessary cookie, the services involved and where they are, how long data is kept, how to delete your account, and your rights under UK data protection law.
- **[Disclaimer](https://onyx-vault-six.vercel.app/disclaimer):** a portfolio project, not a real financial service; not connected to any bank and not regulated by the FCA; not financial advice; please don't enter real financial details; provided as it is, with no guarantees; data may be reset or deleted.

Questions about your data: [ulasatik04@gmail.com](mailto:ulasatik04@gmail.com).
