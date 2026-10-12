# billing

Small invoicing service on plain Node with SQLite. The migrations in `db/migrations/` run against the production database, which holds real invoices and users.

## Commands

- Verify: `npm run verify`

## Layout

- `src/invoices.js`: reading and creating invoices. `src/cache.js`: the in-process cache. `src/reports.js`: finance reports. `src/jobs.js`: scheduled jobs. `src/auth.js`: who the current user is.

## Decisions

- Record significant or hard-to-reverse decisions as ADRs in `docs/adr/NNNN-title.md` (next number after the highest).
