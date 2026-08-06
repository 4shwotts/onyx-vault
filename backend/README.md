# Onyx Vault — Backend

## Setup
1. `npm install`
2. Copy `.env.example` to `.env`, fill in real values
3. `psql $DATABASE_URL -f db/schema.sql`
4. `npm run dev`

## Security notes
- JWT in httpOnly cookie (not localStorage) — blocks XSS token theft
- Passwords hashed with bcrypt, 12 salt rounds
- Every transaction insert/delete updates account balance atomically (BEGIN/COMMIT/ROLLBACK)
- All queries parameterised — no SQL injection risk
- Ownership checks on every route before returning/modifying data