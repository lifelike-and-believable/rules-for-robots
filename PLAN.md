# Project Plan: rules-for-robots

Status: v0.9 (2026-10-05). Phases 0 to 2, 4, and 5 complete; Phase 3 complete except the first Tier 2 run on the self-hosted runner; Phase 6 next. All Phase 0 recommendations (R1 to R64 in [docs/research/recommendations.md](docs/research/recommendations.md)) were accepted and are applied below. Evidence is in [docs/research/findings.md](docs/research/findings.md).

## 1. Goal

Produce a reusable set of **rules**, **best practices**, and **agent definitions** that steer AI coding agents (and the humans working with them) toward software, websites, web apps, and Unreal Engine plugins that are:

| Quality attribute | What it means here | How we will know |
|---|---|---|
| High-quality | Correct, tested, reviewed, consistent | Tests on critical paths, zero lint/type/compiler warnings at the agreed level, review checklist passes |
| User-centred | Solves a real user need; accessible; clear UX and content. For plugins, "users" includes the developers and designers who use the plugin in the editor | WCAG 2.2 AA for web; documented user stories and acceptance criteria; plugin settings, Blueprint API, and docs reviewed for usability |
| Performant | Fast to load and respond; efficient on client, server, and game thread | Core Web Vitals budgets (LCP, INP, CLS) and bundle budgets for web; frame-time and memory budgets profiled with Unreal Insights for plugins |
| Scalable | Handles growth in users, data, content, and team size | Stateless services and load-test baselines for web; plugins that behave well with large worlds, many actors, and network replication |
| Extensible | New features fit without rewrites | Clear module boundaries, stable public interfaces, extension points (e.g. subsystems, interfaces, delegates), ADRs for key decisions |
| Maintainable | Easy for a new contributor (human or agent) to change safely | Docs, conventions, small modules, automated checks, low change failure rate |

Security, privacy, and observability are treated as cross-cutting requirements underpinning all six attributes.

## 2. Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Target agents/tools | Claude Code first. `AGENTS.md` is the canonical instruction file so other tools can be supported later. |
| 2 | Stack opinion | Stack-independent core, plus optional stack packs covering Unreal Engine plugins, websites, and web apps. |
| 3 | Audience | A solo developer first, structured so teams and organizations can adopt and override it. |
| 4 | Strictness | MUST-level rules are enforced by a hook, CI, or both where practical and relevant (R24). |
| 5 | Distribution | Template repos carry instructions, rules, and settings; Claude Code plugins carry skills, agents, and hooks (R13). MIT licence. |
| 6 | Spelling | Canadian English (e.g. "centre", "colour", "behaviour", "organize", "licence" as noun). |
| 7 | Target models | Opus 5.5 and Sonnet 5.5-class agents (section 5). |
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

## 5. Designing for Opus/Sonnet 5.5-class agents

Phase 0 confirmed or revised each working assumption (see the verdict table in findings.md).

1. **Don't restate what the model knows.** Confirmed and strengthened: context files that describe the repo add cost without improving success.
2. **Explain intent, then trust judgement.** Confirmed. Give the goal and reason; keep fixed procedures for releases, migrations, and packaging.
3. **Calibrated, plain wording.** Confirmed. Emphatic wording over-triggers on current models; levels move into metadata.
4. **Say what to do.** Confirmed with nuance: positive framing by default, plus short lists that name concrete patterns to avoid.
5. **Target known failure modes.** Confirmed. The main ones are editing tests to pass (the dominant gaming route for Claude), scope creep and over-engineering, destructive git and database operations, invented or version-mismatched APIs, and unsupported claims of success.
6. **Concrete verification, not generic "verify".** Revised. Generic verification lines cause over-verification on Opus 5+, while a concrete command helps Sonnet 5.5 at low effort. Give the command and require its output.
7. **Context as a resource.** Confirmed, with session hygiene added: adherence drops as sessions grow, so keep sessions focused, start fresh after repeated failed corrections, and use sub-agents for exploration (R12).
8. **Model and effort per agent.** Confirmed. Set `model` and `effort` in agent frontmatter instead of "think carefully" in the body (R21).
9. **Parallel reading, single-threaded writing.** Narrowed. Parallel agents for research and review; one writing agent at a time (R20). Never share one Unreal MCP editor between agents.
10. **Literal reading of filters.** New. Reviewers report every finding with severity; filtering happens in a separate pass, because "only report high severity" suppresses real findings (R19).

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

Reviewers are invoked explicitly or by path, receive the diff and criteria without the author's reasoning, and leave filtering to a separate confirm-or-refute pass (R19). Each agent sets `model` and `effort` (R21). Agent-specific enforcement goes in the plugin's `hooks/hooks.json`, because plugin agents ignore their own `hooks` and `permissionMode` fields (R22). Candidates to add later if evals justify them: `tech-lead`, `architect`, `product-analyst`, `ux-designer`, `test-engineer`, `docs-writer`, `release-engineer`.

## 9. Adapting for teams and organizations

Instruction files are concatenated and conflicts resolve arbitrarily, so every layer works by adding, removing, or replacing whole rule files (R17):

- **Personal layer:** `CLAUDE.local.md` and user settings for preferences that don't conflict with project rules.
- **Project layer:** choose packs at install time; waive a rule by replacing its file with a waiver that cites the rule ID and reason; exclude files with `claudeMdExcludes`.
- **Team/organization layer:** an organization plugin adds rules, skills, and hooks; required CI checks enforce MUST rules. Organizations that need guarantees use managed settings and `strictPluginOnlyCustomization`.
- **Governance:** CODEOWNERS for rule files, ADRs for rule changes, a changelog, and eval results attached to rule changes.

## 10. Delivery phases

### Phase 0: Research (complete)
Delivered `docs/research/findings.md`, `docs/research/recommendations.md` (R1 to R64, all accepted), `docs/research/notes/`, and `docs/research/sources/fab-requirements.md`.

### Phase 1: Foundations (complete)
Delivered: [docs/rule-format.md](docs/rule-format.md), [experiment R7](docs/research/experiments/r7-rule-loading.md), `TEST-001` as the worked example, the rule lint, the template repo build with budget and staleness checks, the `rfr-core` plugin and marketplace with the `install-rules` skill (installed and run end to end against a demo repo), and CI running `npm run verify`. Finding: writes to `.claude/` need user approval, which the installer skill now explains.

- Finalize the rule file format (section 6) and ID scheme.
- Test whether rule frontmatter and HTML comments reach the model, using the `InstructionsLoaded` hook (R7).
- Repo skeleton, `AGENTS.md` and thin `CLAUDE.md` for this repo, `docs/contributing.md`.
- Build step that renders `rules/` into a template repo and the installer payload (R14).
- Rule-file CI: YAML validation, `paths` check, banned-phrase lint, word and line budgets, ID uniqueness (R4, R6); `claude plugin validate --strict` on plugin manifests.
- Plugin and marketplace manifests with the installer skill shell.
- **Exit criteria:** format spec and one fully worked rule file approved; the core plugin installs; the build step renders a working template repo; R7 answered.

### Phase 2: Core rules and eval seed (complete)
Delivered: working agreement `WA-001` to `WA-007`; core rules `TEST-002`/`003`, `CODE-001` to `004`, `SEC-001` to `003`, `GIT-001`, `DOC-001`; `rfr-core` hooks (destructive-command and test-edit guards, format on edit); the eval harness and seed results ([report](evals/results/2026-10-05-seed/report.md)). Finding: on the seed tasks neither 5.5 model showed the target failures even without rules, and rules added 19 to 40% cost while changing behaviour (test-first fixes). Phase 8 needs harder cases.

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

### Phase 3: Stack packs (rules and Tier 1 complete; Tier 2 run pending)
Delivered: all six packs (`unreal-plugin` 12 rules, `typescript` 2, `web-platform` 4, `react-nextjs` 4, `node-services` 8, `static-sites` 3); `checks/unreal/tier1.mjs`; the `RfrSample` plugin; the Tier 2 workflow with a runner probe for R55; the `guard-mcp` hook for the Vercel MCP server. Remaining: the first Tier 2 run on the `ue5` runner and the probe answers.

- Order: `unreal-plugin`, `typescript`, `web-platform`, `react-nextjs`, `node-services`, `static-sites`.
- Content per section 7.
- Verify BuildPlugin flags, Insights headless flags, and the editor exit code on the runner (R55).
- **Exit criteria:** each pack has rules, at least one practice guide, and Tier 1 checks; the Unreal pack's Tier 2 workflow passes on the runner for 5.6, 5.7, and 5.8.

### Phase 4: Best-practice guides (complete)
Delivered: six guides in `practices/` (working with agents; testing and code quality; security; Unreal plugin development; web verification including Astro; Postgres on Vercel). The rule lint now fails when a rule cites no existing guide or a guide is cited by no rule.

- Longer `practices/` guides linked to rule IDs, with short good/bad examples. Point agents at exemplar files rather than describing patterns where possible.
- **Exit criteria:** every rule file links to at least one guide; every guide is referenced by at least one rule.

### Phase 5: Agents, skills, and hooks (complete)
Delivered: six agents and ten skills in `rfr-core`, plus the hooks from Phases 2 and 3. Each agent and skill passed two smoke tasks (26 of 26; [results](evals/results/2026-10-05-smoke/summary.md)); `install-rules` was tested end to end in Phase 1.

- Agents per section 8.
- Skills: `plan-feature`, `implement-feature`, `review-pr`, `a11y-audit`, `perf-audit`, `security-review`, `write-adr`, `install-rules`, `release`, `profile-unreal-plugin`, `package-unreal-plugin`. Side-effecting skills set `disable-model-invocation: true` (R23). Critical content stays in each skill's first 5,000 tokens.
- Hooks in `hooks/hooks.json`, including agent-specific filters and the database (R49) and Vercel MCP (R43) guards.
- **Exit criteria:** each agent and skill tested on at least two sample tasks with output in its declared format.

### Phase 6: GitHub integration and templates
- PR template with rule-ID checklist, issue forms, ADR and feature spec templates.
- Reusable workflows in `checks/`:
  - web CI per R28;
  - migration checks per R50;
  - the test, baseline, and budget change guard (R26);
  - Unreal Tier 1 and Tier 2;
  - any Claude-in-CI job uses `--bare` and never runs on fork PRs (R27).
- Template repos for web app, static site, and Unreal plugin, rendered by the build step.
- **Exit criteria:** a new repo created from a template is fully wired (CI, plugin, `AGENTS.md`) in under an hour by following the adoption guide.

### Phase 7: Reference projects
- A small web app and a small Unreal plugin built with the full set of agents and rules. The plugin passes the Fab release flow (R64) for all supported engine versions.
- **Exit criteria:** both pass their own checks and meet declared budgets.

### Phase 8: Evals
- Arms: no rules, full set, leave-one-pack-out, and single-rule ablations for MUST rules; Opus 5.5 and Sonnet 5.5 at recorded effort levels; Claude Code version recorded (R35).
- 20 to 50 failure-targeted tasks, including impossible-task variants with and without the escape hatch, over-engineering temptations, a dirty working tree, a Next.js 16 task, an Unreal task using an API changed between 5.6 and 5.8, and a database task where `push` or `--force` is tempting (R36).
- Graders: held-out tests, deterministic diff and transcript checks, and a calibrated LLM judge for scope and evidence-backed reporting; report pass@1, pass^k (k of 3 or more), cost, and failure-mode rates (R37).
- Test the Phase 0 open questions directly: plain vs. emphatic wording, rationale vs. none, keywords in body vs. metadata, concrete vs. generic verification, specialist reviewers vs. one checklist reviewer.
- **Exit criteria:** every rule either shows a measurable effect or is removed or rewritten (R38).

### Phase 9: Release and maintenance
- Semantic versioning for the rule set and plugins; plugin `version` bumped every release; changelog.
- Quarterly review of standards and engine/framework versions; re-run Phase 0 research lightly and the eval suite on each new model generation; adjust the Unreal version set when Epic's default three-version build set moves.
- **Exit criteria:** v1.0 tagged; plugins installable from the marketplace; template repos published.

## 11. Milestones

| Milestone | Contents | Status |
|---|---|---|
| M1 | Phase 0 research, recommendations, plan update | Done |
| M2 | Phase 1 foundations + Phase 2 working agreement, testing and code-quality rules, default hooks, eval seed | Done |
| M3 | Remaining core rules + `unreal-plugin` and `typescript` packs | Done (Tier 2 run pending) |
| M4 | Remaining web packs + practice guides | Done |
| M5 | Agents, skills, hooks | Done |
| M6 | GitHub integration, CI workflows, template repos | |
| M7 | Reference projects, full evals, revisions, v1.0 | |

From Phase 1 on, each milestone lands as one or more PRs on its own branch.

## 12. Open questions

1. ~~Does Claude Code send rule-file frontmatter and HTML comments to the model?~~ Answered in Phase 1: no, both are stripped; path-scoped rules load on Read/Edit but not on Grep ([experiment R7](docs/research/experiments/r7-rule-loading.md)).
2. Which `BuildPlugin` and Unreal Insights headless flags exist in the installed engines? Verify on the runner in Phase 3 (R55).
3. What process exit code does `UnrealEditor-Cmd` return when automation tests fail? Verify on the runner; gate on the report regardless (R31, R55).
4. Do behavioural rules (as opposed to repository descriptions) measurably help 5.5-class models? Partly answered by the Phase 2 seed: the rules change behaviour and add cost, but the seed tasks were too easy to show fewer failures. Phase 8 uses harder cases.

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
| Guidance goes stale (engine, framework, model updates) | Sources dated; quarterly reviews; `observed-on` metadata; re-run evals on new models |
| Evidence for some figures is still indirect | Claims from still-blocked sources may not support a MUST rule (R40) |

## 14. Immediate next steps

1. Merge PR #1 (plan and Phase 0 research).
2. Start Phase 1 on a new branch: rule format spec and the R7 test, repo skeleton, build step, rule-file CI, and plugin manifests.
