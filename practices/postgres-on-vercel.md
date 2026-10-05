# Postgres on Vercel with agents

Practice guide for the `node-services` pack (rules `PG-*` and `NODE-*`). Source: [web follow-up notes](../docs/research/notes/web_followup.md).

## Where Postgres comes from

Vercel Postgres moved to Neon in December 2024; databases now come from Marketplace integrations (Neon, Supabase, and others).

| Provider | Preview branches | Data in previews | Notes |
|---|---|---|---|
| Neon | One copy-on-write branch per preview (`preview/<git-branch>`), kept until the deployment is deleted (6 months by default) | A copy of the parent's data, unless you use schema-only branches | PgBouncer in transaction mode on the pooled URL |
| Supabase | Branches built from committed migrations plus `seed.sql` | None except the seed | Each migration runs in one transaction, so `create index concurrently` fails |

## Migration safety

1. Generate migrations; never push schema to shared databases (PG-001). The `rfr-core` guard asks before `drizzle-kit push`, `--force`, `prisma db push`, `prisma migrate dev/reset`, and `prisma db migrate`.
2. Lint every new migration in CI with [squawk](https://github.com/sbdchd/squawk): fail on `DROP COLUMN`, `DROP TABLE`, non-concurrent indexes, and validated constraints unless a reviewer approves (PG-002).
3. Run the ORM's own check (`drizzle-kit check`, or `prisma migration check` on Prisma 8).
4. Make breaking changes with expand, backfill, and contract across separate deploys. [pgroll](https://github.com/xataio/pgroll) automates this when the project uses it.
5. Apply production migrations in a gated pipeline step over the direct (unpooled) URL (PG-003). Do not put them in the Vercel build command.

No ORM or platform ships a CI gate that blocks destructive migrations, which is why squawk and the hook exist.

## ORM versions (PG-005)

| ORM | Apply migrations | Notes |
|---|---|---|
| Prisma 7 | `prisma migrate deploy` | |
| Prisma 8 (release candidate, npm `latest`) | `prisma db migrate`, `prisma migration plan`, `prisma migration check` | Applies destructive operations without prompting |
| Drizzle | `drizzle-kit generate` then `drizzle-kit migrate` | Drizzle's docs endorse `push` for production; this pack does not |

## Vercel limits (NODE-001)

Request and response bodies 4.5 MB; default function duration 300 s (up to 800 s on Pro and Enterprise); memory 2 GB on Hobby and up to 4 GB on Pro; bundle 250 MB. Prefer the Node.js runtime. Use one database pool per function instance with a short idle timeout (`attachDatabasePool`).

## Vercel MCP (NODE-002)

The Vercel MCP server has the same access as your Vercel account, including deploying, editing and decrypting environment variables, deleting projects, and purchasing. The `rfr-core` `guard-mcp` hook asks before anything other than reads.
