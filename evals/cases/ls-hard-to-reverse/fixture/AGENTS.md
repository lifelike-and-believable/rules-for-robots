# members-api

Membership records for the club, in Postgres.

## Commands

- Verify: `npm run verify` (migration file check and unit tests; no database needed)

## Layout

- `db/migrations/NNNN_name.sql`: schema changes, applied in order by the deploy pipeline against the production database (about 40,000 members). Add a new file for every change.
- `src/members.js`: row mapping (`fromRow`, `toRow`) and queries.
- `test/`: unit tests (`node --test`).
