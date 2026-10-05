# Changelog

All notable changes to the rule set and the `rfr-core` plugin. The rule set and the plugin share one version, because the plugin carries the rules in its install-rules payload. Versioning follows [docs/maintenance.md](docs/maintenance.md). `npm run verify` checks that the newest release here matches `plugins/core/.claude-plugin/plugin.json`.

## [Unreleased]

### Fixed

- RfrSample Automation Spec: creates the subsystem inside a transient `UGameInstance`; outered to the transient package it raised an ensure that failed the first test on every engine.
- Unreal Tier 2 workflow: installs Node for the report reader, prints automation errors when tests fail, and runs the runner probe even when tests fail.

### Changed

- Unreal guide records the editor's exit code on failing tests (255 on UE 5.6 and 5.8), and how to give test objects the outer their class requires.

## [0.12.0] - 2026-10-05

### Added

- Phase 8 eval cases: green-at-all-costs, tdd-feature, nextjs-redirect, db-preview-push, configurable-retry, with results and a report in `evals/results/2026-10-05-phase8/`.
- Unit tests for eval graders and the harness's shared `node_modules` handling.
- `CHANGELOG.md`, `docs/maintenance.md` (versioning policy and review cycle), and a release check in `npm run verify`.

### Changed

- NEXT-001 now points agents at the `nextjs-agent-rules` block that `next dev` writes into `AGENTS.md`, which the Phase 8 evals showed already prevents the `middleware.ts` mistake.

### Fixed

- Eval harness: hard-link a shared `node_modules` instead of symlinking it, which Turbopack rejects.
- Eval graders: tdd-feature classifies writes by target file; nextjs-redirect recognises `redirects` in property form.

## [0.11.0] - 2026-10-05

### Added

- Reference web app in `examples/web-app` (RFR Shop, Next.js 16), built by the `web-engineer` agent from the `web-app` template, with its own CI workflow.
- `guard-commands` asks before shell commands that write to test files (for example `sed -i` or a Python one-liner), closing a gap the reference build exposed in `guard-test-edits`.

### Fixed

- `web-app` template: `next typegen` runs before `tsc`, `@types/node` matches Vitest, Vitest excludes `e2e/`, a web `.gitignore`, and ESLint ignores Playwright and Lighthouse output.

## [0.10.0] - 2026-10-05

### Added

- TEST-004: develop new behaviour test first. The engineering agents and `plan-feature` work test-first and report the red and green runs.

## [0.9.0] - 2026-10-05

### Added

- Agents: `web-engineer`, `unreal-engineer`, `code-reviewer`, `security-reviewer`, `accessibility-reviewer`, `performance-reviewer`.
- Skills: `plan-feature`, `review-pr`, `a11y-audit`, `perf-audit`, `security-audit`, `write-adr`, `release`, `profile-unreal-plugin`, `package-unreal-plugin`.
- Smoke tests for every agent and skill (`evals/agents/smoke.mjs`).

## [0.8.0] - 2026-10-05

### Added

- Practice guides in `practices/`. Every rule cites a guide and every guide is cited by a rule; the lint enforces both.

## [0.7.0] - 2026-10-05

### Added

- `node-services` (NODE, PG) and `static-sites` (ASTRO) packs.
- `guard-mcp` hook, which asks before Vercel MCP calls that change production.

## [0.6.0] - 2026-10-05

### Added

- `typescript` (TS), `web-platform` (WEB), and `react-nextjs` (NEXT) packs.

## [0.5.0] - 2026-10-05

### Added

- `unreal-plugin` pack (UE, FAB), Unreal Tier 1 checks, the `RfrSample` plugin, and the Unreal guide.

## [0.4.0] - 2026-10-05

### Added

- Core rules for testing, code quality, security, git, and documentation.

## [0.3.0] - 2026-10-05

### Added

- Default hooks: `guard-commands`, `guard-test-edits`, `format-on-edit`.

## [0.2.0] - 2026-10-05

### Added

- Working agreement rules WA-001 to WA-007.

## [0.1.0] - 2026-10-05

### Added

- `rfr-core` plugin, marketplace, and the `install-rules` skill.
- Rule format, rule lint, and template-repo build.
