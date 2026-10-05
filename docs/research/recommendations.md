# Phase 0 recommendations

Status: Proposed (2026-10-05), revised the same day after a follow-up verification pass that read most of the previously blocked primary sources (arXiv full texts, Anthropic system cards, Epic docs, Next.js, Vercel, Neon, Drizzle, Prisma and Astro). Each recommendation needs a decision: **accept**, **reject**, or **defer**. Accepted items will be applied to `PLAN.md` before Phase 1 starts.

Evidence and sources for every item are in [findings.md](findings.md) (section named in the "Basis" column). Raw research notes are in [notes/](notes/), including the follow-up notes [verification_of_secondary_figures.md](notes/verification_of_secondary_figures.md), [unreal_followup.md](notes/unreal_followup.md) and [web_followup.md](notes/web_followup.md).

## A. Rule format (plan sections 4 and 5, Phase 1)

| ID | Recommendation | Basis | Plan change |
|---|---|---|---|
| R1 | Rename the `applies-to` frontmatter field to `paths`, or generate `paths` from it. It is the only field Claude Code reads; other fields are ignored. | Claude Code mechanics; Implications: rule format | Section 4 principle and Phase 1 format spec |
| R2 | Keep `id`, `title`, `level`, `scope`, `verified-by`, `rationale` as metadata for people and tooling. Add `targets-failure` (the failure mode the rule addresses) and `observed-on` (models and date). | Rule sets earn their place only through ablation | Phase 1 format spec |
| R3 | Write rule bodies as plain imperative sentences with a short "because" and explicit scope. Keep MUST/SHOULD/MAY in the `level` field, not as capitalized words in the body. | Calm, scoped, reasoned instructions | Section 4 principle 3; section 5 item 3 |
| R4 | Add a lint for rule files that rejects legacy phrasing ("CRITICAL", "think step by step", "show your reasoning", "double-check", "if in doubt", "only report important"). Some of these trigger refusals or over-verification on current models. | Instructions written for earlier models that now backfire | New CI check in Phase 1 |
| R5 | No rule restates what a linter, formatter, or compiler already enforces. | Length; configuration smells (lint leakage in 62% of files, confirmed from the full text) | Section 4 principle 1 |
| R6 | Validate rule-file YAML in CI. Invalid YAML silently makes a path-scoped rule load everywhere. | Non-obvious tips | Phase 1 CI check |
| R7 | In Phase 1, test whether rule frontmatter and HTML comments reach the model (using the `InstructionsLoaded` hook). If frontmatter is sent, move metadata into a stripped comment block. | Implications: rule format | Section 12 open question; Phase 1 task |

## B. Working agreement (Phase 2)

| ID | Recommendation | Basis | Plan change |
|---|---|---|---|
| R8 | Replace "run checks before declaring done" with a concrete project command (e.g. `pnpm verify`, or the Unreal build-and-test script) whose output must appear in the agent's report. Avoid generic "verify your work" lines. | Opus 5 over-verification vs. Sonnet 5.5 low-effort guidance | Phase 2 description; section 5 item 6 |
| R9 | Keep an explicit escape hatch: stop and report when the task or its tests look wrong or impossible, starting from Anthropic's measured anti-hack wording. **The evidence is weaker for Claude than first reported**: ImpossibleBench found the abort option "much less pronounced for Claude Opus 4.1" than for GPT-5 (54% to 9%), and recent Claude models still hacked 12.5 to 37.5% of impossible tasks with Anthropic's anti-hack prompt. Pair it with R25 and R26, and present the test-edit guard as the enforcement. | Agents cheat mainly by editing tests | Phase 2 description |
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
| R25 | Ship default hooks: block destructive commands (`rm -rf`, `git reset --hard`, force-push, `--no-verify`); require approval for edits to test files; run formatters after edits. For Claude, the test-file guard is the primary defence against test gaming, not a backstop to R9. | Failure modes; CI implications | Phase 5 |
| R26 | Add a CI job that flags PRs changing tests, visual baselines or bundle budgets alongside implementation code unless a label approves it. LLM monitors caught only 42 to 65% of cheating on SWE-bench tasks, so this check should be deterministic. | Agents cheat mainly by editing tests; Rule sets earn their place only through ablation | Phase 6 |
| R27 | Any Claude-in-CI job uses `--bare` and never runs on fork PRs. | Non-obvious tips | Phase 6 |
| R28 | Web CI: types, lint, unit tests; then against the Vercel preview (bypass header, sent as a header rather than a query parameter): Playwright, axe per R44 plus the scripted checks in R45, Lighthouse CI (median of 3+ runs), per-route bundle budgets with size-limit; gitleaks, Semgrep or CodeQL, `npm audit`. Migration checks per R50. Re-test only previews deployed after any environment-variable change, because changes apply only to new deployments. | Web verification; Vercel | Section 7; Phase 6 |
| R29 | Prefer the Playwright CLI over Playwright MCP for agent browser checks in long sessions (about 4x fewer tokens; widely reported, primary benchmark not read). For Next.js runtime inspection, use `agent-browser` (which absorbed the former `next-browser`) or the `/_next/mcp` endpoint rather than a separate browser MCP. | Web verification; Framework drift and the official agent tooling | `web-platform` and `react-nextjs` packs |
| R30 | Point Next.js agents at the version-matched docs in `node_modules/next/dist/docs/` (Next.js 16.2+, now confirmed from the official guide). On 16.1 and earlier, use the `agents-md` codemod or the versioned `.md` docs. Check compilation through `/_next/mcp` `compile_route` while iterating and run `next build` before declaring done. Rules must reflect current defaults: `middleware.ts` is deprecated, not removed (keep it for Edge); `fetch` is uncached by default since Next.js 15; `use cache` requires `cacheComponents`. | Framework drift and the official agent tooling | `react-nextjs` pack |
| R31 | Unreal Tier 2: gate on the exported `index.json` (fail when `failed` > 0, and treat `notRun` > 0 as a failure) or on Epic's documented log line `**** TEST COMPLETE. EXIT CODE: <n> ****`, where 0 means no failures. Epic does not document the process exit code, so do not rely on it. Also fail on `Error:` log lines. Run `RunUAT BuildPlugin` per engine version with the R54 toolchain (Fab requires a separate upload per engine version); trusted events only; ephemeral or reset runner, low-privilege account, no secrets on the machine. | Unreal: a headless verification loop; Fab distribution and CI runners | Section 7 |
| R32 | Unreal Tier 1 `.uplugin` and source checks: validate platform allow and deny lists per module (the Fab requirement that every module declares one is still unverified, pending the user-supplied Fab requirements file); reject the deprecated `Developer` module type (R57); check `BuildSettingsVersion.V6` (R58); flag `TObjectPtr` members without `UPROPERTY`. | Unreal: plugin descriptors and module types | Section 7 |
| R33 | `unreal-engineer` checks unfamiliar symbols against installed engine headers, treats compiler output as authoritative, and does a full build with the editor closed after any header, `.Build.cs`, `.uplugin`, or reflection change. | Unreal section | Section 8; `unreal-plugin` pack |
| R34 | Treat Epic's official Claude Code plugin (v3.1.1, three skills: `unreal-mcp`, `create-toolset`, `unreal-skill`) and the Unreal MCP as **optional tooling for UE 5.8 projects only**. The MCP is documented only for 5.8 and absent from the 5.6 and 5.7 release notes, so the 5.6+ rule set must not depend on it. When used: commit before long sessions, never share one editor MCP server between parallel agents (tool calls run serially on the game thread), and remember it has no authentication and can run arbitrary Python. | Unreal: Epic's AI tooling is 5.8-only | Section 8; `unreal-plugin` pack; remove from section 12 |

## F. Evals (Phase 8)

| ID | Recommendation | Basis | Plan change |
|---|---|---|---|
| R35 | Four arms: no rules, full set, leave-one-pack-out, single-rule ablations for MUST rules. Opus 5.5 and Sonnet 5.5 at recorded effort levels; record the Claude Code version. | Eval design | Phase 8 |
| R36 | 20 to 50 tasks drawn from observed failures, each tagged with the failure mode a rule targets, including impossible-task variants run with and without the escape hatch (no study has measured this on 5.x Claude models), over-engineering temptations, a dirty working tree, a Next.js 16 task, an Unreal task that uses an API changed between 5.6 and 5.8, and a database task where `push` or `--force` is the tempting shortcut. | Eval design; Agents cheat mainly by editing tests | Phase 8 |
| R37 | Graders: held-out tests; deterministic diff and transcript checks (test edits, destructive commands, duplication, nonexistent dependencies, diff size); a calibrated LLM judge for scope and evidence-backed reporting. Report pass@1, pass^k (k of 3 or more), cost, and failure-mode rates. | Eval design | Phase 8 |
| R38 | Keep a rule only if it lowers its target failure rate without reducing success or adding disproportionate cost. | Rule sets earn their place only through ablation | Section 4; Phase 8 exit criteria |
| R39 | Move the eval harness earlier: build a small version in Phase 2 so rules are tested as they are written, not only at the end. | Inference from the context-file studies (none tested Opus or Sonnet 5.x) | Phases 2 and 8; milestones |

## G. Follow-up research

| ID | Recommendation | Basis |
|---|---|---|
| R40 | **Largely done (2026-10-05).** The arXiv full texts, Anthropic system cards, Epic docs, Next.js, Vercel and the database and Astro vendors were read directly; most figures were confirmed and several corrected. Still open: claims resting on support.fab.com, forums.unrealengine.com, metr.org, research.trychroma.com, gitclear.com, cognition.com, humanlayer.dev and newsletter.pragmaticengineer.com. None of those may support a MUST rule until read directly. | Evidence tags |
| R41 | **Mostly done (2026-10-05).** Epic coding standard, UE 5.6 to 5.8 release notes, Fab docs on dev.epicgames.com and agent-safe Postgres migration practice are now sourced. Still open: the Fab technical requirements on support.fab.com, pending the user-supplied `docs/research/sources/fab-requirements.md`; BuildPlugin flags, Unreal Insights headless flags and the editor's process exit code, to verify on the runner (R55). | Conclusion |

## H. Additions from the follow-up pass: web stack (`react-nextjs`, `static-sites`, `web-platform` packs)

| ID | Recommendation | Basis | Plan change |
|---|---|---|---|
| R42 | Agents must not edit or remove the Next.js-managed block between `<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->` in `AGENTS.md`; commit it as-is and put project rules outside it. The rules build step and installer skill write outside the markers. `next dev` (16.3+) re-adds the block and upserts `AGENTS.md` and `CLAUDE.md`, so an agent that "cleans up" the diff fights the dev server. | Framework drift and the official agent tooling; Implications: repository and distribution | `react-nextjs` pack; section 6 build step; web template |
| R43 | Treat the Vercel MCP as a privileged credential: it has the same access as the user's Vercel account. Allow read tools; require a permission prompt (Claude Code permission rules or a PreToolUse hook) for deploy, promote, rollback, environment-variable create/edit, decrypt, project delete, protection-bypass changes and all purchase tools. Never decrypt environment values unless the user asks. | Vercel: previews, a privileged MCP server and function limits | `node-services` pack; template `.claude/settings.json`; Phase 5 hooks |
| R44 | Run axe with `runOnly` tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`, and explicitly enable `target-size`, because it is the only WCAG 2.2 rule in axe-core 4.13 and is disabled by default. Add a test that fails if `target-size` did not run. Treat its "needs review" results as judgement tasks. | Web verification (axe-core rule list) | `web-platform` pack; section 7 |
| R45 | Add scripted checks for the WCAG 2.2 criteria axe cannot test: 2.4.11 (keyboard traversal asserting the focused element is not covered by sticky content), 2.5.7 (a single-pointer alternative for every drag interaction), and 3.3.8 (paste allowed and no cognitive test on credential fields). | Web verification | `web-platform` pack; Phase 6 |
| R46 | Docs order for framework knowledge: bundled docs in `node_modules` first, then the vendor's versioned `.md` or llms.txt pages, then Context7. Do not make Context7 the only source, since it is a rate-limited third-party service that may be unavailable in CI. Astro does not publish llms.txt; use its docs MCP server instead. | Framework drift and the official agent tooling | `web-platform`, `react-nextjs`, `static-sites` packs |
| R47 | Before starting a dev server, check for one already running (`.next/dev/lock`, `astro dev status`), and read its logs (`astro dev logs`) rather than starting a duplicate. For Astro 7, verify CSP with `astro build` and `astro preview`, because `astro dev` does not enforce it. For Next.js, report any route that flips from static to dynamic after a CSP change. | Framework drift and the official agent tooling | `react-nextjs`, `static-sites` packs |
| R48 | Teach the Vercel function limits agents most often hit (4.5 MB request or response body, 300 s default duration, 1,024 file descriptors including database connections) and point agents to Blob or Workflows rather than raising limits. Prefer the Node.js runtime over Edge, as Vercel recommends. | Vercel: previews, a privileged MCP server and function limits | `node-services` pack |

## I. Additions from the follow-up pass: Postgres migrations (`node-services` pack)

| ID | Recommendation | Basis | Plan change |
|---|---|---|---|
| R49 | Agents never run `drizzle-kit push`, `prisma migrate dev`, `prisma migrate reset`, `prisma db push` or Drizzle's `--force` against shared databases (preview, staging, production). They generate migration files for review. Enforce with a PreToolUse Bash hook. Prisma 8's `db migrate` "applies destructive operations without stopping to ask", so review before apply is the only gate. | Postgres on Vercel | `node-services` pack; Phase 5 hooks |
| R50 | Lint new migration SQL in CI with squawk (fail on `DROP COLUMN`, `DROP TABLE`, non-concurrent index creation and validated constraints unless a human-approved label exists), and ship breaking changes as expand, backfill and contract across separate deploys (Prisma 8's documented pattern, or pgroll). Run `prisma migration check` or `drizzle-kit check` too. | Postgres on Vercel | `node-services` pack; section 7 |
| R51 | Treat Neon preview branches as containing production data, because they copy the parent's data by default. Teams with personal data use schema-only branches, branch from an anonymized parent, or use Supabase-style data-less branches seeded from `seed.sql`. Agents testing previews must not export or log that data. | Postgres on Vercel | `node-services` pack; web template |
| R52 | Run migrations over the direct, unpooled connection URL; the app uses the pooled URL. Production migration is a separate, gated pipeline step, not part of the Vercel build command, because a build-step migration also runs on production builds. | Postgres on Vercel | `node-services` pack; section 7 |
| R53 | Pin the ORM major version in each project's rules and name its commands. Prisma 7 uses `migrate deploy`; Prisma 8 (a release candidate, but tagged `latest` on npm and now the docs default) uses `prisma db migrate`, `migration plan` and `migration check`. Agents should read the installed version before running any migration command. | Postgres on Vercel | `node-services` pack |

## J. Additions from the follow-up pass: Unreal (`unreal-plugin` pack, Tier 1 and Tier 2 CI)

| ID | Recommendation | Basis | Plan change |
|---|---|---|---|
| R54 | Keep a per-engine-version toolchain matrix on the Unreal runner: 5.6 with MSVC 14.38 or later and VS 2022 17.8+ (Epic's farm uses 14.38.33130); 5.7 with MSVC 14.44 and VS 2022 17.14+ (MSVC 14.50 is unsupported on 5.7); 5.8 with VS 2026 and MSVC 14.50 recommended (14.38 minimum). Windows SDK 10.0.22621.0 or newer throughout. Select the toolchain per job rather than using the newest installed one. | Toolchains and APIs change with every engine release | Section 7 Tier 2; Phase 6 workflow |
| R55 | Verify `RunUAT BuildPlugin` flags (including whether `-StrictIncludes` is the default) from `Engine/Source/Programs/AutomationTool/Scripts/BuildPlugin.Automation.cs` on the runner in Phase 3, along with Unreal Insights headless flags and the editor's process exit code on failing tests. No Epic doc page covers them. | A headless verification loop | Phase 3 task; section 12 |
| R56 | Add rules from the Epic coding standard that agents most often break: C++20; `auto` only for lambdas, verbose iterators and hard-to-name template types; no structured bindings; explicit lambda captures, with weak captures for deferred lambdas; `.cpp` includes its own header first, with no catch-all `Core.h` includes; `UPROPERTY() TObjectPtr<T>` for UObject members and raw pointers for locals and parameters; `b`-prefixed booleans; no `const` return values. Leave formatting to clang-format (R5). | The Epic coding standard gives crisp, checkable rules | `unreal-plugin` pack |
| R57 | Avoid the deprecated `Developer` module type ("Deprecated due to ambiguities"); use `DeveloperTool`, `Editor` or `UncookedOnly`. Tell agents that Epic's own Plugins page example is stale on this point and that the API reference field names (`PlatformAllowList`/`PlatformDenyList`) beat the Modules page. | Plugin descriptors and module types | `unreal-plugin` pack; R32 lint |
| R58 | For 5.7 and later, `*Target.cs` files set `DefaultBuildSettings = BuildSettingsVersion.V6`. Add a Tier 1 check. | Toolchains and APIs change with every engine release | `unreal-plugin` pack; Tier 1 CI |
| R59 | Code that must compile on 5.6 through 5.8 uses version guards or project-level wrappers for 5.8-only APIs (`UE_LOGF`, `UE_PLATFORM_*`, `FCoreDelegates::GetOnPostEngineInit()`), and agents check every API against the installed headers for each engine version, because 5.8 removed many items deprecated in 5.0 to 5.6. | Toolchains and APIs change with every engine release | `unreal-plugin` pack; R33 |
| R60 | Use Epic's test ladder for plugins: Low-Level Tests in a `Tests` folder beside `Source` for pure logic, Automation Spec or CQTest for UObject-level tests, functional tests for maps, and Gauntlet only for cooked or multi-process runs. Generate the clang compilation database once, outside the inner build loop. | A headless verification loop | `unreal-plugin` pack; practice guide |

## Questions to add to plan section 12

1. Does Claude Code send rule-file frontmatter to the model? **Open**; test in Phase 1. (R7)
2. Does Epic's MCP plugin work on UE 5.6 or 5.7? **Answered: almost certainly no.** It is documented only for 5.8 and absent from the 5.6 and 5.7 release notes; no official source names a minimum version. (R34)
3. What do the current Fab technical requirements and Epic coding standard say? **Coding standard answered** (R56). **Fab requirements pending** the user-supplied `docs/research/sources/fab-requirements.md`; the per-module platform list requirement and compiler versions remain unverified. (R32, R41)
4. What sourced practice exists for agent-safe Postgres migrations on Vercel? **Answered** (R49 to R53). (R41)
5. Do the full texts confirm the abstract-only figures? **Answered: mostly yes**, with corrections to ImpossibleBench, the ETH AGENTS.md study and the configuration-smells paper. Claims resting on still-blocked sites stay flagged. (R40)
6. Which `BuildPlugin` flags and Unreal Insights headless flags exist in the installed engines? **Open**; verify on the runner in Phase 3. (R55)
7. What process exit code does `UnrealEditor-Cmd` return when automation tests fail? **Open**; Epic documents only the log line and JSON report. Verify on the runner; gate on the report regardless. (R31, R55)
