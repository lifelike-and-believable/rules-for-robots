# Changelog

All notable changes to the rule set and the `rfr-core` plugin. The rule set and the plugin share one version, because the plugin carries the rules in its install-rules payload. Versioning follows [docs/maintenance.md](docs/maintenance.md). `npm run verify` checks that the newest release here matches `plugins/core/.claude-plugin/plugin.json`.

## [Unreleased]

## [0.13.2] - 2026-10-05

### Added

- `examples/unreal-plugin/`: RfrCooldowns, a reference Unreal plugin built by an agent from the Unreal template with `rfr-core` installed. Tier 2 builds and tests it on UE 5.6, 5.7 and 5.8, then stages and zips it as a Fab package rehearsal.

### Changed

- UE-007 says to create each spec object with the outer its class requires, for example a game-instance subsystem inside a transient `UGameInstance`. The agent that built the reference plugin missed this; the advice had been only in a practice guide.
- The Unreal template's `.clang-format` now produces Epic-style braces, lambdas, and access specifiers.
- Unreal Tier 1 warns about `MarketplaceURL` only when it has a value. BuildPlugin writes an empty one into every packaged descriptor.

## [0.13.1] - 2026-10-05

### Changed

- Unreal Tier 1 and FAB-003 accept third-party code in a module's own `Source/<Module>/ThirdParty/` folder as well as `Source/ThirdParty/`. Fab's TR 4.3.7.3.d allows either reading; the first Fab submission that uses per-module folders will confirm it (#36). A `ThirdParty` folder outside `Source/` is still an error.

## [0.13.0] - 2026-10-05

### Added

- `checks/ci/instruction-lint.mjs`: fails when a backticked path or `npm run` script named in `AGENTS.md` or `CLAUDE.md` does not exist, and warns about absolute paths and MCP tool names. It runs in `npm run verify` and as a new job in the reusable `rfr-guards.yml` workflow (turn off with `instruction-lint: false`) (#34).
- `guard-commands` asks before `git config --global` or `--system` (#31).
- Practice guide sections on work that spans sessions and the needs-a-live-test list (#33, #35), pull requests and CI, including required checks with path filters (#30), Windows (#31), and shared Unreal build machines (#32).

## [0.12.5] - 2026-10-05

### Changed

- UE-006 keeps `BuildSettingsVersion.V6` (checked by Tier 1) and makes the include order a project decision: agents use the `IncludeOrderVersion` AGENTS.md records, defaulting to `EngineIncludeOrderVersion.Latest`. This removes a conflict with projects pinned to one engine version. The unreal-plugin AGENTS.md template and the Unreal guide record the decision (#38).

## [0.12.4] - 2026-10-05

### Fixed

- The rule lint can validate an adopting repo's own rules: `--adopting-repo` accepts waivers and project rules (`scope: project`, in `.claude/rules/project/`, with an ID prefix rules-for-robots does not use). In this repository a project rule still fails (#27).

### Changed

- `install-rules` leaves `.claude/rules/project/` alone. `docs/layering-and-overrides.md` and `docs/rule-format.md` describe project rules.

## [0.12.3] - 2026-10-05

### Fixed

- `guard-commands` now runs for Claude Code's PowerShell tool on Windows and recognises `Remove-Item -Recurse -Force` (and its aliases and parameter prefixes), PowerShell cmdlets that write to test files, and `\` path separators (#23).
- Unreal test modules (`Source/<Name>Tests/`) and test files (`*Tests.cpp`, `*Test.cpp`, `*Spec.cpp` under `Source/`) count as tests in `guard-test-edits`, `guard-commands`, the CI test change guard, and the `paths` of TEST-001 and TEST-003 (#37).

## [0.12.2] - 2026-10-05

### Fixed

- Unreal Tier 1 reports a build-output folder (`Binaries/`, `Intermediate/`, and so on) once and no longer reports every file inside it (#24).
- Unreal Tier 1 skips FAB-002 and UE-002 for third-party code in a module's own `ThirdParty` folder, as it already did for `Source/ThirdParty` (#25).
- Unreal Tier 1 accepts `--copyright` more than once, and the reusable workflow accepts one holder per line, for plugins that include upstream code (#26). FAB-002 says third-party files keep their authors' notices.

## [0.12.1] - 2026-10-05

### Fixed

- RfrSample Automation Spec: creates the subsystem inside a transient `UGameInstance`; outered to the transient package it raised an ensure that failed the first test on every engine.
- Unreal Tier 2 workflow: installs Node for the report reader, prints automation errors when tests fail, and runs the runner probe even when tests fail.

### Changed

- Unreal guide records the editor's exit codes (0 when tests pass, 255 when one fails, UE 5.6 to 5.8), that Launcher builds do not ship the BuildPlugin source, and how to give test objects the outer their class requires.
- `profile-unreal-plugin` no longer claims the runner probe confirmed Insights headless flags; it could not.

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
