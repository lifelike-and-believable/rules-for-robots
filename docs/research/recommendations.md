# Phase 0 recommendations

Status: Proposed (2026-10-05). Each recommendation needs a decision: **accept**, **reject**, or **defer**. Accepted items will be applied to `PLAN.md` before Phase 1 starts.

Evidence and sources for every item are in [findings.md](findings.md) (section named in the "Basis" column). Raw research notes are in [notes/](notes/).

## A. Rule format (plan sections 4 and 5, Phase 1)

| ID | Recommendation | Basis | Plan change |
|---|---|---|---|
| R1 | Rename the `applies-to` frontmatter field to `paths`, or generate `paths` from it. It is the only field Claude Code reads; other fields are ignored. | Claude Code mechanics; Implications: rule format | Section 4 principle and Phase 1 format spec |
| R2 | Keep `id`, `title`, `level`, `scope`, `verified-by`, `rationale` as metadata for people and tooling. Add `targets-failure` (the failure mode the rule addresses) and `observed-on` (models and date). | Rule sets earn their place only through ablation | Phase 1 format spec |
| R3 | Write rule bodies as plain imperative sentences with a short "because" and explicit scope. Keep MUST/SHOULD/MAY in the `level` field, not as capitalized words in the body. | Calm, scoped, reasoned instructions | Section 4 principle 3; section 5 item 3 |
| R4 | Add a lint for rule files that rejects legacy phrasing ("CRITICAL", "think step by step", "show your reasoning", "double-check", "if in doubt", "only report important"). Some of these trigger refusals or over-verification on current models. | Instructions written for earlier models that now backfire | New CI check in Phase 1 |
| R5 | No rule restates what a linter, formatter, or compiler already enforces. | Length; configuration smells | Section 4 principle 1 |
| R6 | Validate rule-file YAML in CI. Invalid YAML silently makes a path-scoped rule load everywhere. | Non-obvious tips | Phase 1 CI check |
| R7 | In Phase 1, test whether rule frontmatter and HTML comments reach the model (using the `InstructionsLoaded` hook). If frontmatter is sent, move metadata into a stripped comment block. | Implications: rule format | Section 12 open question; Phase 1 task |

## B. Working agreement (Phase 2)

| ID | Recommendation | Basis | Plan change |
|---|---|---|---|
| R8 | Replace "run checks before declaring done" with a concrete project command (e.g. `pnpm verify`, or the Unreal build-and-test script) whose output must appear in the agent's report. Avoid generic "verify your work" lines. | Opus 5 over-verification vs. Sonnet 5.5 low-effort guidance | Phase 2 description; section 5 item 6 |
| R9 | Add an explicit escape hatch: stop and report when the task or its tests look wrong or impossible. This cut test-gaming several-fold in published benchmarks. | Agents cheat mainly by editing tests | Phase 2 description |
| R10 | Replace "ask when blocked" with a named list of required stops: destructive or irreversible actions, a material change of scope, and a task or test that appears wrong. | Opus 5.5 guidance on naming specific stops | Phase 2 description |
| R11 | Adapt Anthropic's published, tested paragraphs for scope, minimal changes, and comments instead of writing new wording. | Calm, scoped, reasoned instructions | Phase 2 description |
| R12 | Add session hygiene guidance: keep sessions focused, start fresh after repeated failed corrections, and use sub-agents for exploration. Adherence drops as sessions grow. | Session length and context fill | Section 5 item 7 |

## C. Repository and distribution (plan section 6)

| ID | Recommendation | Basis | Plan change |
|---|---|---|---|
| R13 | Split delivery by what each channel can carry. Template repos: `AGENTS.md` (canonical), a thin `CLAUDE.md` that imports it, `.claude/rules/`, and `.claude/settings.json`. Plugins: skills, agents, hooks, and an installer skill that copies selected rule packs into an existing repo. Plugins cannot ship `CLAUDE.md` or rules. | Claude Code offers many mechanisms, and plugins cannot ship rules | Rewrite section 6 and the distribution note |
| R14 | Keep `rules/` as the single source of truth, with a build step that renders it into the template repos and the installer skill. | Implications: repository and distribution | Section 6; Phase 1 |
| R15 | Declare a minimum Claude Code version of 2.1.288 (path rules load on Write/Edit; native `AGENTS.md`). | Loading and precedence | Section 2 decisions |
| R16 | Bump the plugin `version` on every release, or updates are not picked up. | Non-obvious tips | Phase 9 |
| R17 | Layering works by removal or replacement, not by adding contradicting lines. Claude Code concatenates instruction files and resolves conflicts arbitrarily. Use `claudeMdExcludes`, pack selection, or waivers that replace the rule file. Organizations needing guarantees use managed settings. | Loading and precedence | Rewrite section 9 and principle 7 |

## D. Agent design (plan section 8, Phase 5)

| ID | Recommendation | Basis | Plan change |
|---|---|---|---|
| R18 | Start with a smaller roster: `web-engineer`, `unreal-engineer`, `code-reviewer`, and specialist reviewers (accessibility, performance, security) invoked explicitly. Add `tech-lead`, `architect`, `product-analyst`, and others only if evals show benefit. Current models already delegate and self-review readily. | Agent design: fewer, read-only reviewers | Section 8 |
| R19 | Reviewers get read-only tools, report every finding with file, line, failure scenario, severity, and rule ID, and leave filtering to a separate pass. Literal "only high severity" filters suppress real findings. | Agent design; Opus 5 guidance | Section 8 output formats |
| R20 | Keep code changes to one writing agent at a time. Use parallel agents for reading, research, and review. | Multi-agent work | Section 5 item 9 |
| R21 | Set `model` and `effort` in each agent's frontmatter instead of "think carefully" in its body. | Instructions that now backfire | Section 5 item 8 |
| R22 | Put agent-specific enforcement in the plugin's hooks file, because plugin agents ignore their own `hooks` and `permissionMode` fields. | Skills, subagents, hooks, plugins | Phase 5 |
| R23 | Side-effecting skills (`release`, `package-unreal-plugin`, the rule installer) set `disable-model-invocation: true`. | Implications: agent design | Phase 5 |

## E. Enforcement and CI (plan section 7, Phase 6)

| ID | Recommendation | Basis | Plan change |
|---|---|---|---|
| R24 | Map every MUST rule to a hook, a CI job, or both. Hooks block only with exit code 2; timeouts do not block. | CI: put MUST rules into hooks and workflows | Section 4 principle 5 |
| R25 | Ship default hooks: block destructive commands (`rm -rf`, `git reset --hard`, force-push, `--no-verify`); require approval for edits to test files; run formatters after edits. | Failure modes; CI implications | Phase 5 |
| R26 | Add a CI job that flags PRs changing tests or visual baselines alongside implementation code unless a label approves it. | Agents cheat mainly by editing tests | Phase 6 |
| R27 | Any Claude-in-CI job uses `--bare` and never runs on fork PRs. | Non-obvious tips | Phase 6 |
| R28 | Web CI: types, lint, unit tests; then against the Vercel preview (bypass header): Playwright, axe with WCAG 2.2 AA tags plus scripted heuristics for criteria axe cannot check, Lighthouse CI (median of 3+ runs), bundle budgets; gitleaks, Semgrep or CodeQL, `npm audit`. | Web verification | Section 7; Phase 6 |
| R29 | Prefer the Playwright CLI over Playwright MCP for agent browser checks in long sessions (about 4x fewer tokens). | Web verification | `web-platform` pack |
| R30 | Point Next.js agents at the version-matched docs in `node_modules/next/dist/docs/`. | Web verification | `react-nextjs` pack |
| R31 | Unreal Tier 2: parse the automation `index.json` and fail on any failed test, ignoring the editor exit code; run `RunUAT BuildPlugin` per engine version; trusted events only; ephemeral or reset runner, low-privilege account, no secrets on the machine. | Unreal section | Section 7 |
| R32 | Unreal Tier 1: validate `.uplugin` platform allow/deny lists per module; flag `TObjectPtr` members without `UPROPERTY`. | Unreal section | Section 7 |
| R33 | `unreal-engineer` checks unfamiliar symbols against installed engine headers, treats compiler output as authoritative, and does a full build with the editor closed after any header, `.Build.cs`, `.uplugin`, or reflection change. | Unreal section | Section 8; `unreal-plugin` pack |
| R34 | Evaluate Epic's official Claude Code plugin and the UE 5.8 MCP as optional tooling; confirm 5.6/5.7 compatibility first. | Unreal section | Section 12 open question |

## F. Evals (Phase 8)

| ID | Recommendation | Basis | Plan change |
|---|---|---|---|
| R35 | Four arms: no rules, full set, leave-one-pack-out, single-rule ablations for MUST rules. Opus 5.5 and Sonnet 5.5 at recorded effort levels; record the Claude Code version. | Eval design | Phase 8 |
| R36 | 20 to 50 tasks drawn from observed failures, each tagged with the failure mode a rule targets, including impossible-task variants, over-engineering temptations, a dirty working tree, a Next.js 16 task, and an Unreal header-change task. | Eval design | Phase 8 |
| R37 | Graders: held-out tests; deterministic diff and transcript checks (test edits, destructive commands, duplication, nonexistent dependencies, diff size); a calibrated LLM judge for scope and evidence-backed reporting. Report pass@1, pass^k (k of 3 or more), cost, and failure-mode rates. | Eval design | Phase 8 |
| R38 | Keep a rule only if it lowers its target failure rate without reducing success or adding disproportionate cost. | Rule sets earn their place only through ablation | Section 4; Phase 8 exit criteria |
| R39 | Move the eval harness earlier: build a small version in Phase 2 so rules are tested as they are written, not only at the end. | Inference from the context-file studies | Phases 2 and 8; milestones |

## G. Follow-up research

| ID | Recommendation | Basis |
|---|---|---|
| R40 | Re-check figures marked "secondary only" against primary sources once the environment can reach arxiv.org, www-cdn.anthropic.com, dev.epicgames.com, support.fab.com, nextjs.org, and vercel.com. Required before any such figure supports a MUST rule. | Evidence tags |
| R41 | Fill gaps: current Fab technical requirements, Epic coding standard, UE 5.6 to 5.8 deprecations, agent-safe Postgres migrations on Vercel. | Conclusion |

## Questions to add to plan section 12

1. Does Claude Code send rule-file frontmatter to the model? (R7)
2. Does Epic's MCP plugin work on UE 5.6 or 5.7? (R34)
3. What do the current Fab technical requirements and Epic coding standard say? (R41)
4. What sourced practice exists for agent-safe Postgres migrations on Vercel? (R41)
5. Do the full texts confirm the abstract-only figures? (R40)
