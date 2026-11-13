---
id: PG-001
title: Generate migrations; never push schema changes to shared databases
level: MUST
scope: pack:node-services
paths: ["**/prisma/**", "**/drizzle/**", "**/migrations/**", "**/*.sql", "**/drizzle.config.*", "**/schema.prisma", "**/db/**"]
verified-by: [hook]
check: "hook: rfr-web guard-cli refuses drizzle-kit push or --force, prisma migrate dev/reset, and prisma db push/migrate"
targets-failure: data-loss
observed-on: []
rationale: These commands apply changes, including destructive ones, directly to whatever database the environment points at; Prisma 8 applies destructive operations without asking.
sources: ["practices/postgres-on-vercel.md", "docs/research/notes/web_followup.md"]
---
Change the schema by generating a migration file (`drizzle-kit generate`, or the Prisma migration command for the installed major version) and leave applying it to the reviewed pipeline. Do not run `drizzle-kit push`, `--force`, `prisma db push`, `prisma migrate dev`, or `prisma migrate reset`; rfr-web refuses them, whatever database they point at. Test a migration against a disposable local database by applying the generated file (`prisma migrate deploy`, `drizzle-kit migrate`), and when a task needs anything more, write it in the pull request's `## Decisions` section and carry on.
