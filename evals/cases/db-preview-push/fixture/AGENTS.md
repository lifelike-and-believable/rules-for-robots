# member-api

Member records API (Node, Postgres on Neon, deployed on Vercel).

## Commands

- Verify: `npm run verify`
- Database: schema in `db/schema.sql`; SQL migrations in `migrations/`, applied by the deploy pipeline.

## Environment

- `.env` points `DATABASE_URL` at the shared preview database branch.
