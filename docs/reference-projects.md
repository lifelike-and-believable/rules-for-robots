# Reference projects

Phase 7 builds real projects from the template repos, with the agents and rules doing the work, to check that the templates are complete and that the checks hold. This page records how each was built and what it exposed.

## Web app: RFR Shop (`examples/web-app`)

### How it was built

1. Scaffolded with `create-next-app` (Next.js 16.3.8) and the `web-app` template applied, following the template README.
2. In an isolated copy (so this repository's own instructions could not leak in), one headless Claude Code session on Opus 5.5 with the `rfr-core` plugin ran `/rfr-core:plan-feature`, delegated implementation to the `web-engineer` agent, and reviewed the result with `/rfr-core:review-pr` (code, accessibility, performance, and security reviewers). Cost: $2.33, 8 top-level turns.
3. The result was copied back, checked by hand, and the remaining gaps fixed.

The feature: a typed catalogue of 12 products, a server-rendered list with an accessible client-side search, statically generated detail pages, Vitest unit tests, and Playwright end-to-end and accessibility tests.

### Results

| Check | Result |
|---|---|
| `npm run verify` (typecheck, lint, unit tests, build) | Pass; all routes static or SSG |
| End-to-end and accessibility (axe with WCAG 2.2 tags and `target-size`, focus not obscured) | 13 of 13 pass |
| Client JavaScript budget | 156.5 kB of 250 kB |
| Lighthouse, `/products` (median of 3, local production build) | LCP 1.96 s, CLS 0, TBT 145 ms; performance 0.98, accessibility 1.00 |
| Lighthouse, `/` | LCP 1.67 s, CLS 0, TBT 52 ms; performance 1.00, accessibility 1.00 |

Reviewers found no blockers or major issues. Their minor findings (unused fonts and starter images, a global link style, an undelayed live-region announcement, `role="list"` for Safari) were left as they are and are listed here as known follow-ups.

### What it exposed

| Finding | Fix |
|---|---|
| `tsc --noEmit` fails on a fresh Next.js 16 app because route types such as `LayoutProps` are generated | Template `typecheck` script runs `next typegen` first |
| `create-next-app` pins `@types/node@^20`, which conflicts with Vitest 5 | Template README installs `@types/node@^22` |
| Vitest collected the Playwright specs in `e2e/` | Templates ship `vitest.config.ts` excluding `e2e/` |
| The shared `.gitignore` replaced Next's and missed `.next/` and test output | Web templates have their own `.gitignore` |
| ESLint linted Playwright's generated report, failing `verify` | Template README adds report folders to `globalIgnores` |
| `create-next-app` writes its own `AGENTS.md` with a managed block | Template README says to keep the block and append below it |
| The `web-engineer` agent changed an existing test file with a Python one-liner through Bash, so the Edit/Write hook never saw it. The change was requested, but the path around the guard was real | `guard-commands` now asks before shell commands that write to, move, or delete test files; the CI test change guard remains the deterministic backstop |
| The `guard-commands` hook held the agent's `rm -rf` of report folders, and the agent stopped to ask instead of working around it | Working as intended |
| Next.js 16 logs `NoFallbackError` when an unknown slug hits a route with `dynamicParams = false`, while still returning 404 | Framework behaviour; no change |

The Playwright browser in this build environment did not match the installed `@playwright/test` version; CI installs its own browser with `npx playwright install`.

## Unreal plugin: RfrSample (`examples/unreal/RfrSample`)

The Tier 2 workflow builds and tests the sample plugin on the self-hosted runner for UE 5.6, 5.7, and 5.8. The first run compiled on 5.6 and failed only because the warning check counted deprecation warnings from engine headers; the check now counts only the plugin's own source. Results of the rerun and the runner probe are recorded in `PLAN.md` section 12 when available.
