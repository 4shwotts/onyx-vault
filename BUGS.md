# Bugs found and fixed

Every real bug found while bringing Onyx Vault up to portfolio standard,
numbered in the order each was confirmed. Each entry gives the steps to
reproduce, the expected and actual results, the root cause, the fix, and
the test that now guards it.

Two things are deliberately **not** listed here:

- **Claims from the initial code audit that turned out to be wrong.** The
  audit said the sign-in card overflowed a 320px screen (it didn't: the card
  is centred and its extra width eats into the page padding) and that
  cross-site writes were possible (they weren't: an unknown origin made the
  CORS check throw, so the request never reached a route — though it was
  answered with a 500, which is part of bug 11).
- **Mistakes in my own new tests** (about ten, such as a selector matching two
  elements or an assertion running before the page had changed). Each was
  fixed in the test; no app code was changed to make a test pass.

| # | Bug | Found by |
|---|---|---|
| [1](#bug-1-a-malformed-id-crashed-the-whole-api) | A malformed id crashed the whole API | Code review, then a failing API test |
| [2](#bug-2-the-repos-schema-was-incomplete) | The repo's schema was incomplete | Comparison with the live schema |
| [3](#bug-3-monthly-recurring-rules-drifted-to-the-28th) | Monthly recurring rules drifted to the 28th | Unit and integration tests |
| [4](#bug-4-a-recurring-payment-could-be-posted-twice) | A recurring payment could be posted twice | Integration tests |
| [5](#bug-5-dates-from-the-database-moved-by-a-day-when-the-server-clock-wasnt-utc) | Dates from the database moved by a day when the server clock wasn't UTC | Unit and integration tests |
| [6](#bug-6-dashboard-dates-shifted-by-the-visitors-time-zone) | Dashboard dates shifted by the visitor's time zone | Unit tests |
| [7](#bug-7-the-spend-insight-compared-part-of-a-month-with-a-whole-one) | The spend insight compared part of a month with a whole one | Unit tests with fake timers |
| [8](#bug-8-sessions-were-never-revoked) | Sessions were never revoked | API tests |
| [9](#bug-9-weak-input-validation) | Weak input validation | API tests |
| [10](#bug-10-non-iso-dates-were-read-according-to-the-databases-locale) | Non-ISO dates were read according to the database's locale | API tests and a read-only live query |
| [11](#bug-11-wrong-error-codes) | Wrong error codes | API tests |
| [12](#bug-12-per-user-caps-could-be-exceeded-by-simultaneous-requests) | Per-user caps could be exceeded by simultaneous requests | API tests |
| [13](#bug-13-recurring-payments-were-missed-while-the-server-slept) | Recurring payments were missed while the server slept | Live data |
| [14](#bug-14-without-webgl-the-app-was-a-blank-page) | Without WebGL the app was a blank page | Browser test against the original UI |
| [15](#bug-15-the-verify-email-page-reported-failure-after-a-success) | The verify-email page reported failure after a success | Browser test against the original UI |
| [16](#bug-16-form-controls-had-no-accessible-name) | Form controls had no accessible name | axe scan of the original UI |
| [17](#bug-17-clickable-controls-couldnt-be-reached-with-a-keyboard) | Clickable controls couldn't be reached with a keyboard | Keyboard test against the original UI |
| [18](#bug-18-navigation-ran-off-the-screen-on-landscape-phones-tablets-and-narrow-laptop-windows) | Navigation ran off the screen on several screen sizes | Stricter browser overflow check |

---

## Bug 1: A malformed id crashed the whole API

**Found by:** reviewing the code, then a failing API test and a short Node 24
script reproducing the crash.

**Steps to reproduce**
1. Sign in.
2. Send `POST /transactions` with `{"account_id": "abc", "amount": -1, "date": "2026-10-01"}`.

**Expected:** a 400 saying `account_id` is invalid.

**Actual:** no response at all. Postgres rejected the query
(`invalid input syntax for type integer: "abc"`), the request hung, and on
Node 15+ the unhandled promise rejection stopped the whole server process —
for every user — until the host restarted it.

**Root cause:** the ownership and cap queries ran before the handler's
`try` block, and Express 4 ignores the promise an async handler returns, so
the rejection was never handled.

**Fix:** ids are validated as positive whole numbers before any query, and
every async handler is wrapped so any other error becomes a clean 500.
Released as a hotfix ahead of the rest of this work.

**Guarded by:** `backend/test/api/malformedIds.test.mjs` (44 tests: words,
negatives, decimals, numbers beyond the INTEGER range, objects, arrays,
booleans and SQL fragments, each checked for a clean 400 and no unhandled
rejection).

## Bug 2: The repo's schema was incomplete

**Found by:** comparing the repo with a read-only query of the live database's
schema.

**Steps to reproduce:** create a fresh database from `backend/db/*.sql`, start
the API and create a recurring rule.

**Expected:** the app works on a database built from the repo.

**Actual:** the `recurring_transactions` table and the `transactions.is_anomaly`
column didn't exist; they had been created on the live database by hand and
never added to the repo.

**Root cause:** schema changes made directly on the live database.

**Fix:** numbered, idempotent migrations in `backend/db/migrations/`. Migration
003 recreates the missing objects exactly as they are live, so applying it to
the live database changes nothing.

**Guarded by:** every backend and browser test runs against a database built
only from the migrations, applied twice to prove they can be re-run safely
(`backend/test/support/testDatabase.mjs`).

## Bug 3: Monthly recurring rules drifted to the 28th

**Found by:** unit and integration tests.

**Steps to reproduce:** create a monthly rule starting on 31 January and let it
run for a few months.

**Expected:** 31 Jan, 28 Feb, 31 Mar, 30 Apr…

**Actual:** 31 Jan, 28 Feb, **28 Mar, 28 Apr…** — once moved to a short month's
last day, the rule stayed on the 28th for good. (The README claimed month ends
were handled.)

**Root cause:** the next date was calculated from the previous run date, so the
original day of the month was lost after February.

**Fix:** rules store `start_date` and `day_of_month`, and the next date always
aims for that day, falling back to the last day only when a month is too short.
Migration 004 backfills both for existing rules from each rule's first payment,
which also corrects rules that had already drifted.

**Guarded by:** `backend/test/unit/nextDate.test.mjs` ("returning to the start
day after a short month"), `backend/test/integration/recurringPosting.test.mjs`
("a rule starting on the 31st…") and `backend/test/integration/migration004.test.mjs`.

## Bug 4: A recurring payment could be posted twice

**Found by:** integration tests that ran the same rule twice, one after the
other and at the same time.

**Steps to reproduce:** with a rule due today, run the nightly job and "Run
now" at the same moment (or double-click "Run now").

**Expected:** the payment is posted once.

**Actual:** it was posted twice, and the balance moved twice.

**Root cause:** each run read the due rules, then posted, with nothing to stop a
second run that had read the same rule from posting it again.

**Fix:** each payment is first *claimed* with
`UPDATE … SET next_run_date = <next> WHERE id = $1 AND next_run_date = <the date read>`.
The claim, the transaction and the balance update commit together or not at
all. A second run finds nothing to claim; if the first run fails part-way, the
claim rolls back and the payment is still due.

**Guarded by:** `backend/test/integration/recurringPosting.test.mjs` ("never
posting the same payment twice", "a failure part-way through posting"),
`backend/test/integration/catchUp.test.mjs` (catch-up and sweeps running
together) and `backend/test/api/recurring.test.mjs` ("two run-now clicks at the
same moment").

## Bug 5: Dates from the database moved by a day when the server clock wasn't UTC

**Found by:** unit and integration tests run in several time zones.

**Steps to reproduce:** run the API on a machine set to UK time in summer (or
any zone ahead of UTC) and process a monthly rule due on 15 June.

**Expected:** the next run is 15 July.

**Actual:** 14 July.

**Root cause:** node-postgres turns a `DATE` column into a JavaScript `Date` at
*local* midnight; reading it back in UTC gave the previous day.

**Fix:** `DATE` values are returned as their `YYYY-MM-DD` text and never pass
through a time-zone conversion.

**Guarded by:** `backend/test/unit/nextDate.test.mjs` ("time zones") and
`backend/test/integration/recurringPosting.test.mjs` ("dates read back from
Postgres").

## Bug 6: Dashboard dates shifted by the visitor's time zone

**Found by:** unit tests run in several time zones.

**Steps to reproduce:** add spending on the last day of a month and view that
month on the dashboard; or view July from a UK browser in summer.

**Expected:** each month runs from its 1st to its last day.

**Actual:** spending on the **last day of every month was missing** from the
dashboard. In UK summer time, July ran from 30 June to 30 July; in New York,
1 November was shown as October.

**Root cause:** month ranges were built with `toISOString()` on local dates, and
transaction timestamps were compared as strings.

**Fix:** dates are handled as `YYYY-MM-DD` keys throughout
(`frontend/src/utils/dates.js`), with no time-zone conversion.

**Guarded by:** `frontend/src/utils/dates.test.js`, `months.test.js` and
`frontend/src/lib/spending.test.js` (in UTC, London, New York, Sydney and
Kiritimati).

## Bug 7: The spend insight compared part of a month with a whole one

**Found by:** unit tests with fake timers.

**Steps to reproduce:** on 3 November, having spent at exactly the same daily
rate as in October, open the dashboard.

**Expected:** no claim that spending has fallen.

**Actual:** "Nice — Groceries spending is down 90% from last month." It also
said "so far this month" about past months.

**Root cause:** the current month so far was compared with the whole of the
previous month.

**Fix:** a month in progress is compared with the previous month up to the same
day; a finished month with the whole previous month. The wording is neutral and
only describes past spending (for example "Groceries: £300 so far this month,
50% more than by the same day last month."), with no percentage when there's
nothing to compare against.

**Guarded by:** `frontend/src/lib/spending.test.js` ("buildInsight") and
`frontend/src/components/InsightLine.test.jsx`.

## Bug 8: Sessions were never revoked

**Found by:** API tests.

**Steps to reproduce:** sign in, copy the session cookie, log out, then send a
request with the copied cookie.

**Expected:** 401.

**Actual:** 200 — the cookie kept working for its full 24 hours. A password
reset didn't sign other sessions out, and a deleted user's cookie still got 200
from `/accounts`.

**Root cause:** the session was only a signed JWT; nothing on the server could
end it.

**Fix:** a `sessions` table (migration 005). The JWT carries a session id, only
a hash of which is stored; every request checks the session still exists.
Logout ends that session, and a password reset or account deletion ends all of
them. Expired sessions are cleared on server start and hourly.

**Guarded by:** `backend/test/api/auth.test.mjs` ("a copy of the cookie taken
before logout no longer works", "signs out every existing session when the
password is reset"), `backend/test/api/sessions.test.mjs` and
`backend/test/api/accountDeletion.test.mjs`.

## Bug 9: Weak input validation

**Found by:** API tests.

**Steps to reproduce:** `POST /transactions` with an amount of `""`, `true`,
`"1e3"`, `0`, `1.005` or `1000000`; or create an account of type `"isa"`.

**Expected:** a 400 explaining the problem.

**Actual:** `""` created a £0.00 transaction, `true` £1.00, **`"1e3"` £1,000**;
zero, sub-penny and over-large amounts were accepted (sub-penny ones silently
rounded); any account type was accepted, and a description sent as an object was
saved as text.

**Root cause:** values were converted with `Number()` and lightly checked.

**Fix:** strict schemas on every route (zod): exact amounts with at most two
decimal places, non-zero and within ±£999,999.99, handled in integer pence;
known fields only, so a client can't set server-owned fields such as `user_id`
or `balance`.

**Guarded by:** `backend/test/api/validation.test.mjs`,
`backend/test/unit/schemas.test.mjs`, `backend/test/unit/money.test.mjs` and
`backend/test/api/security.test.mjs` ("fields only the server may set").

## Bug 10: Non-ISO dates were read according to the database's locale

**Found by:** API tests, then confirmed with a read-only query of the live
database.

**Steps to reproduce:** `POST /transactions` with the date `01/08/2026`.

**Expected:** a 400 (the API should accept only `YYYY-MM-DD`).

**Actual:** 201. The live database (DateStyle `ISO, MDY`) stores it as
**8 January**. This is also why UK-format CSV imports were misread.

**Root cause:** dates were passed to Postgres unchecked.

**Fix:** only real `YYYY-MM-DD` dates are accepted. The Import page now reads
`DD/MM/YYYY` itself, as day first, and the test database uses the same
DateStyle as the live one.

**Guarded by:** `backend/test/api/validation.test.mjs` ("an ambiguous UK-style
date is refused…", "the test database reads dates the way the live database
does") and `frontend/src/lib/importCsv.test.js`.

## Bug 11: Wrong error codes

**Found by:** API tests.

**Steps to reproduce:** send malformed JSON, an oversized body, a non-numeric id
in a URL, an unknown route, or another user's account id in a request body.

**Expected:** 400, 413 and 404 as appropriate, as JSON.

**Actual:** 500s for bad JSON, oversized bodies, wrong field types, invalid
dates, bad query parameters and non-numeric ids; an HTML 404 page for unknown
routes; 403 (which confirms the record exists) where it should be 404; and a 500
for requests from an unknown origin.

**Root cause:** no handling for the JSON parser's errors or unknown routes, and
ownership checks that answered 403.

**Fix:** one error format, `{"error": "…"}`, for every 4xx and 5xx; 400 for
malformed JSON, 413 for oversized bodies, 404 for unknown routes and for records
that don't exist or belong to someone else, and a clean 403 for cross-site
writes.

**Guarded by:** `backend/test/api/validation.test.mjs`,
`backend/test/api/errorFormat.test.mjs`, `backend/test/api/authorisation.test.mjs`
and `backend/test/api/security.test.mjs`.

## Bug 12: Per-user caps could be exceeded by simultaneous requests

**Found by:** API tests that send several requests at the same moment.

**Steps to reproduce:** with 9,999 transactions, send six transaction requests
at once.

**Expected:** one succeeds; the total stops at 10,000.

**Actual:** all six succeeded (10,005). Six account requests at 9 accounts left
11.

**Root cause:** each request counted, then inserted, with nothing stopping
another request counting in between.

**Fix:** the count and insert happen inside a transaction that holds a lock on
the user's row (`SELECT … FOR UPDATE`), for all four caps.

**Guarded by:** `backend/test/api/caps.test.mjs` ("caps hold under simultaneous
requests").

## Bug 13: Recurring payments were missed while the server slept

**Found by:** live data: a rule due on 1 November still hadn't posted on
9 November.

**Steps to reproduce:** on the free hosting plan, leave the site idle overnight
with a rule due that day.

**Expected:** the payment is posted.

**Actual:** it never was. The nightly job only runs if the server happens to be
awake at 01:00 UTC, and the host puts it to sleep when idle.

**Root cause:** a fixed-time job on a server that sleeps. (Inferred from the
hosting plan; the host's logs would confirm it.)

**Fix:** due payments are caught up when the server starts (wakes), hourly
while it's awake, and after a user signs in (without making sign-in wait).
Each missed payment is dated on the day it was due and goes through the same
atomic claim as bug 4, up to 12 per rule per run.

**Guarded by:** `backend/test/integration/catchUp.test.mjs` (several missed
months, the cap of 12, catch-up running alongside the sweep, and sign-in not
waiting for it).

## Bug 14: Without WebGL the app was a blank page

**Found by:** a browser test against the original UI with WebGL switched off.

**Steps to reproduce:** open the site in a browser with WebGL unavailable
(some locked-down or older devices).

**Expected:** the app works, without the animated background.

**Actual:** a completely blank page — no text and no Sign in button — with
"Error creating WebGL context" in the console.

**Root cause:** the WebGL background is rendered around the whole app, and
creating the renderer threw.

**Fix:** a still CSS background and an SVG gem are used whenever WebGL is
unavailable, fails, or the visitor prefers reduced motion; Three.js is only
downloaded when the animated versions are shown.

**Guarded by:** `frontend/e2e/graphics.spec.js` and
`frontend/src/components/graphics.test.jsx`.

## Bug 15: The verify-email page reported failure after a success

**Found by:** a browser test against the original UI (running in development).

**Steps to reproduce:** in development, open a verification link.

**Expected:** "Email verified".

**Actual:** two requests (200, then 400), and "Verification failed" shown after
the address had been verified. The one-time code also stayed in the address
bar (and browser history).

**Root cause:** the request was sent from an effect with no guard, and React
runs effects twice in development.

**Fix:** the code is sent exactly once and removed from the address bar; if a
link has expired, a new one can be requested from the same page.

**Guarded by:** `frontend/e2e/journeys.spec.js` (sign-up journey: verifies in the
development server and checks the code is removed from the URL).

## Bug 16: Form controls had no accessible name

**Found by:** an axe scan of the original UI.

**Steps to reproduce:** run axe on the Transactions and Import pages.

**Expected:** no violations.

**Actual:** `select-name` (critical) on 8 drop-downs and `label` (critical) on 1
field.

**Root cause:** drop-downs and inputs had placeholders but no labels.

**Fix:** every control has a label (visually hidden where the design shows none),
and field errors are linked to their fields.

**Guarded by:** `frontend/e2e/accessibility.spec.js` (axe on every page, in
every main state; any violation fails the run).

## Bug 17: Clickable controls couldn't be reached with a keyboard

**Found by:** a keyboard (Tab) test against the original UI.

**Steps to reproduce:** on the sign-in page, press Tab repeatedly.

**Expected:** every control, including "Register", can be reached.

**Actual:** only four stops; "Register", the account "×" delete buttons, the
"resend" link, the month picker's year arrows, transaction delete buttons and
the dashboard's category links were clickable `<span>`s that a keyboard could
never reach.

**Root cause:** `onClick` on non-interactive elements.

**Fix:** every one is now a real `<button>` or link with a spoken name.

**Guarded by:** `frontend/e2e/accessibility.spec.js` ("keyboard": Tab reaches each
control and Enter uses it).

## Bug 18: Navigation ran off the screen on landscape phones, tablets and narrow laptop windows

**Found by:** the stricter overflow check in the browser tests
(`frontend/e2e/devices/layout.spec.js`), which counts content cut off inside an
`overflow: hidden` box as overflowing (an earlier version of the check let it
through). Confirmed against the original UI. A second case (the phone tab bar at
320px) was then found by the new "every navigation link is fully on screen"
check.

**Steps to reproduce**
1. Sign in.
2. Open the dashboard in a window 844×390 (a phone held sideways), 820×1180 (an
   upright iPad Air), 1024×768 (a tablet held sideways) or any width from 769px
   to about 1,180px.
3. Look along the navigation bar.

Second case: open the dashboard at 320×568 and look at the last tab.

**Expected:** every navigation link and button is fully visible and usable.

**Actual**
- At 844×390 on the original UI, **Import** and **Logout** were past the right
  edge of the screen and could not be reached. With the Settings link added in
  this work, **Accounts** went off-screen too.
- At 320×568, the phone tab bar clipped about a quarter of the **Import** tab.

**Root cause**
- The app switched to the phone layout only at 768px and below, but the desktop
  navigation bar needed **1,179px** including page padding (measured). Every
  width between 769px and 1,178px got a bar that didn't fit.
- Nothing accounted for short landscape screens, where the one-screen desktop
  dashboard also can't fit vertically.
- The phone tab bar's padding and letter spacing were slightly too generous for
  a 320px screen.

**Fix**
- Trimmed the desktop bar's padding and gaps (same text and font size): it now
  needs **1,067px** in Chromium and **1,064px** in WebKit.
- The phone layout is now used below **1,100px** wide, and on any landscape
  screen up to **500px** tall (`frontend/src/hooks/useIsMobile.js`; the iOS
  input-zoom rule in `index.css` uses the same query).
- Tightened the phone tab bar's padding and letter spacing, keeping the same
  labels.

**Guarded by:** `frontend/e2e/devices/layout.spec.js`, in Chromium and WebKit
with touch, at 320×568, 390×844, 844×390, 768×1024, 820×1180, 1024×768 and
1100×800 (the narrowest desktop layout):
- "uses the phone/desktop navigation, with every link on screen";
- "signed-out pages fit the screen" and "signed-in pages fit the screen";
- "the demo banner and End demo fit…" and "pop-ups work by touch".
