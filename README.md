@'
# Onyx Vault

A full-stack personal finance tracker built to explore end-to-end fintech app patterns: authenticated accounts, transaction management, recurring billing, spend analytics, and basic fraud/anomaly detection.

**Live demo:** https://onyx-vault-six.vercel.app

## Features

- **Authentication** — JWT sessions stored in httpOnly cookies (never exposed to client-side JS), bcrypt password hashing, rate-limited login/register, email verification and password reset via transactional email, timing-safe login (a failed login takes the same time whether the email exists or not, to prevent account enumeration)
- **Bot protection on registration** — a honeypot field plus a minimum-submit-time check, no CAPTCHA or third-party service
- **Accounts** — multiple accounts per user (current/savings/credit), atomic balance updates on every transaction
- **Transactions** — create, delete, filter by account/category/month; CSV import with automatic category detection based on merchant keywords
- **Recurring transactions** — weekly/monthly rules that process automatically (via a daily cron job) or immediately on creation if the start date has already arrived, correctly handles month-end dates (e.g. a rule starting Jan 31st lands on Feb 28th, not rolling into March)
- **Anomaly detection** — flags transactions that are more than 3x a user's historical average spend in that category
- **Spend by Category dashboard** — donut chart, month-over-month trend indicators per category, spending pace/projection for the current month, and a this-month-vs-last comparison view
- **Command palette** (Cmd/Ctrl+K) — quick navigation and search across pages, accounts, categories, and transactions
- **Route protection** — every private page checks session validity before rendering

## Tech Stack

**Backend**
- Node.js / Express
- PostgreSQL (hosted on Neon)
- `jsonwebtoken` + `bcrypt` for auth
- `node-cron` for scheduled recurring transactions
- `helmet`, `express-rate-limit`, and CORS locked to the frontend origin for security

**Frontend**
- React + Vite
- React Router
- `papaparse` for CSV import parsing
- Three.js for the WebGL-rendered background and 3D logo mark

**Deployment**
- Frontend: Vercel
- Backend: Render
- Database: Neon (PostgreSQL)

## Project Structure

onyx-vault/
  backend/
    src/
      routes/          auth, accounts, categories, transactions, recurring
      middleware/      requireAuth (JWT verification)
      cron/            recurring transaction processing
      utils/           anomaly detection, token generation
      email.js         transactional email (verification, password reset)
      db.js
      index.js
    db/
      schema.sql
  frontend/
    public/
    src/
      pages/           Login, Dashboard, Transactions, Accounts, Import,
                        ForgotPassword, ResetPassword, VerifyEmail
      components/      Nav, MonthPicker, ProtectedRoute, PageBackground,
                        CommandPalette, SpinningGem, Icon
      api/client.js
      utils/months.js


## Getting Started

### Prerequisites
- Node.js 22+ (Node 24 recommended)
- A PostgreSQL database (Neon free tier works well)

### Backend setup
```bash
cd backend
npm install
```

Create a `.env` file in `backend/` (see `.env.example` for the full list):

DATABASE_URL=your_neon_connection_string
JWT_SECRET=a_long_random_string
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development


Run the schema against your database:
```bash
psql "$DATABASE_URL" -f db/schema.sql
```

Start the server:
```bash
npm run dev
```

### Frontend setup
```bash
cd frontend
npm install
npm run dev
```

Locally, the frontend talks directly to `http://localhost:4000` by default, no extra configuration needed.

## Deployment

Deployed as two separate services:

- **Backend on Render**, with `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, and `CLIENT_ORIGIN` (set to the production frontend URL) as environment variables. Trusts its host's reverse proxy (`app.set('trust proxy', 1)`), required for correct rate-limiting and secure-cookie behavior on Render.
- **Frontend on Vercel**, with `VITE_API_URL=/api`. API calls are proxied through Vercel to the Render backend via `vercel.json` rewrites rather than calling the backend's URL directly — this keeps the auth cookie first-party (scoped to the Vercel domain) instead of third-party, which several browsers (Safari, Firefox, and Chrome in some configurations) block by default for cross-site requests. `vercel.json` also includes a SPA fallback rewrite so refreshing on any client-side route (e.g. `/dashboard`) doesn't 404.

## License

MIT — feel free to reference or build on this for your own learning.
