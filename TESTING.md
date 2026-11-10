# Testing Onyx Vault

**1,087 automated tests, all passing:** 1,071 functional tests across five
levels, plus 16 image-size checks. Every push and pull request runs all of
them in GitHub Actions (see [CI](#continuous-integration)).

| Level | Tool | Tests |
|---|---|---|
| Unit | Vitest | **389** (backend 226, frontend 163) |
| Integration (real database, no HTTP) | Vitest + Postgres | **31** |
| API | Vitest + Supertest + Postgres | **426** |
| Component | Vitest + Testing Library | **98** |
| Browser | Playwright (Chromium + WebKit) | **127** |
| **Functional total** | | **1,071** |
| Image-size checks | Vitest | **16** |
| **Overall** | | **1,087** |

Coverage (from the unit, integration, API and component tests):

| | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| Server | 95.68% | 87.29% | 96.02% | 96.22% |
| Frontend | 62.18% | 54.98% | 55.87% | 62.30% |

The frontend figure counts only Vitest: pages are mostly exercised by the
Playwright tests, which aren't included in coverage. The logic modules are
covered almost completely (`lib` 94%, `utils` 100%, `hooks` 100%).

## Strategy

- **Test the riskiest things hardest.** For a finance-themed app that means
  money, dates, recurring payments, sessions, authorisation and input — so most
  tests are at the unit and API levels, where they're fast and precise, with a
  smaller set of browser journeys on top.
- **Real database, never the live one.** API and integration tests run
  against a real Postgres 18 (the same version as the live Neon database),
  started fresh for each run: an embedded Postgres on a developer machine, a
  service container in CI. A guard refuses any database URL that isn't local,
  uses SSL, or isn't named `*_test`, and the real `DATABASE_URL` is never read
  in tests. Migrations are applied twice per run, to prove they're safe to
  re-apply to the live database.
- **Match production where it matters.** The test database uses the live
  database's `DateStyle` (`ISO, MDY`); time-zone-sensitive code is tested in
  UTC, London, New York, Sydney and Kiritimati; browser tests run in Chromium
  and WebKit (Safari's engine), with touch, at seven screen sizes.
- **Bugs first, then fixes.** Every bug in [BUGS.md](BUGS.md) was confirmed by a
  failing test (or, for a few UI bugs, a test against the original UI) before
  it was fixed, and that test now guards it. Tests weren't changed to make them
  pass.
- **Concurrency is tested, not assumed.** Caps, recurring payments, demo
  creation and "run now" are each hit with simultaneous requests.
- **Test-only seams switch on only under `NODE_ENV=test`:** an in-memory email
  outbox (with a route to read it) and a shorter bot-check timer. Tests prove
  they don't exist in production or development.

## What each level covers

### Unit (389)
- **Money** (`backend/test/unit/money.test.mjs`, `frontend/src/utils/money.test.js`):
  parsing amounts into integer pence, refusing floating-point noise, zero,
  more than two decimal places, exponents and out-of-range values; exact
  totals; GBP formatting.
- **Recurring dates** (`nextDate.test.mjs`): weekly and monthly next dates across
  month ends (29th, 30th, 31st), February, leap years, year boundaries and time
  zones, and returning to the 31st after a short month.
- **Spending and charts** (`frontend/src/lib/spending.test.js`): totals per
  category and month, like-for-like comparisons, projections (with fake timers),
  empty months, a single category, last month at £0, new categories, and an
  insight that never gives advice.
- **Dates and months**, **validation schemas** (bad, missing and extra fields),
  **CSV import** (UK day-first dates, amounts in several formats), the **demo
  data generator** (fictional names only), and configuration (database SSL,
  allowed origins, the sign-up switch, the test-database guard).

### Integration (31)
Recurring payments posted against a real database: no double posting (stale,
simultaneous and failing runs), catching up missed payments, and migrations 004
and 006 applied to databases shaped like the live one.

### API (426)
| Area | Tests | What it covers |
|---|---|---|
| Validation and clean errors | 166 | Bad, missing and extra fields, malformed ids and JSON, oversized bodies and bad query strings get a short JSON 4xx — never a 500, hang or stack trace. |
| Sessions and authentication | 75 | Sign-up, verify, login, logout (a copied cookie stops working), password reset, and every kind of bad, forged or expired session getting 401. |
| Security | 45 | SQL injection stored as plain text, server-owned fields refused, cross-site writes refused, security headers, no secrets in responses, forged client IPs ignored. |
| Authorisation | 32 | One user reading, editing or deleting another's data gets the same 404 as a missing record. |
| Demo mode | 28 | Demo creation and data, isolation between demos, End demo, 24-hour clean-up, the database rule protecting real accounts, what demos can't do, rate limit and cap. |
| Recurring payments | 11 | Rules and "run now": only the caller's rules, idempotent, even with two clicks at once. |
| Caps | 10 | Accounts, categories, rules and transactions, including simultaneous requests. |
| Pagination | 9 | Pages, ordering, partial and past-the-end pages, filters and limits. |
| Sign-up switch | 8 | `PUBLIC_SIGNUP_ENABLED` on and off. |
| Test-only seams | 8 | Present only under `NODE_ENV=test`. |
| Bot protection | 7 | Honeypot and too-fast submissions are silently rejected. |
| Single records | 6 | Reading, editing and deleting single transactions and categories. |
| Health, wake and config | 6 | `/health` never touches the database; `/wake` runs one query and is rate-limited. |
| Rate limits | 5 | Each limited endpoint returns 429 once over its limit. |
| Account deletion | 5 | Every row the user owns is removed, and nobody else's. |
| Money correctness | 5 | Balances and page totals equal exact SQL sums through every change. |

### Component (98)
The transaction form's validation, the command palette (keyboard, focus,
touch and screen-reader roles), the insight line, loading and empty states, the
"waking the server" notice (2-second and 75-second timings with fake timers),
the demo pages and banner, the sign-up switch, the graphics fallbacks, and the
privacy notice and disclaimer (each required statement is checked).

### Browser (127)
- **Journeys in Chromium (21):** sign up → verify → add transactions → check
  totals and charts → log out → log back in; forgotten password; add, edit and
  delete a transaction; create a recurring transaction and see it post; delete an
  account; try the demo and end it; two separate demos; the waking-server
  message; the legal pages; sign-up closed (against a second test server started
  with `PUBLIC_SIGNUP_ENABLED=false`); WebGL off, reduced motion, and WebGL on;
  and keyboard-only use.
- **Accessibility (22):** axe (WCAG 2.2 A and AA) on every page, including open
  pop-ups, error states, empty states and the demo. Any violation fails the run.
- **Phones and tablets (84):** at 320×568, 390×844, 844×390, 768×1024,
  820×1180, 1024×768 and 1100×800, in Chromium and WebKit with touch: nothing
  runs off the screen, the right navigation is used with every link on screen,
  the demo banner fits, the header sits in exactly the same place on every page, and pop-ups and the command palette work by tapping.

### Image-size checks (16)
Every image and icon the app ships, and the README's animation, is under
200 kB.

## Deliberately not tested

- **The real email provider.** Tests never call Brevo; under test, email goes to
  an in-memory outbox. The Brevo request itself (a single HTTPS call) is the
  main uncovered part of the server.
- **The live site and live database.** Nothing in the test suites can reach
  them.
- **Real iOS Safari and real devices.** WebKit in Playwright is the same engine,
  but not the same browser.
- **Firefox.**
- **Screen-reader use by people.** Accessibility is checked with axe and
  keyboard tests, which can't judge everything.
- **The Import page's upload-and-confirm flow in a browser.** Its parsing has 45
  unit tests, and the page is covered by the accessibility and layout checks,
  but no browser test uploads a file.
- **Load and performance.**
- **The visual look** (no screenshot comparisons).

## Running the tests on Windows

You need **Node.js 22 or later** (24 recommended). You don't need Postgres or
Docker: the tests start their own throwaway database.

```powershell
# Backend: unit, integration and API tests
cd backend
npm ci
npm run lint
npm test                 # or: npm run test:coverage

# Frontend: unit, component and image-size tests, then the build
cd ..\frontend
npm ci
npm run lint
npm test                 # or: npm run test:coverage
npm run build

# Browser tests (first time only: download the browsers)
npx playwright install chromium webkit
npm run test:e2e         # about 3 minutes
npm run test:e2e:report  # opens the HTML report
```

What passing looks like:

- backend: `Test Files  32 passed (32)` and `Tests  683 passed (683)`;
- frontend: `Test Files  15 passed (15)` and `Tests  277 passed (277)`;
- browser: `127 passed`.

Notes:

- The browser tests start four local servers of their own (two APIs and two
  Vite dev servers, on ports 4100, 4102, 5174 and 5176).
- Windows Firewall may ask about `node` or `postgres`; both listen only on
  your own machine.
- On Windows, Playwright stops its test servers abruptly, so a Postgres worker
  process can occasionally be left behind; the next run stops it before
  starting.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request:

1. **Backend:** install, lint, then unit, integration and API tests with
   coverage, against a Postgres 18 service container.
2. **Frontend:** install, lint, unit and component tests with coverage, then the
   production build.
3. **Browser tests:** Playwright in Chromium and WebKit against the real API
   (with `NODE_ENV=test`) on its own Postgres service.

Coverage reports, the Playwright HTML report and (on failure) screenshots and
traces are kept as artifacts for 14 days. After every fully passing run on
`main`, the server coverage badge is updated on the `badges` branch.

## Re-recording the README animation

```powershell
cd frontend
npm run record:signup
```

This runs the sign-up flow against the local test servers and writes
`docs/media/signup-flow.gif`, failing if it would be 200 kB or more.
