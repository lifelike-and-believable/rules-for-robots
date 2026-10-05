# RFR Shop: reference web app

A small product catalogue built from the rules-for-robots [`web-app` template](../../template-repos/web-app/) to show the rules, hooks, agents, and CI working on a real Next.js 16 project. How it was built, and what that taught us, is in [docs/reference-projects.md](../../docs/reference-projects.md).

## Run it

```sh
npm ci
npm run dev          # http://localhost:3000
npm run verify       # typecheck, lint, unit tests, production build
npm run test:e2e     # Playwright, axe, and focus checks against a production build
npx size-limit       # client JavaScript budget
```

## What is here

- `lib/catalog.ts`: typed catalogue data and helpers, unit-tested with Vitest.
- `app/products/`: the server-rendered list with a client-side search island, and statically generated detail pages.
- `e2e/`: end-to-end tests and the accessibility checks required by WEB-001 and WEB-002.
- `AGENTS.md`, `CLAUDE.md`, `.claude/`: instructions, rules, and plugin settings from the template.
- `.github/`: the template's workflows. In this monorepo they do not run from here; [`/.github/workflows/example-web-app.yml`](../../.github/workflows/example-web-app.yml) runs the same checks.
