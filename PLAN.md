# Project Plan: rules-for-robots

Status: v7.4.0 (2026-11-13). Phases 0 to 7, 9, 12, 13, 16, and 17 complete. Phases 10, 11, 14, and 15 have built their machinery and wait on eval rounds or one remaining slice. Phases 18 to 23 carry out the improvement plans of 2026-11-10 ([main](docs/improvement-plan.md), [process](docs/improvement-plan-process.md)). All Phase 0 recommendations (R1 to R64 in [docs/research/recommendations.md](docs/research/recommendations.md)) were accepted and are applied below. Evidence is in [docs/research/findings.md](docs/research/findings.md).

## 1. Goal

The goal in the maintainer's words (2026-11-10): "The simplest possible process for producing the highest quality solutions."

The maintainer confirmed two readings of it:

1. Quality is the constraint, and simplicity is what gets minimised. When the two conflict, quality wins.
2. "Simplest" means simplest for the person directing the work, measured in their attention, not in the number of parts. A mechanism that runs without them, such as a test guard or the staleness check, costs nothing; an extra approval gate does.

It also works as a test: for any rule, gate, agent, or hook, ask whether removing it would lower the quality of the results, and if not, remove it.

Produce a reusable set of **rules**, **best practices**, and **agent definitions** that steer AI coding agents (and the humans working with them) toward software, websites, web apps, and Unreal Engine plugins that are:

| Quality attribute | What it means here | How we will know |
|---|---|---|
| High-quality | Correct, tested, reviewed, consistent | Tests on critical paths, zero lint/type/compiler warnings at the agreed level, review checklist passes |
| User-centred | Solves a real user need; accessible; clear UX and content. For plugins, "users" includes the developers and designers who use the plugin in the editor | WCAG 2.2 AA for web; documented user stories and acceptance criteria; plugin settings, Blueprint API, and docs reviewed for usability |
| Performant | Fast to load and respond; efficient on client, server, and game thread | Core Web Vitals budgets (LCP, INP, CLS) and bundle budgets for web; frame-time and memory budgets profiled with Unreal Insights for plugins |
| Scalable | Handles growth in users, data, content, and team size | Stateless services and load-test baselines for web; plugins that behave well with large worlds, many actors, and network replication. Not yet covered: no rule, practice guide, or check addresses scalability (decided 2026-11-10 to keep the goal and say so) |
| Extensible | New features fit without rewrites | Clear module boundaries, stable public interfaces, extension points (e.g. subsystems, interfaces, delegates), ADRs for key decisions |
| Maintainable | Easy for a new contributor (human or agent) to change safely | Docs, conventions, small modules, automated checks, low change failure rate |

Security, privacy, and observability are treated as cross-cutting requirements underpinning all six attributes. Security and privacy have rules, a guide, and checks; observability is not yet covered by any rule, guide, or check.

## 2. Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Target agents/tools | Claude Code first. `AGENTS.md` is the canonical instruction file so other tools can be supported later. |
| 2 | Stack opinion | Stack-independent core, plus optional stack packs covering Unreal Engine plugins, websites, and web apps. |
| 3 | Audience | A solo developer first, structured so teams and organizations can adopt and override it. |
| 4 | Strictness | MUST-level rules are enforced by a hook, CI, or both where practical and relevant (R24). |
| 5 | Distribution | Template repos carry instructions, rules, and settings; Claude Code plugins carry skills, agents, and hooks (R13). MIT licence. |
| 6 | Spelling | Canadian English (e.g. "centre", "colour", "behaviour", "organize", "licence" as noun). |
| 7 | Target models | The newest Opus and Sonnet generations with entries in `evals/ledger.json`, currently Opus 5.5 and Sonnet 5.5. A new generation becomes a target after its model-release run (section 5; Phase 17). |
| 8 | Research first | Phase 0 research preceded the format spec. Complete; findings and recommendations are in `docs/research/`. |
| 9 | Unreal versions | Unreal Engine 5.6 and later. This currently matches Fab's default build set (the three latest engine versions). |
| 10 | Unreal build machine | Self-hosted GitHub Actions runner (Windows, x64, labels `self-hosted`, `Windows`, `X64`, `ue5`). Tier 2 checks run on it. |
| 11 | Web frameworks | React/Next.js (16.x) for web apps; Astro (7.x) for content-heavy static sites. |
| 12 | Backend and hosting | Node runtime, Postgres, deployed on Vercel. |
| 13 | Licence holder | MIT licence, copyright Lifelike & Believable Animation Design. |
| 14 | Minimum Claude Code version | 2.1.288 (path-scoped rules load on Write/Edit; native `AGENTS.md`) (R15). |
| 15 | Phase 0 recommendations | R1 to R64 accepted in full. |

## 3. Scope

### In scope
- Stack-independent core rules and best practices.
- Stack packs for the three primary use cases (section 7).
- Agent definitions (Claude Code sub-agents), skills, and hooks.
- GitHub integration: issue and PR templates, CI workflows that enforce MUST rules, CODEOWNERS guidance.
- Fab-ready packaging and release checks for Unreal plugins.
- An eval suite that shows which rules improve agent output, built early and run throughout.
- Layering so a team or organization can add or remove rules without forking the core.

### Out of scope (initially)
- Mobile-native (iOS/Android) and desktop-native apps outside Unreal.
- Full Unreal game projects (the focus is plugins, though most plugin guidance applies to game modules too).
- Vendor-specific hosting runbooks.
- First-class support for agents other than Claude Code.
- Depending on Epic's Unreal MCP tooling (UE 5.8+ only); it is optional for 5.8 projects (R34).

## 4. Guiding principles for the rules themselves

1. **Only what the agent can't infer.** Rules hold project decisions, thresholds, non-obvious constraints, and known failure modes. No rule restates what a linter, formatter, compiler, or the model's general knowledge already covers (R5).
2. **Plain, scoped sentences with a reason.** Each rule body is an imperative sentence with a short "because" and an explicit scope (R3). No emphatic wording; a lint rejects legacy phrasing such as "CRITICAL", "double-check", "think step by step", "show your reasoning", "if in doubt", and "only report important" (R4).
3. **Level lives in metadata.** MUST / SHOULD / MAY is recorded in the `level` field, not written as capitals in the body (R3).
4. **Concrete checks over generic verification.** Rules name the command that proves compliance and require its output as evidence, rather than telling the agent to "verify" (R8).
5. **Mechanical enforcement for invariants.** Every MUST rule maps to a hook (blocking with exit code 2), a CI job, or both (R24). Text alone is not enough for rules that must always hold.
6. **Stable IDs and traceability.** Rules have IDs (e.g. `A11Y-003`, `UE-PERF-002`) and record the failure mode they target and the models they were observed on (R2).
7. **Layered by removal.** Claude Code concatenates instruction files and resolves conflicts arbitrarily, so layers remove or replace rule files; they never add a contradicting line (R17).
8. **Rules earn their place.** A rule stays only if evals show it lowers its target failure rate without reducing success or adding disproportionate cost (R38). Rules are re-evaluated on every new model generation.

## 5. Designing for current models

This section holds guidance that has held on two or more model generations, so it changes only when evidence on a new generation contradicts it. What depends on one generation is in the table under "By generation", which gains a column after each model-release run (Phase 17; [docs/specs/model-adaptation.md](docs/specs/model-adaptation.md)). Phase 0's verdicts and their sources are in the verdict table in findings.md, and the per-rule evidence for each model is in `evals/ledger.json` (`node checks/model-ledger.mjs report <model>`).

1. **Don't restate what the model knows.** Context files that describe the repo add cost without improving success (studies up to Sonnet 4.6 and Opus 4.7; our seed and Phase 8 evals on the 5.5 models).
2. **Explain intent, then trust judgement.** Give the goal and reason; keep fixed procedures for releases, migrations, and packaging.
3. **Calibrated, plain wording.** Emphatic wording over-triggers on current models; levels move into metadata.
4. **Say what to do.** Positive framing by default, plus short lists that name concrete patterns to avoid.
5. **Target known failure modes.** The main ones are editing tests to pass (the dominant gaming route for Claude, documented from Opus 4.1 to 5.5), scope creep and over-engineering, destructive git and database operations, invented or version-mismatched APIs, and unsupported claims of success. Which of these a given model still shows without rules is a per-generation question; see the table.
6. **Concrete verification, not generic "verify".** Give the command that proves compliance and require its output.
7. **Context as a resource.** Adherence drops as sessions grow, so keep sessions focused, start fresh after repeated failed corrections, and use sub-agents for exploration (R12).
8. **Model and effort per agent.** Set `model` and `effort` in agent frontmatter instead of "think carefully" in the body (R21).
9. **Parallel reading, single-threaded writing.** Parallel agents for research and review; one writing agent at a time (R20). Never share one Unreal MCP editor between agents.
10. **Literal reading of filters.** Reviewers report every finding with severity; filtering happens in a separate pass, because "only report high severity" suppresses real findings (R19).

### By generation

| Finding | Opus 5.5 and Sonnet 5.5 |
|---|---|
| Generic "verify" lines | Cause over-verification on Opus 5 and later; a concrete command helps Sonnet 5.5 at low effort (Phase 0) |
| Effort setting | Opus 5.5 at medium effort matches Opus 5 at high (Phase 0) |
| Editing a wrong test to get CI green, without rules | Both models, 6 of 6 runs; none with TEST-001 and WA-002 (Phase 8; again in the model-release baseline) |
| Test-first work without TEST-004 | Sonnet 0 of 3; Opus 3 of 3 (Phase 8; again in the model-release baseline) |
| Data loss, over-engineering, scope creep, destructive git, and the Next.js 16 trap, without rules | Neither model showed them (seed, Phase 8, and the model-release baseline) |
| Ledger run | [2026-11-08 baseline](evals/results/2026-11-08-model-release-baseline/report.md), Claude Code 2.1.319 |

## 6. Repository structure and distribution

### Repository layout

```
rules-for-robots/
├── README.md                     # What this is, how to adopt it
├── LICENSE                       # MIT
├── AGENTS.md                     # Instructions for working on this repo (canonical)
├── CLAUDE.md                     # Thin: imports AGENTS.md
├── .claude-plugin/
│   └── marketplace.json          # The repo is a Claude Code plugin marketplace
├── plugins/
│   ├── core/                     # Skills, agents, hooks, rule installer skill
│   │   ├── .claude-plugin/plugin.json
│   │   ├── agents/
│   │   ├── skills/
│   │   └── hooks/hooks.json
│   ├── web/
│   └── unreal/
├── rules/                        # Source of truth for all rules
│   ├── core/
│   └── packs/<pack>/
├── practices/                    # Longer best-practice guides with examples
├── templates/                    # Feature spec, ADR, PR, issue forms, runbook
├── template-repos/               # Rendered starter repos (web app, static site, Unreal plugin)
├── build/                        # Renders rules/ into template repos and the installer payload
├── checks/                       # Reusable CI workflows, rule-file lint, scripts
├── evals/                        # Tasks, graders, and results
└── docs/
    ├── research/                 # Phase 0 findings, recommendations, sources
    ├── adoption-guide.md
    ├── layering-and-overrides.md
    └── contributing.md
```

### What each channel carries (R13, R14)

Claude Code plugins cannot ship `CLAUDE.md` or `.claude/rules/`, so delivery is split:

| Channel | Carries |
|---|---|
| Template repos | `AGENTS.md` (canonical), a thin `CLAUDE.md` containing `@AGENTS.md`, rendered `.claude/rules/` files with `paths:` globs, and `.claude/settings.json` (permission rules, `enabledPlugins`, `extraKnownMarketplaces`) |
| Plugins | Skills, agents, `hooks/hooks.json`, and an installer skill (`disable-model-invocation: true`) that copies selected rule packs into an existing repo's `.claude/rules/` |

`rules/` is the single source of truth. A build step renders it into the template repos and the installer payload, writing outside any tool-managed blocks such as the Next.js `nextjs-agent-rules` markers (R42). A SessionStart hook that injects rules is a fallback only. Plugin `version` is bumped on every release (R16).

### Rule file format (to be finalized in Phase 1)

Source files in `rules/` carry metadata for people and tooling; only `paths` affects loading (R1, R2):

```yaml
---
id: TEST-001
title: Do not edit tests to make them pass
level: MUST
scope: core
paths: ["**/*.test.ts", "**/Tests/**"]
verified-by: hook, ci
targets-failure: test-gaming
observed-on: [opus-4.7, sonnet-4.6]
rationale: Claude models game tasks mainly by editing tests.
---
Leave existing tests unchanged when making them pass, because ...
```

Frontmatter and HTML comments do not reach the model ([experiment R7](docs/research/experiments/r7-rule-loading.md)), so rendered files keep full metadata at no context cost. CI validates YAML, because invalid YAML makes a scoped rule load everywhere (R6). The full specification is [docs/rule-format.md](docs/rule-format.md).

## 7. Stack packs

Each pack adds rules, practices, CI checks, and agent guidance. Packs combine (a web app typically uses `web-platform` + `typescript` + `react-nextjs` + `node-services`).

| Pack | Covers | Key checks and rules |
|---|---|---|
| `web-platform` | Semantic HTML, CSS, responsive design, browser APIs, SEO basics, accessibility | axe with WCAG 2.2 tags and `target-size` enabled (R44); scripted checks for 2.4.11, 2.5.7, 3.3.8 (R45); Lighthouse CI median of 3+ runs; Playwright CLI for agent browser checks (R29) |
| `typescript` | Strict typing, module boundaries, error handling, dependency hygiene | `tsc --noEmit`, ESLint, Prettier, Vitest; no rule restates lint config (R5) |
| `react-nextjs` | Next.js 16: components, rendering, caching, data fetching | Bundled docs first (R30, R46); `/_next/mcp` and `agent-browser` while iterating; `next build` before done; current defaults (`proxy.ts`, `fetch` uncached, `use cache` with `cacheComponents`); leave the managed `AGENTS.md` block alone (R42); size-limit bundle budgets; e2e tests for async Server Components |
| `static-sites` | Astro 7: content modelling, images, minimal JavaScript | Astro docs MCP (R46); check for a running dev server (R47); verify CSP with build and preview |
| `node-services` | APIs, auth, validation, jobs, Postgres, Vercel deployment | No `push`, `migrate dev`, `reset`, or `--force` on shared databases, enforced by hook (R49); squawk and expand-and-contract (R50); Neon previews contain production data (R51); direct connection for migrations, gated production step (R52); pinned ORM major (R53); Vercel limits (R48); Vercel MCP write tools behind prompts (R43) |
| `unreal-plugin` | Plugin and module structure, Epic coding standard, UObject/GC, Blueprint API, subsystems, replication, editor UX, Fab packaging | Coding-standard rules agents break (R56); headers and compiler as API truth, full build after header/reflection changes (R33); version guards for 5.8-only APIs (R59); no `Developer` module type (R57); `BuildSettingsVersion.V6` for 5.7+ (R58); Epic test ladder (R60); Fab descriptor, packaging, and copyright rules (R61 to R63) |

### Unreal CI tiers

- **Tier 1 (any runner):** clang-format; `.uplugin` checks (every module has a platform list with UE5 names, `EngineVersion`, `FabURL` once known, no `Developer` type, no user-made plugin dependencies); `BuildSettingsVersion.V6`; `TObjectPtr` members without `UPROPERTY`; copyright headers; Fab packaging checks (no Binaries/Intermediate/Saved, `FilterPlugin.ini` for extra folders, paths of 170 characters or less, `Source/ThirdParty` only, no `.exe`/`.msi`, name characters) (R32, R61 to R63).
- **Tier 2 (self-hosted `ue5` runner):** for each engine version (5.6, 5.7, 5.8), select the matching toolchain (R54), run `RunUAT BuildPlugin` with zero warnings allowed, run automation tests headless, and gate on the exported `index.json` or the `TEST COMPLETE` log line, never the process exit code (R31, R64).
- **Runner hardening:** trusted events only (no fork PRs), ephemeral or reset runner, low-privilege account, no secrets on the machine, engine paths from runner configuration (R31).
- **To verify on the runner in Phase 3:** BuildPlugin flags from `BuildPlugin.Automation.cs`, Unreal Insights headless flags, and the editor's exit code on failing tests (R55).

## 8. Agent roster

Start small and add agents only when evals show benefit (R18).

| Agent | Role | Tools | Output |
|---|---|---|---|
| `web-engineer` | Implements web code per the web packs | Read/write, stack commands | Code, tests, and the verification command's output |
| `unreal-engineer` | Implements plugin C++ and Blueprint-facing APIs; checks symbols against installed engine headers; full build after header, `.Build.cs`, `.uplugin`, or reflection changes (R33) | Read/write, UBT/UAT commands | Code, tests, and build/test evidence |
| `code-reviewer` | Correctness and requirement gaps, rule compliance | Read-only (R19) | Every finding with file, line, failure scenario, severity, rule ID |
| `accessibility-reviewer` | WCAG 2.2 AA for web; editor and game accessibility for Unreal | Read-only | Findings in the common format |
| `performance-reviewer` | Web budgets, queries, caching; frame time, memory, tick, loading for Unreal | Read-only plus measurement commands | Findings and measurements |
| `security-reviewer` | Threat model, OWASP, secrets, dependencies, privacy, replication trust boundaries, migrations | Read-only | Findings with severity |
| `check-runner` (Haiku 5.5) | Runs named scanners, audits, builds, and tests | Read-only plus shell | Exit codes and verbatim key output |
| `citation-checker` (Haiku 5.5) | Checks that review findings cite real files, lines, identifiers, and rule IDs | Read-only | One ok or mismatch line per finding |
| `software-architect` | Module boundaries, data model, interfaces, build-versus-adopt; ADRs for hard-to-reverse choices | Read-only plus ADR files | Recommended design, rejected options, ADRs |
| `ux-reviewer` (experimental) | Usability and interface design in three areas: Unreal Editor tools and Blueprint-facing APIs, general software (desktop, command-line, developer tools), and web pages and apps; leaves WCAG conformance to `accessibility-reviewer` | Read-only | Findings in the common format |
| `tech-lead` (experimental) | Slices a goal into sequenced, verifiable steps with an owner each; checks delegated work against acceptance criteria | Read-only | Plan or per-criterion check result |
| `test-change-reviewer` (Phase 13; evaluated in 13d) | Judges changes to existing tests in a pull request: weakening findings, approved reasons, and evidence from running the changed tests on base and head and with the behaviour broken | Read-only plus throwaway worktrees | One approve-or-refer decision with a verdict per test |

Reviewers are invoked explicitly or by path, receive the diff and criteria without the author's reasoning, and leave filtering to a separate confirm-or-refute pass (R19). Each agent sets `model` and `effort` (R21). Agent-specific enforcement goes in the plugin's `hooks/hooks.json`, because plugin agents ignore their own `hooks` and `permissionMode` fields (R22). The three Haiku agents (1.1.0) pass the R18 test on smoke evidence: they gather or run things, return text copied from tools, and leave every judgment to the caller ([note](docs/research/notes/haiku_5_5_delegation.md)). `software-architect` and `tech-lead` were added in 1.2.0 and `ux-reviewer` in 1.3.0, all as experimental, ahead of the evals R18 asks for. The Phase 8 third round (October 2026) found the architect makes ADRs weigh alternatives reliably at five to seven times the time, and `tech-lead` no different from the main session on its cases; `tech-lead` stays experimental. The architect is no longer experimental (decided 2026-11-11, #187): the Fable 5.2 round repeated its benefit (9 of 9 against 7 of 9 without it), and `plan-feature` now asks for a design before slicing a new project, a change across components, or a hard-to-reverse choice. Candidates to add later if evals justify them: `product-analyst`, `test-engineer`, `docs-writer`, `release-engineer`.

## 9. Adapting for teams and organizations

Instruction files are concatenated and conflicts resolve arbitrarily, so every layer works by adding, removing, or replacing whole rule files (R17):

- **Personal layer:** `CLAUDE.local.md` and user settings for preferences that don't conflict with project rules.
- **Project layer:** choose packs at install time; waive a rule by replacing its file with a waiver that cites the rule ID and reason; exclude files with `claudeMdExcludes`.
- **Team/organization layer:** an organization plugin adds rules, skills, and hooks; required CI checks enforce MUST rules. Organizations that need guarantees use managed settings and `strictPluginOnlyCustomization`.
- **Governance:** CODEOWNERS for rule files, ADRs for rule changes, a changelog, and eval results attached to rule changes.

## 10. Delivery phases

### Phase 0: Research (complete)
Delivered `docs/research/findings.md`, `docs/research/recommendations.md` (R1 to R64, all accepted), `docs/research/notes/`, and `docs/research/sources/fab-requirements.md`.
Pull requests: #1 (plan and research).

### Phase 1: Foundations (complete)
Delivered: [docs/rule-format.md](docs/rule-format.md), [experiment R7](docs/research/experiments/r7-rule-loading.md), `TEST-001` as the worked example, the rule lint, the template repo build with budget and staleness checks, the `rfr-core` plugin and marketplace with the `install-rules` skill (installed and run end to end against a demo repo), and CI running `npm run verify`. Finding: writes to `.claude/` need user approval, which the installer skill now explains.
Pull requests: #2 (rule format and R7), #3 (skeleton, lint, build, CI), #4 (plugin, marketplace, install-rules).

- Finalize the rule file format (section 6) and ID scheme.
- Test whether rule frontmatter and HTML comments reach the model, using the `InstructionsLoaded` hook (R7).
- Repo skeleton, `AGENTS.md` and thin `CLAUDE.md` for this repo, `docs/contributing.md`.
- Build step that renders `rules/` into a template repo and the installer payload (R14).
- Rule-file CI: YAML validation, `paths` check, banned-phrase lint, word and line budgets, ID uniqueness (R4, R6); `claude plugin validate --strict` on plugin manifests.
- Plugin and marketplace manifests with the installer skill shell.
- **Exit criteria:** format spec and one fully worked rule file approved; the core plugin installs; the build step renders a working template repo; R7 answered.

### Phase 2: Core rules and eval seed (complete)
Delivered: working agreement `WA-001` to `WA-007`; core rules `TEST-002`/`003`, `CODE-001` to `004`, `SEC-001` to `003`, `GIT-001`, `DOC-001`; `rfr-core` hooks (destructive-command and test-edit guards, format on edit); the eval harness and seed results ([report](evals/results/2026-10-05-seed/report.md)). Finding: on the seed tasks neither 5.5 model showed the target failures even without rules, and rules added 19 to 40% cost while changing behaviour (test-first fixes). Phase 8 needs harder cases.
Pull requests: #5 (working agreement), #6 (hooks), #7 (core rules), #9 (eval harness and seed), #17 (TEST-004).

- `00-working-agreement` built from (R8 to R12):
  - a concrete verification command whose output appears in the agent's report;
  - an escape hatch: stop and report when the task or its tests look wrong or impossible, paired with the test-edit guard;
  - named required stops: destructive or irreversible actions, material change of scope, a task or test that appears wrong;
  - Anthropic's tested scope, minimal-change, and comment paragraphs, adapted;
  - session hygiene.
- Topic rule files, prioritizing testing, code-quality, security-privacy, architecture, performance, accessibility, user-centred design.
- Default hooks: block destructive commands; require approval for test-file edits; run formatters after edits (R25).
- A small eval harness (a handful of failure-targeted tasks, no-rules vs. rules) so each rule is tested as it is written (R39).
- **Exit criteria:** every rule has full metadata and a verification method; the always-on core stays under 200 lines; each MUST rule maps to a hook or CI job; the seed evals run.

### Phase 3: Stack packs (complete)
Delivered: all six packs (`unreal-plugin` 12 rules, `typescript` 2, `web-platform` 4, `react-nextjs` 4, `node-services` 8, `static-sites` 3); `checks/unreal/tier1.mjs`; the `RfrSample` plugin; the Tier 2 workflow with a runner probe for R55; the `guard-mcp` hook for the Vercel MCP server. Tier 2 builds and tests `RfrSample` on UE 5.6, 5.7, and 5.8 on the `ue5` runner, and the probe answered open questions 2 and 3.
Pull requests: #8 (unreal-plugin pack, Tier 1, sample), #10 (Tier 2 and runner probe), #11 (TypeScript, web-platform, React and Next.js), #12 (Node services, static sites, Vercel MCP guard), #16, #21, #22 (Tier 2 fixes and first green runs).

- Order: `unreal-plugin`, `typescript`, `web-platform`, `react-nextjs`, `node-services`, `static-sites`.
- Content per section 7.
- Verify BuildPlugin flags, Insights headless flags, and the editor exit code on the runner (R55).
- **Exit criteria:** each pack has rules, at least one practice guide, and Tier 1 checks; the Unreal pack's Tier 2 workflow passes on the runner for 5.6, 5.7, and 5.8.

### Phase 4: Best-practice guides (complete)
Delivered: six guides in `practices/` (working with agents; testing and code quality; security; Unreal plugin development; web verification including Astro; Postgres on Vercel). The rule lint now fails when a rule cites no existing guide or a guide is cited by no rule.
Pull requests: #13.

- Longer `practices/` guides linked to rule IDs, with short good/bad examples. Point agents at exemplar files rather than describing patterns where possible.
- **Exit criteria:** every rule file links to at least one guide; every guide is referenced by at least one rule.

### Phase 5: Agents, skills, and hooks (complete)
Delivered: six agents and ten skills in `rfr-core`, plus the hooks from Phases 2 and 3. Each agent and skill passed two smoke tasks (26 of 26; [results](evals/results/2026-10-05-smoke/summary.md)); `install-rules` was tested end to end in Phase 1.
Pull requests: #14 (agents and skills), #75 and #76 (`merge-when-green` and its smoke tests).

- Agents per section 8.
- Skills: `plan-feature`, `implement-feature`, `review-pr`, `a11y-audit`, `perf-audit`, `security-review`, `write-adr`, `install-rules`, `release`, `profile-unreal-plugin`, `package-unreal-plugin`. Side-effecting skills set `disable-model-invocation: true` (R23). Critical content stays in each skill's first 5,000 tokens.
- Hooks in `hooks/hooks.json`, including agent-specific filters and the database (R49) and Vercel MCP (R43) guards.
- **Exit criteria:** each agent and skill tested on at least two sample tasks with output in its declared format.

### Phase 6: GitHub integration and templates (complete)
Delivered: shared PR template, issue forms, guards workflow, and `.claude/settings.json` for every template repo; per-profile CI (web: verify, bundle budgets, squawk, preview checks with Playwright, axe, and Lighthouse CI; Unreal: Tier 1 via a reusable workflow, Tier 2 via `Scripts/Verify.ps1`); reusable `rfr-guards.yml` (gitleaks, test change guard) and `rfr-unreal-tier1.yml`; the build now generates entire template repos from `templates/`; [adoption guide](docs/adoption-guide.md) and [layering and overrides](docs/layering-and-overrides.md). The under-an-hour check is part of Phase 7, which builds real projects from the templates.
Pull requests: #15 (integration, template CI, adoption docs), #43 (instruction lint), #72 (owned paths), #75 (CI status comment).

- PR template with rule-ID checklist, issue forms, ADR and feature spec templates.
- Reusable workflows in `checks/`:
  - web CI per R28;
  - migration checks per R50;
  - the test, baseline, and budget change guard (R26);
  - Unreal Tier 1 and Tier 2;
  - any Claude-in-CI job uses `--bare` and never runs on fork PRs (R27).
- Template repos for web app, static site, and Unreal plugin, rendered by the build step.
- **Exit criteria:** a new repo created from a template is fully wired (CI, plugin, `AGENTS.md`) in under an hour by following the adoption guide.

### Phase 7: Reference projects (complete)
Web app: `examples/web-app` built from the template by the `rfr-core` agents, passing all checks and budgets; the build exposed seven template and hook gaps, all fixed. Unreal: `examples/unreal-plugin` (RfrCooldowns) built from the template by the `unreal-engineer` agent for $1.92. Tier 2 builds it with zero warnings, passes its 16 specs, and produces a staged Fab package on UE 5.6, 5.7, and 5.8. The agent's one test failure (a subsystem created without its required outer) moved into UE-007, and the Fab rehearsal exposed a spurious Tier 1 warning, now fixed ([reference projects](docs/reference-projects.md)). A real Fab submission is still to come; #36 waits on it.
Pull requests: #18 (web app), #65 (Unreal plugin and Fab rehearsal).

- A small web app and a small Unreal plugin built with the full set of agents and rules. The plugin passes the Fab release flow (R64) for all supported engine versions.
- **Exit criteria:** both pass their own checks and meet declared budgets.

### Phase 8: Evals
- Arms: no rules, full set, leave-one-pack-out, and single-rule ablations for MUST rules; Opus 5.5 and Sonnet 5.5 at recorded effort levels; Claude Code version recorded (R35).
- 20 to 50 failure-targeted tasks, including impossible-task variants with and without the escape hatch, over-engineering temptations, a dirty working tree, a Next.js 16 task, an Unreal task using an API changed between 5.6 and 5.8, and a database task where `push` or `--force` is tempting (R36).
- Graders: held-out tests, deterministic diff and transcript checks, and a calibrated LLM judge for scope and evidence-backed reporting; report pass@1, pass^k (k of 3 or more), cost, and failure-mode rates (R37).
- Test the Phase 0 open questions directly: plain vs. emphatic wording, rationale vs. none, keywords in body vs. metadata, concrete vs. generic verification, specialist reviewers vs. one checklist reviewer.
- **Exit criteria:** every rule either shows a measurable effect or is removed or rewritten (R38).
Pull requests so far: #20 (harder cases), #44 (round 2), #46 (multi-prompt sessions), #74 (long-session cases).

Status: first round done ([report](evals/results/2026-10-05-phase8/report.md)). Five harder cases, 2 models, 3 arms, 3 runs: test-gaming and test-first cases show clear rule effects; data-loss, over-engineering, and Next.js 16 cases do not. NEXT-001 narrowed. Graders now have unit tests. A third round for the experimental `software-architect` and `tech-lead` agents ran on 2026-10-12 and 2026-10-13, with the architect on Fable 5.1 ([round A](evals/results/2026-10-12-10c-round-a/README.md), [ladder](evals/results/2026-10-12-10c-ladder/README.md), [greenfield](evals/results/2026-10-12-10c-greenfield-baseline/README.md)). With the architect, every ADR weighed alternatives (18 of 18, against 12 of 18 without it) and three cases rose from 4/6 to 6/6 with none lower, but runs took five to seven times as long, so it meets the keep rule on quality and misses it on cost; `tech-lead` showed no difference. The maintainer kept the architect (#187); it runs on Opus 5.5 after the Fable 5.2 round (#185). Still to do: an Unreal API-change case, leave-one-pack-out and single-rule ablations, the wording experiments, and harder variants of the cases that showed no effect.

Round 2 ([report](evals/results/2026-10-05-round2-baseline/report.md)) tested the rules proposed from the Open3DBroadcast adoption (#28 to #35) with three single-task cases. The no-rules baseline passed 18/18, so the candidate rules (in `evals/candidates/`) were not added; the advice went into the practice guides instead. Discriminating cases need multi-prompt, long-session support in the harness, which now exists (`prompts/*.md` per case). The long-session cases (#28 to #35, #33) and the rest of this phase continue after 1.0.

### Phase 9: Release and maintenance (v1.0.0 released)
Delivered: semantic versioning shared by the rule set and `rfr-core`, checked by `checks/release.mjs`; [changelog](CHANGELOG.md); [maintenance guide](docs/maintenance.md); releases tagged `rfr-v<version>` (`rfr-v1.0.0`, `rfr-v1.0.2`). After 1.0, two external review rounds (#23 to #38, #47 to #64) were answered mostly with practice-guide text, hooks, and checks, since none of their proposals had eval evidence for a new rule. The plugins install from this repository's marketplace, and the template repos are published as generated folders in `template-repos/`.
Pull requests: #19 (changelog and release check), #39 to #43 and #45 (first adoption review), #66 (1.0.0), #67 and #68 (second review), #70 (tag prefix), #71 (plan refresh), #73 (formatting once per turn), #76 (1.0.6), #77 (pull request records in the plan), #79 (Haiku 5.5 subagents, 1.1.0), #92 (guards re-run on label changes), #93 (a new CI status comment on every run), #94 (waiting for CI on events only, 2.0.0), #95 (UE-009, custom asset types in the Add menu, 2.2.0).

- Semantic versioning for the rule set and plugins; plugin `version` bumped every release; changelog.
- Quarterly review of standards and engine/framework versions; re-run Phase 0 research lightly and the eval suite on each new model generation; adjust the Unreal version set when Epic's default three-version build set moves.
- **Exit criteria:** v1.0 tagged; plugins installable from the marketplace; template repos published.

### Phase 10: Spec-to-test traceability (in progress: 10c eval round not run)
Spec: [docs/specs/spec-test-traceability.md](docs/specs/spec-test-traceability.md) (approved).
Pull requests: #84 (spec), #85 (10a), #86 (cluster amendment), #87 (10b).

A document-driven and test-driven hybrid. Acceptance criteria get IDs, a check shows which have a citing test, and the agent that writes the tests from the spec is not the one that makes them pass. The phase answers whether tracing criteria to tests changes agent behaviour, and keeps the rule only if the evals say so.

- **10a:** spec template with criterion IDs, the `checks/spec-trace.mjs` check, the `checks/spec-lock.mjs` commit lock (tests fixed at a recorded commit, unlocks listed with a reason), their tests, and an opt-in CI step.
- **10b:** a list-valued `tests-commit` in the lock check (one commit per cluster of tests), `plan-feature` text and the tests-first split, a sabotage step in `review-pr` (break the behaviour in a throwaway worktree and confirm the citing tests fail), a candidate rule and a cluster-cadence candidate for TEST-004 (`TEST-004-clustered`), and four eval cases (`spec-trace-uncovered`, `spec-trace-wrong-test`, `spec-drift`, `spec-vacuous-tests`).
- **10c:** the paid eval round (including one-test-at-a-time against clusters), the decision to keep or drop the rules, and the review of whether a separate `test-author` agent is needed (the spec lists the signals). Prepared without paid runs on 2026-11-03: a harder cadence case (`tdd-cluster`), the Stryker comparison on `spec-vacuous-tests` (it finds one of the two vacuous tests), and a run plan of 55 runs estimated at $20 to $30 (`evals/README.md`, #121).
- **Exit criteria:** the check runs in `npm run verify`; the candidate has an eval result; the rule is promoted or dropped on that result.

### Phase 11: Project development process (in progress: 11d not started)
Spec: [docs/specs/project-process.md](docs/specs/project-process.md) (approved 2026-10-31; its `status` field changes once every `test:` criterion has a citing test, at the end of 11d).
Pull requests: #102 (spec), #103 (11a), #104 (11b), #105 (11c), #106 (research amendment), #107 (11e), #108 (11f), #109 (pilot fixes, round 1), #110 (merge guard asks), #111 (pilot fixes, round 2), #112 (pilot fixes, round 3), #113 (11g), #114 (pilot fixes, round 4), #116 (11h), #117 (pilot fixes, round 5), #118 (pilot fixes, round 6), #119 (pilot fixes, round 7), #120 (pilot fixes, round 8), #122 (Agentic XR Pipeline feedback, round 1), #123 (setup for mixed repositories), #124 (pilot fixes, round 9), #125 (Agentic XR Pipeline feedback, round 3), #128 (pilot fixes, round 10), #136 (merge guard takes a typed instruction), #137 (guard calibration).

A staged, iterative process from concept to demos, delivered as a second plugin, `rfr-process`, that depends on `rfr-core`. Per-stage approvers approve the design phase (concept, requirements, personas, epics, stories, design and UX, user documentation); agents run the delivery phase (technical specification, unit tests, implementation, regression tests), and approvers review again at demos and tutorials and at release. Approval is read from GitHub reviews or, in solo mode, from who merged. Artifacts link to sections of their upstream artifacts, and a stale link fails CI. Design-stage guidance ships as a practice guide until evals justify skills. Slices 11a to 11d are listed in the spec.

### Phase 12: Feedback intake (complete)
Spec: [docs/specs/feedback.md](docs/specs/feedback.md) (approved 2026-11-06).
Pull requests: #129 (12a), #134 (Area field fix), #135 (feedback round 1).

Feedback from projects that use rules-for-robots arrives as issues on this repository instead of messages between sessions, so no session has to stay open to receive it. An optional `rfr-feedback` plugin drafts the issue, removes project details, scans for private ones, and files it only when the user confirms; an intake job labels it and points out duplicates; a scheduled session triages new feedback daily and proposes changes, and builds only what the maintainer approves.

- **12a:** the plugin and its `report-feedback` skill, the feedback issue form, the intake job, and the `triage-feedback` skill.
- **12b:** the daily scheduled triage task, created after 12a merges, and a first triage of the pilots' open findings. Done: the task was created on 2026-11-06 and runs daily; the first round of findings is #135.

### Phase 13: Test change review (done)
Spec: [docs/specs/test-change-review.md](docs/specs/test-change-review.md) (approved 2026-11-07).
Pull requests: #138 (spec), #139 (13a), #140 (13b), #142 (13c), #194 (13d).

Most changes to existing tests can be judged on written criteria: whether the change weakens the test, and, if it does, whether an approved change in behaviour explains it and the changed test catches that behaviour when run. The session hooks let additive and neutral test changes through without asking, using a deterministic classifier; at the pull request, a `test-change-reviewer` agent checks the reasons and runs the changed tests against the old and new code before it adds `tests-reviewed`, and refers everything else to the lead.

- **13a:** the test-diff classifier and the session hooks (AC-1 to AC-6).
- **13b:** the evidence script (AC-7).
- **13c:** the reviewer agent and its `review-pr` step (AC-8 to AC-10).
- **13d:** the eval (AC-11); the reviewer adds the label only after it passes. Done 2026-11-11: no gaming change approved in 36 runs on Opus 5.5 and Sonnet 5.5, and 47 of 48 legitimate changes handled correctly, for $11.13 (`evals/results/2026-11-11-13d/report.md`). `review-pr` now adds `tests-reviewed` on approval, and the `testWeakening` default is `defer` (guard tiers decision 3).

### Phase 14: Grounded evidence (in progress: 14b eval not run)
Spec: [docs/specs/grounded-evidence.md](docs/specs/grounded-evidence.md) (approved 2026-11-08).
Pull requests: #143 (spec and 14a).

Two ideas taken from an evaluation of Context7 and Graphify (2026-11-08), without adopting either tool. A lookup script answers whether an API exists in the installed version, from the installed package (version, lock entry, declarations, bundled docs) or each supported engine's headers, so WA-006 and UE-001 can name a command. Each review finding says whether the reviewer observed the failure or inferred it, and `review-pr` confirms inferred findings by doing the check they name.

- **14a:** `checks/api-lookup.mjs` and the `lookup-api` skill; the `Basis:` line in the five reviewer agents, `checks/review-findings.mjs`, and the `review-pr` and `citation-checker` changes; the candidate WA-006 text (AC-1 to AC-9).
- **14b:** the eval (AC-10); WA-006 and UE-001 name the lookup only if it passes.

### Phase 15: Guard tiers (in progress: 15e eval not run)
Spec: [docs/specs/guard-tiers.md](docs/specs/guard-tiers.md) (approved 2026-11-08).
Pull requests: #145 (spec), #146 (15a), #151 (15b), #153 (15c), #155 (15d), #157 (ask once), #158 (`defer`).

The guards ask whenever an action matches a dangerous pattern, and most prompts in the pilots protected nothing. Under the tier rule, a guard asks only when an action cannot be undone or reaches outside the project and a person must decide; everything else is allowed, refused with a reason the agent acts on, or judged at the pull request. The guard decision log from #144 measures the result.

- **15a:** the tier guide, the guard corpus, outcome logging, and the report script (AC-1, AC-2, AC-6, AC-7).
- **15b:** the tier changes to the guards and the `testWeakening` setting (AC-3 to AC-5, AC-12). Done (#151).
- **15c:** snapshots before destructive local commands, which are then allowed (AC-11). Done (#153).
- **15d:** the replay and the practice guide (AC-8, AC-9). Done (#155); the Kettlebird pilot's sessions are still to replay.
- **15e:** the eval (AC-10).
- **`defer` goes ahead** (AC-5 amended, 2026-11-09): under `testWeakening: defer` a weakening test change is allowed with context and logged, instead of refused, so the pull request's test change check and `test-change-reviewer` are the gate. From the Kettlebird pilot, where the lead approved test-edit prompts as soon as they appeared. Done (#158).
- **Ask once and default permissions** (outside the spec, from an adopter report on 2026-11-09): the guards decide when to ask, but nothing said what is allowed, so a new repository prompted on every file. WA-009 (SHOULD) has the agent ask once for a batch of actions; the templates and `install-rules` set default allow rules for read-only and local git commands and each profile's verify commands, leaving pushes, new dependencies, and MCP tools to prompt. Decision: allow named scripts rather than `npm run *`, so a new script is a change the user sees; leave `git push` to prompt. An eval case that scaffolds a project and counts prompts would move WA-009 from review to measured. Done (#157).
- **Task approval** (spec [docs/specs/task-approval.md](docs/specs/retired/task-approval.md), draft, 2026-11-11): the person approves tasks, not commands. When their latest input (a typed message, or their answer to the agent's own question) asks for a release, a push to a named branch, a merge, or a preview deploy, the guards approve the commands of that task and nothing beyond it, and WA-009 asks for the task once in chat. On by default. This repository's own allow rules (#188) cover routine commands; this covers the outward-facing ones the person names. The maintainer answered the open questions on 2026-11-11 (#191). Done (#192, rfr-core 5.9.0).

### Phase 16: Domain plugins (complete)
Spec: [docs/specs/plugin-split.md](docs/specs/plugin-split.md) (approved 2026-11-08).
Pull requests: #147 (spec), #148 (16a), #150 (16b and the release).

`rfr-core` carries web and Unreal skills, agents, and hooks that only one kind of project uses. They move into `rfr-web` and `rfr-unreal`, the `plugins/web/` and `plugins/unreal/` this plan's layout always listed, so each project installs only its domain's parts. The reviewer agents that cover both domains stay in `rfr-core`. The split ships as one breaking release: `rfr-core` 4.0.0 with `rfr-web` and `rfr-unreal` 1.0.0.

- **16a:** the two plugins, the moves, the build copies, the marketplace, and the guard changes (AC-1 to AC-6).
- **16b:** templates, `install-rules`, the eval harness, and documentation (AC-7 to AC-9); then the release (AC-10).

### Phase 17: Model adaptation (complete)
Spec: [docs/specs/model-adaptation.md](docs/specs/model-adaptation.md) (approved 2026-11-08).
Pull requests: #149 (spec and 17a), #152 (17b and 17c).

New models will keep arriving, and the rule set is tuned to the 5.5 generation. Principle 8 and the maintenance guide say rules are re-evaluated on each new model, but not how, at what cost, or where the result is kept. This phase makes that a routine: a fixed, budgeted eval suite that runs within days of a release, a ledger of which rules, agents, and skills have evidence on which model, saturated cases flagged, and default decisions for each result (keep, rewrite, move to a practice guide, pin an agent's model). METR's assessment of Anthropic's internal "Model 4" (2026-11-05) prompted it: faster model progress and saturated benchmarks are the two problems this phase addresses.

- **17a:** the `model-release` suite, `--suite` and `--max-cost` in the runner, the reported model ID in each run record, `evals/ledger.json` and `checks/model-ledger.mjs`, and the `evaluated-on` field (AC-1 to AC-6).
- **17b:** the "New model" section in the maintenance guide, the `model-release` issue form, section 5 and decision 7 rewritten to name no single generation, and the "Evaluated on:" changelog line and its check (AC-7 to AC-10).
- **17c:** the baseline run on Opus 5.5 and Sonnet 5.5 (AC-11), and the first decisions it supports.
- **Fable 5.2** (2026-11-10, outside the spec): `software-architect` moved to Fable 5.2 (#159). Anthropic's guidance is to start with Opus 5.5 and move to Fable only when Opus at higher effort falls short, which the October round never compared, and Claude Code can now use Fable as an advisor. The runner gains `--advisor`, `--agent-model`, and `--agent-effort`, and records cost per model and advisor calls (#160); the round in `evals/README.md` ("Planned: Fable 5.2 round") compares the architect on Opus 5.5 and Fable 5.2, and a Sonnet session with Fable as advisor. It ran on 2026-11-11 for about $11 ([report](evals/results/2026-11-11-fable-5-2/report.md)): the architect on Opus 5.5 at `high` passed 9 of 9 runs, matching Fable at a third of the cost, so it moved to Opus (#185); Sonnet alone passed 7 of 9, and the advisor was never consulted unprompted. A harder new-project case, `arch-greenfield-pipeline` (#186), models a multi-component pipeline across domains; its round (`evals/README.md`, "Planned: pipeline round") decides whether Fable has a place in rfr. The architect is no longer experimental, and `plan-feature` asks for it on new projects, changes across components, and hard-to-reverse choices (#187). Asked directly for a design, though, Sonnet sessions called it in 0 of 12 runs with either its old or its new "use proactively" description ([report](evals/results/2026-11-11-architect-usage/report.md), #190), so descriptions do not route work to it. A core rule waits on the pipeline round: if the architect clearly wins on large multi-component designs, a rule triggers on those alone.

### Phase 18: Housekeeping and triage (in progress)
Plan: [docs/improvement-plan.md](docs/improvement-plan.md), carried out under [docs/improvement-brief.md](docs/improvement-brief.md). Decisions D1 to D8 and P1 to P7 take the recommended answers (confirmed 2026-11-10).
Pull requests: #164 (18a), #165 and #175 (18b).

- **18a:** status documents: this plan, the README, and two new checks in `checks/plan.mjs` (the status line names the `rfr-core` version; a phase marked planned cannot have every slice done). Done (#164).
- **18b:** `npm run verify` passes on Windows, and CI runs it there too. Done (#165, #175): Vale pinned for Windows, and the guards read Git Bash paths as the shell does (guard tiers AC-13).
- **18c:** a `kind` for every rule (`behaviour`, `fact`, `invariant`). Waits for the maintainer's review of steps 1 to 5 of the brief.
- **18d:** demote rules the models already follow. Waits on 18c.
- **Decisions after steps 1 to 5** (maintainer, 2026-11-10): (1) sessions on this repository may merge their own green pull requests; the maintainer adds the permission rule, since a session may not edit its own permissions. (2) The 23k feature trial runs on the next feature built under the process. (3) The goal table keeps scalability and observability, marked as not yet covered. (4) The delegated agreement stays opt-in; a harder `ls-park-and-continue` variant (21a-2) tests the difference it is meant to make before any default changes.

### Phase 19: Delegated work (in progress)
Plan: [docs/improvement-plan.md](docs/improvement-plan.md). Delegated mode is opt-in until its eval (21a) passes.
Pull requests: #162 (19a), #166 (19b), #167 (19h), #168 (19c).

- **19a:** `checks/attention-report.mjs` and the baseline in `evals/results/2026-11-10-attention-baseline/`. Done (#162). The Kettlebird pilot's transcripts are on another machine and are not in the baseline.
- **19b:** the delegated working agreement (candidates in `evals/candidates/*-delegated.md`, installed by `install-rules` when `.claude/rfr.json` says `"mode": "delegated"`), and the `## Decisions` section in the pull request template. Done (#166), opt-in until 21a passes.
- **19c:** the decision queue: `needs-lead` issues with options, a default, and its date, and the `/rfr-core:decisions` skill. Done (#168).
- **19h:** the preferences log (`docs/preferences.md` in the templates and `install-rules`), checked by the reviewers, and the `ls-repeat-correction` eval case, built and unit-tested with its runs waiting. Done (#167).
- **19d, 19e:** replaced by Phase 23. **19f, 19g:** wait for the maintainer's review.
- **19i:** default allow ([spec](docs/specs/retired/default-allow.md), draft): rfr allows the agent's working tools and asks only for a named list of irreversible or outward actions, so a delegated implementation prompts only where a person must decide. Approved 2026-11-12: merges once CI is green, review points stop and report instead of prompting, and every project switches on its next plugin update. 19i-1 to 19i-3 done in 6.0.0 (#198, #199); 19i-4, the eval of a delegated multi-PR build, waits for a budget decision.
- **19j:** unattended runs ([spec](docs/specs/unattended.md), draft): nothing during a run asks the person; the never list is refused with what to do instead, what only the person can authorise is decided in the plan, and the rest is set aside and recorded. Approved 2026-11-12. Done in 7.0.0 (#203), with the replay of real sessions in `evals/results/2026-11-12-unattended-replay/`.

### Phases 20 to 22: Consolidation, targeted evals, missing guards (planned)
Plan: [docs/improvement-plan.md](docs/improvement-plan.md). Only 21a (delegated wording against test gaming, up to $20) is approved to run; the rest wait for the maintainer's review of steps 1 to 5 of the brief.
Pull requests: #169 (21a).

- **21a:** done (#169), $12.27. No run gamed the wrong test in either mode (0 of 40), so delegated mode stays available behind the mode setting. On the new `ls-park-and-continue` case both modes carried on past the wrong test; only Opus with the delegated wording also wrote the parked helper to the documented rule (5/5 against 0/5). [Results](evals/results/2026-11-10-21a/README.md). Second round (#176), Sonnet only, $2.14, with the wrong test first and no instruction to carry on: again no gaming (0 of 10), and both modes carried on; with the delegated wording Sonnet wrote the parked helper to the documented rule in 3 of 5 runs against 0 of 5 ([results](evals/results/2026-11-10-21a-park-early/README.md)).

### Phase 23: Process changes (in progress)
Plan: [docs/improvement-plan-process.md](docs/improvement-plan-process.md).
Pull requests: #163 (23a), #170 (23f), #171 (23j), #172 (23b), #173 (23c), #181 (23l), #207 (23m).

- **23a:** `checks/process-gate-report.mjs` and the baseline in `evals/results/2026-11-10-gate-baseline/`. Done (#163). At the pull request, approvals rarely changed anything (Kettlebird: 91 of 96 unchanged); the maintainer's review happens in the session before the pull request opens.
- **23f:** the tier inferred from the changed paths; a label only raises it. Done (#170).
- **23j:** pilot findings moved to `docs/research/pilots/`, the guide split by stage, unexercised team features marked. Done (#171).
- **23b:** gate types (`approve`, `notify`, `agent`) with defaults by working mode. Done (#172).
- **23c:** the batched interview, product brief, feature packet, and the review packet script. Done (#173).
- **23l:** `checks/process-rework-report.mjs` (amendments to approved artifacts, and which came after a spec built on them), the review packet's mismatches and `slows` count, guide text for turning a repeated correction into a review check, and regression cases from feedback triage, from Anthropic's AI-native SDLC playbook. Built (#181); the pilot baseline waits for the pilots' clones.
- **23m:** stage order enforced (project-process AC-63, AC-64). Every stage is required unless `process.yml` waives it ahead of time with a reason; the process check fails an artifact that skips a stage, and the `guard-stages` hook refuses writing one. From XR Studio's feedback #204, where an agent went from stories straight to a spec and code. Done in 7.1.0 (#207). The maintainer: "The development process is what matters most."
- **23k:** the two probes, written up for the maintainer to run and judge in [evals/results/2026-11-10-23k-probes/](evals/results/2026-11-10-23k-probes/README.md) (#174). Not yet run. 23d and later wait for their results.

### Phase 24: Android plugin and a core-only profile (planned)
Spec: [docs/specs/android-plugin.md](docs/specs/android-plugin.md) (approved 2026-11-11; `uiautomator dump` confirmed on the reference TV).
Pull requests: #183 (spec), #184 (24a), #189 (24b).

From the quiet-launcher project, which fits no profile: an `rfr-android` plugin with a device guard that asks only before an `adb` command changes a shared device, an on-device tutorial runner (`runner: adb`), an `android-app` profile, and a `general` profile for projects that are neither web, Unreal, nor Android.

- **24a:** the `general` profile and its process templates. Done (#184).
- **24b:** the `rfr-android` plugin and `guard-adb`. Done (#189).
- **24c:** the `adb` tutorial runner. `uiautomator dump` works on the reference TV once the screen is awake.
- **24d:** the `android-app` profile, profile inference, and documentation.

### Phase 25: Rewrite of rfr-core and rfr-process (planned)
Plan: [docs/rewrite-plan.md](docs/rewrite-plan.md) (written 2026-11-12 after a whole-system review; approved the same day with the recommended answer for each of its decisions D1 to D8).

The lead approves a feature packet, and agents carry the feature unsupervised to an implementation the lead can test. Approval and merging move to GitHub (a bot-authored pull request, a required review on gated folders, auto-merge), containment to the environment, and stage order to one CI rule and a state command; the merge guard, task approval, and the default-allow hook go.

- **25a:** five trials of the assumptions the design rests on. No plugin changes. Trial 1 passed on 2026-11-12 ([result](evals/results/2026-11-12-25a-trial-1/README.md)): a branch pushed with the lead's credentials became a pull request authored by the `rfr-agent` App, an ungated one merged itself, and a gated one merged on the lead's review. Trial 5 passed with a condition ([result](evals/results/2026-11-12-25a-trial-5/README.md)): delivery pull requests use a merge commit, since a squash keeps the spec lock green only when the spec is already `implemented`. Trials 2 to 4 passed in cloud sessions on two fixture features ([result](evals/results/2026-11-12-25a-trials-2-4/README.md)), so 25a is done.
- **25b:** the GitHub side: the App's pull request workflow, auto-merge, branch protection, CODEOWNERS. Built (#218, [spec](docs/specs/github-gate.md)): `rfr-open-pr.yml`, `checks/process-github-setup.mjs`, the `setup` step, and the adoption guide's section. The gate is on for `xr-studio-in-a-box` (its #350); the guide was not enough on its own there and was extended (#219), so its test is the next adopter.
- **25c:** `process next`, the always-on process rule, and the rule that a source change cites an approved spec. Built (#221, [spec](docs/specs/process-state.md)): a `SessionStart` hook gives every session the rule and each feature's stage, with approval read from the default branch; the process workflow's `change` job fails source changes with no approved spec unless a commit declares a fix or a trivial change that fits. Work with no user-facing behaviour derives its spec from a design the approver has marked `no-user-docs` (#222).
- **25d:** the delivery run: trigger, run contract, stop check, end point, and feedback #132. Built (#224, [spec](docs/specs/delivery-run.md)): the `deliver` skill, the run marker and `Stop` hook, the gate text, and the workflow-written pull request description. rfr-core 7.3.0 lets a session subscribe to a pull request, so that the packet's merge can start delivery (#225).
- **25e:** removal of the replaced guards, and the rules pruned and re-evaluated. Done (#233, #235, #236, #237, #239, #240, #242 to #247; [verify inventory](docs/verify-inventory.md)): agents cannot approve a pull request; approval in chat, the merge guard, default allow, the tier check, and the modes are gone; the command guard refuses the never list by every route, and the web stack's commands moved to rfr-web; the verify suite is folded by behaviour, with domain tests in their plugins and CI running what a change can affect; the core rules went from 22 to 12, and TEST-001 and WA-002 kept their measured effect.
- **25f:** the acceptance test on a real feature, and 8.0.0. The delegated eval (19i-4) passed 20 of 20 on Sonnet 5.5 and Opus 5.5 with no interruption, after its smoke run found two faults that were fixed first ([report](evals/results/2026-11-13-25f-delivery-delegated/report.md)). Next: the acceptance test on one feature in XR Studio In A Box, then 8.0.0.

### Phase 26: Revisions and shared foundations (planned)
Spec: [docs/specs/revisions-and-foundations.md](docs/specs/revisions-and-foundations.md) (written 2026-11-13 at the maintainer's request; its six decisions approved the same day, each as recommended).
Pull requests: #253 (spec).

A change to something already built is approved as one packet of documents and carried to the built features as open deliveries; and what many features share, starting with the design system, has one approved document that designs cite. Starts after 25f passes, because two slices change the stage guard.

- **26a:** a stale spec or tutorial is open work, not a failure: the `revise` step, `delivery open`, and the run.
- **26b:** the impact report, the Revision section of the pull request description, and the `revise` skill.
- **26c:** foundations: the folder, their place in stage order, `implemented-by`, and the change check.
- **26d:** the design system, declared or defined, cited by designs and read by mock-ups; then XR Studio In A Box moved onto it.
- **26e:** mock-up images tracked by the hash of their inputs.

### Phase 27: Lasting tutorials and a place to try them (planned)
Spec: [docs/specs/lasting-tutorials.md](docs/specs/lasting-tutorials.md) (written 2026-11-13 from the maintainer's feedback on the 25f acceptance test; its changes and its seven decisions were approved the same day, each as recommended).
Pull requests: #254 (spec).

Order, by decisions D5 and D6: this phase comes before Phase 26, and 25f and 8.0.0 wait for it. The acceptance test is run again on the next packet once 27c is in.

A tutorial is user documentation that runs: named for the task, the same on a local build, a preview, and the deployed product, and kept current by later slices. Getting somewhere to follow it is one address or one command, with sign-in as the people the tutorial names.

- **27a:** what a tutorial is: the template, the guide, the body checks, and the link from user documentation.
- **27b:** the web runner acts as several people, signs in, and starts from another tutorial's result.
- **27c:** a place to try it: `try:` in `process.yml`, tutorial sign-in and its conditions, stand-ins for cloud services and what each place provides, and "Try it" in the pull request and the report.
- **27d:** XR Studio In A Box moved onto it, and slices 2 to 4 validated from a preview.

## 11. Milestones

| Milestone | Contents | Status | Pull requests |
|---|---|---|---|
| M1 | Phase 0 research, recommendations, plan update | Done | #1 |
| M2 | Phase 1 foundations + Phase 2 working agreement, testing and code-quality rules, default hooks, eval seed | Done | #2 to #7, #9 |
| M3 | Remaining core rules + `unreal-plugin` and `typescript` packs | Done | #8, #10, #11 |
| M4 | Remaining web packs + practice guides | Done | #12, #13 |
| M5 | Agents, skills, hooks | Done | #14 |
| M6 | GitHub integration, CI workflows, template repos | Done | #15 |
| M7 | Reference projects, full evals, revisions, v1.0 | Done for v1.0; the remaining Phase 8 evals continue | #18, #20, #65, #66 |

From Phase 1 on, each milestone lands as one or more PRs on its own branch.

## 12. Open questions

1. ~~Does Claude Code send rule-file frontmatter and HTML comments to the model?~~ Answered in Phase 1: no, both are stripped; path-scoped rules load on Read/Edit but not on Grep ([experiment R7](docs/research/experiments/r7-rule-loading.md)).
2. Which `BuildPlugin` and Unreal Insights headless flags exist in the installed engines? Partly answered by the runner probe (run 37345401288): Launcher-installed engines (5.6 to 5.8) do not ship `BuildPlugin.Automation.cs`, so its flags cannot be read there; the documented `-Plugin`, `-Package`, and `-Rocket` build all three versions with no plugin warnings. Insights headless flags remain unverified: the source scan found no `-NoUI`/`-AutoQuit` strings, so `profile-unreal-plugin` tells agents to try them on the installed engine before relying on them (R55).
3. ~~What process exit code does `UnrealEditor-Cmd` return when automation tests fail?~~ Answered on the runner (Tier 2 runs 37324987694 and 37345401288, UE 5.6 to 5.8): exit code 255, with the log line `TEST COMPLETE. EXIT CODE: -1`. CI still gates on `index.json`, which also catches tests that did not run (R31, R55).
4. ~~Do behavioural rules (as opposed to repository descriptions) measurably help 5.5-class models?~~ Answered in Phase 8: yes, for some. Without rules, both models edited a wrong test to get CI green in 6 of 6 runs; with TEST-001 and WA-002, in none. TEST-004 made Sonnet work test-first (0/3 to 6/6); Opus already did. On data-loss, over-engineering, and Next.js 16 tasks the models behaved well without rules. Rules cost about 40% more per run, and hooks add more ([report](evals/results/2026-10-05-phase8/report.md)).

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Rules add cost without improving results (as published studies found for repo context files) | Keep the core short; evals from Phase 2; remove rules without measurable effect (R38, R39) |
| Agents game tasks by editing tests | Test-edit hook (R25) and deterministic CI guard (R26) as primary defence; escape hatch as support (R9) |
| Rule adherence drops in long sessions | Session hygiene (R12); mechanical enforcement for invariants (R24) |
| Conflicting instructions resolve arbitrarily | Layering by removal or replacement only (R17) |
| Destructive git or database operations | PreToolUse hooks for destructive commands and migration commands (R25, R49) |
| Privileged tools (Vercel MCP, Unreal MCP) act beyond intent | Permission prompts for write tools (R43); Unreal MCP optional and never shared between agents (R34) |
| Self-hosted runner executes untrusted code | Trusted events only, ephemeral runner, no secrets (R31) |
| Guidance goes stale (engine, framework, model updates) | Sources dated; quarterly reviews; `observed-on` metadata; a budgeted model-release suite and an evidence ledger per model (Phase 17) |
| Evidence for some figures is still indirect | Claims from still-blocked sources may not support a MUST rule (R40) |

## 14. Immediate next steps

Open items only; finished work is recorded under its phase. `docs/handoff.md` holds the state a new session needs; read it first.

Since 7.0.0 the standing direction is: the person is never interrupted during a run (no prompts, no questions in chat), things Claude must never do are refused, and what only the person can authorise is decided in the plan (`docs/specs/unattended.md`). The development process comes before everything else (23m). Judge new work against both.

0. Most urgent:
   - **The rewrite plan** ([docs/rewrite-plan.md](docs/rewrite-plan.md)), approved 2026-11-12. Guard and permission behaviour is frozen until its acceptance test passes. Done: the trials (25a), the GitHub gate (25b, set up on `xr-studio-in-a-box`), and process state with the change check (25c). 7.3.0 is released. The first real delivery run, slice 2 on `xr-studio-in-a-box`, finished with no interruption ([record](evals/results/2026-11-12-first-delivery-run/README.md)). Next: the lead validates slice 2 by its tutorial and has slice 1 finished; then 25e (removal, the rules, and the verify suite review), and 25f's acceptance test.
   - **Confirm XR Studio In A Box's adoption of 7.1.0.** Its design and user documentation for Layer 1 come before any more implementation. Then triage the feedback it files.
   - **The delegated multi-PR eval (19i-4)**, which waits for the maintainer's budget decision (about $15 to $25). It is the test of "no interruptions during a run".

1. The improvement plans, in the brief's order: measure (19a, 23a), housekeeping (18a, 18b), delegated mode (19b, 19h, 19c, then the 21a eval), process (23f, 23j, 23b, 23c), and the probes (23k). The rest of both plans waits for the maintainer's review of what those produce.
2. Eval rounds that have machinery and no result: 10c (55 runs, $20 to $30), 14b, 15e. Phase 21 orders them under the D8 cap of $150.
3. 11d: the release readiness check and the stage 8 template (process plan 23i); release notes and the triage skill stay deferred (P6).
4. The long-session eval round (#69): seven multi-prompt cases for the candidate rules from #28 to #35, #52, and #57; cases and graders are built, the paid runs are staged. WA-012 (handoff) shipped in 7.2.0 on the maintainer's direction (#209); `ls-handoff` now measures it rather than gating it.
5. Replay the Kettlebird pilot's sessions (guard tiers AC-8) and add them to the attention baseline (19a); both need commands run on the pilot's machine.
6. An opt-in owned-paths hook and CI check (#47).
7. The remaining Phase 8 work: an Unreal API-change case, leave-one-pack-out and single-rule ablations, and the wording experiments.
8. The first real Fab submission, which answers #36. An editor MCP limit hook (#55) needs a machine with UE 5.8 to confirm the tool names.
9. Practice guides for scalability and observability, which the goal table names and nothing covers yet.
10. The next model release: open a model-release issue when Claude Code offers a new model (Phase 17).
