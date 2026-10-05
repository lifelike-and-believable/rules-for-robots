<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# RFR Shop (reference web app)

A small product catalogue with search, built as the rules-for-robots reference web app. It shows the web-app template, rules, hooks, and CI working together.

## Commands

- Verify (run before reporting work as done, and include its output): `npm run verify`
- End-to-end and accessibility tests (after `npm run build`): `npm run test:e2e`
- Dev server: `npm run dev` (check for one already running first)

## Project decisions

- Next.js 16, React 19, TypeScript, Node runtime. No database yet: the catalogue is typed data in `lib/catalog.ts`.
- Budgets: client JavaScript under the limit in `.size-limit.json`; Lighthouse assertions in `lighthouserc.json`.

Rules for this project are in `.claude/rules/`. Leave the `nextjs-agent-rules` block above as it is.
