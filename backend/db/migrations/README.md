# Database migrations

Plain SQL files, applied in filename order. Every file is idempotent
(`IF NOT EXISTS`), so re-running one that has already been applied changes
nothing.

- **Tests** apply every file automatically to a throwaway local database
  (see `test/globalSetup.mjs`). They never touch the live database.
- **Live database (Neon):** paste each new file into Neon's SQL Editor, in
  order, once it has been reviewed. Files `001`–`003` match the live
  schema already.
