# Changelog

All notable changes to the rule set and the `rfr-core` plugin. The rule set and the plugin share one version, because the plugin carries the rules in its install-rules payload. Versioning follows [docs/maintenance.md](docs/maintenance.md). `npm run verify` checks that the newest release here matches `plugins/core/.claude-plugin/plugin.json`.

## [Unreleased]

## [1.0.7] - 2026-10-06

Pull request: #77.

### Changed

- DOC-001: when a change completes an item in the project's plan or roadmap, mark it done and name the pull request that delivered it.
- `plan-feature` spec template has a Delivery section for the plan item and its pull requests; `merge-when-green` checks that the plan entry names the merged pull request.
- Working with agents: keeping a trail from the plan to the code. The maintenance guide asks for pull requests in changelog entries.

### Added

- `checks/plan.mjs` (in `npm run verify`): a completed phase or milestone in `PLAN.md` must name its pull requests. `PLAN.md` now lists them for every completed phase and milestone, and the changelog names the pull request for each release from 0.13.2.

## [1.0.6] - 2026-10-06

Pull request: #76.

### Fixed

- `merge-when-green`: picks a merge method without stopping to ask (argument, the only allowed method, recent merges, then a merge commit); reads the failing job's log before reporting; switches to the base branch and fast-forwards it after merging. Found by its new smoke tests, which now pass 4 of 4 (`evals/results/smoke-merge-when-green/`).
- `guard-commands` no longer treats stream redirects (`2>&1`, `>/dev/null`) as writes, so read-only commands on test files are not stopped.

### Added

- Smoke tests for `merge-when-green` in `evals/agents/smoke.mjs`, with a fake `gh` (`evals/agents/fake-gh/`) and a local remote: a green pull request and a pull request whose head commit fails.

## [1.0.5] - 2026-10-05

Pull request: #75.

### Added

- `/rfr-core:merge-when-green <pr>` (user only): waits for CI with one blocking call or pull request events instead of polling, confirms every check on the head commit, merges with `--match-head-commit`, updates the base branch, and continues.
- `.github/workflows/rfr-ci-status.yml`, a reusable workflow that keeps one comment on the pull request with each job's result and the head commit's full SHA, so whoever waits on CI is notified. The template repos' merge-gating workflows (web app and static site CI, Unreal Tier 1 and Tier 2) call it as their last job.

### Changed

- `web-engineer` and `unreal-engineer` wait for CI with a blocking call or notifications, never a sleep loop, confirm checks on the head commit, and merge only when asked.
- Working with agents: the pull request section explains merging on green and continuing, and why a "CI passed" comment is a signal, not proof. The adoption guide shows how to add the status job.

## [1.0.4] - 2026-10-05

Pull request: #73.

### Changed

- `format-on-edit` formats the files edited in a turn once, when the turn ends (Stop, or SubagentStop for a subagent's own edits), instead of rewriting each file straight after every edit. Files no longer change under the agent mid-turn, so a later Edit's `old_string` still matches. Whether this lowers hook cost is measured in the next eval round; the Phase 8 fixtures had no formatter, so formatting did not cause the cost found there.

## [1.0.3] - 2026-10-05

Pull request: #72.

### Added

- Owned paths (#47), opt-in. A project that lists the paths it owns in `AGENTS.md` under `## Owned paths` gets:
  - the `guard-owned-paths` hook, which asks before an edit to a project file outside the list;
  - an `owned-paths` job in the reusable `rfr-guards.yml` (`owned-paths: true`), which fails a pull request that changes files outside the list.

  Projects without the section see no change.

## [1.0.2] - 2026-10-05

Pull request: #68.

### Changed

- `guard-commands` asks before an Unreal editor run whose `-ExecCmds` list does not include `Quit`, which leaves the editor running after its commands finish (#56).

## [1.0.1] - 2026-10-05

Pull request: #67.

Responses to the second external review (#47 to #64). None of the proposals had eval evidence, so none became a new rule. The advice went into the practice guides, skills, and agents, and two rules gained a clarifying sentence.

### Changed

- WA-006: examples from blogs, forums, or other versions do not count as a check (#54).
- CODE-001: prefer code the shipped product uses over prototypes, samples, or deprecated code, and say if the followed file may be legacy (#48).
- `plan-feature` spec template: named test cases, the APIs used and where each was checked, and assumptions that could be wrong (#49).
- `write-adr` offers an ADR before drafting one unasked (#62). `web-engineer` and `unreal-engineer` return new scope, architectural choices, and irreversible actions to the caller (#59).
- Practice guides:
  - Working with agents: evidence for claims (#48, #53, #54, and the dependency and fake advice from #28 and #29), delegating to subagents (#58, #59), ownership boundaries (#47), phases (#60), one question or a stated assumption (#61), decisions linked to ADRs (#62), glossaries (#63), and reviewer severities (#64).
  - Testing: test clusters for expensive runs (#50), validation-first for content and data (#51), and finding the existing test harness (#52).
  - Unreal: ending `-ExecCmds` with `Quit` (#56), `NotValidated` results (#51), and driving the editor MCP serially (#55).

## [1.0.0] - 2026-10-05

Pull request: #66.

First stable release. The rule set, the `rfr-core` plugin, and the template repos are complete for the scope in `PLAN.md`: a stack-independent core, six stack packs (Unreal plugin, TypeScript, web platform, React and Next.js, Node services, static sites), six agents, ten skills, default hooks, reusable CI workflows, and three template repos. Both reference projects, a Next.js web app and an Unreal plugin, were built from the templates by the agents and pass their own checks. From this release on, a stricter or new MUST rule, or a removed or renamed rule, needs a major version (see [docs/maintenance.md](docs/maintenance.md)).

### Changed

- No rule changes since 0.13.2. `PLAN.md` records Phases 0 to 7 and 9 as complete; the remaining Phase 8 evals continue after 1.0.

## [0.13.2] - 2026-10-05

Pull request: #65.

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
