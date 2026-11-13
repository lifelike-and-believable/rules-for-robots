---
status: approved
unlocks:
  - test/plugin-split.test.mjs: AC-5's build copies no longer include guard-outcome.mjs, removed with the prompts it logged (rewrite plan 25e (2026-11-12) removes task approval, default allow, "permissions": "ask", and guard-outcome); lib.mjs is still checked
  - test/hooks.test.mjs: AC-2 moves the editor -ExecCmds check from guard-commands to rfr-unreal's guard-unreal, so the #56 test calls guard-unreal and asserts guard-commands no longer decides it; AC-1 moves guard-mcp to rfr-web, so its imports change path; nothing else changes
  - test/guard-corpus.test.mjs: AC-1 and AC-2 move guard-mcp and the ExecCmds check to rfr-web and rfr-unreal, so the runner imports them from their new plugins and runs an `unreal` guard; nothing else changes
  - test/fixtures/guard-corpus.json: AC-2 makes the ExecCmds case an `unreal` guard case; its tier and source do not change
  - test/guard-outcomes.test.mjs: AC-1 and AC-2 give each domain plugin its own guard-outcome hook for the tools its guards cover, so rfr-core's no longer covers MCP tools and the registration test checks each plugin; AC-6 adds a test for several logs
---

# Domain plugins

Split the domain-specific parts of `rfr-core` into two new plugins, `rfr-web` and `rfr-unreal`, so a project installs only what its domain uses. `rfr-core` keeps everything that applies to any project. This finishes the layout `PLAN.md` section 6 always listed (`plugins/web/`, `plugins/unreal/`), which was folded into `rfr-core` for the first release. Approved by the project lead on 2026-11-08.

## Problem

`rfr-core` carries skills, agents, and hooks for both domains. A website project installs the Unreal packaging and profiling skills, the `unreal-engineer` agent, and an Unreal editor check in its shell guard; an Unreal plugin project installs the web accessibility and performance audits, the `web-engineer` agent, and a Vercel guard. Each unused skill is listed in every session's skill list, where it costs context and competes with the skills the project does use (the routing research in `docs/research/notes/third_party_tools_for_core.md`, Q1, found four review skills side by side in one session). Unused hooks run on every matching tool call.

## Decisions (lead, 2026-11-08)

1. The three reviewer agents that cover both domains, `accessibility-reviewer`, `performance-reviewer`, and `ux-reviewer`, stay in `rfr-core`. Their prompts carry both domains' sections, which costs context only when the agent runs, and `review-pr` keeps choosing them as it does now.
2. The split ships as one breaking release: `rfr-core` 4.0.0 without the domain parts, and `rfr-web` 1.0.0 and `rfr-unreal` 1.0.0 with them, released together. No transition release keeps copies in `rfr-core`.

## The split

| Plugin | For | Holds |
|---|---|---|
| `rfr-core` | Every project | The guards (`guard-commands`, `guard-test-edits`, `guard-owned-paths`, `guard-outcome`, `format-on-edit`); the agents `code-reviewer`, `security-reviewer`, `accessibility-reviewer`, `performance-reviewer`, `ux-reviewer`, `citation-checker`, `check-runner`, `software-architect`, `tech-lead`, `test-change-reviewer`; the skills `review-pr`, `plan-feature`, `write-adr`, `security-audit`, `release`, `merge-when-green`, `install-rules`, `lookup-api` |
| `rfr-web` | Websites and web apps | The agent `web-engineer`; the skills `a11y-audit` and `perf-audit`; the Vercel MCP guard `guard-mcp` (NODE-002) |
| `rfr-unreal` | Unreal Engine plugins | The agent `unreal-engineer`; the skills `package-unreal-plugin` and `profile-unreal-plugin`; the editor check that an `-ExecCmds` list ends with `Quit`, moved out of `guard-commands` into its own hook |

`rfr-process` and `rfr-feedback` do not change, apart from names they mention.

## User stories

- As a developer building a website, I want only web and general skills in my sessions, so that the skill list is shorter and the right skill is picked.
- As a developer building an Unreal plugin, I want the Unreal skills and checks without the web audits and the Vercel guard.
- As an adopter updating from 3.x, I want the release notes to tell me exactly which plugin to enable, so that no skill I use disappears without warning.
- As a maintainer, I want each plugin to work on its own and with the others, checked in CI.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | `plugins/web/` is the `rfr-web` plugin with `web-engineer`, `a11y-audit`, `perf-audit`, and the `guard-mcp` hook for Vercel MCP tools, and its own `guard-outcome` hook for those tools. Its guard behaves as it does in `rfr-core` 3.x. | test: the guard corpus and the guard-mcp tests run against the new path. |
| AC-2 | `plugins/unreal/` is the `rfr-unreal` plugin with `unreal-engineer`, `package-unreal-plugin`, `profile-unreal-plugin`, and a `guard-unreal` PreToolUse hook (Bash and PowerShell) that asks when an `UnrealEditor` command's `-ExecCmds` list does not end with `Quit`, with its own `guard-outcome` hook. `guard-commands` no longer makes that check. | test: the ExecCmds corpus case runs against `guard-unreal`; `guard-commands` returns no decision for it. |
| AC-3 | No file under `plugins/core/` requires a domain plugin. Where a core agent or skill names a domain agent or skill (`tech-lead` assigning `web-engineer` or `unreal-engineer`, `perf-audit` pointing to `profile-unreal-plugin`, `release` pointing to `package-unreal-plugin`), it uses the plugin-qualified name and says what to do when that plugin is not installed. | test: a check lists every agent and skill name a plugin's files mention and fails on a name that is neither in that plugin nor qualified with another rfr plugin's name. |
| AC-4 | The marketplace lists `rfr-web` and `rfr-unreal`, and `npm run validate:plugins` validates all five plugins. Each domain plugin declares its dependency on `rfr-core` in `plugin.json` if Claude Code supports a dependency field (to be confirmed in the plugins reference), and says so in its README either way. | test: the marketplace lists each plugin folder; `validate:plugins` covers each. |
| AC-5 | Scripts a domain plugin's hooks need from `rfr-core` (`lib.mjs`, and what `guard-mcp` and `guard-outcome` import) are copied into that plugin by `npm run build`, as libraries are copied into plugins today, and `build:check` fails when a copy is stale. A plugin never imports from another plugin's folder. | test: `build:check` on a stale copy; a scan finds no import that leaves the plugin's folder. |
| AC-6 | Each plugin with guards logs to its own data folder, so `checks/guard-report.mjs` accepts several log files and reports them together. | test: two fixture logs reported together. |
| AC-7 | The template repos enable `rfr-core` with `rfr-web` (web app, static site) or `rfr-unreal` (Unreal plugin): `build/profiles.json` names each profile's plugins, and the build writes `enabledPlugins` from it. `install-rules` tells the user which domain plugin to enable for the profile it installs. | test: each rendered template's settings enable the profile's plugins. |
| AC-8 | The eval harness loads every plugin a case names (`plugins` in `case.json`, defaulting to `rfr-core`), and the cases that use `web-engineer` or `unreal-engineer` name the domain plugin. | test: the harness's plugin arguments for a case that names two plugins. |
| AC-9 | Documentation names skills and agents by their new plugins: the root README, the adoption guide, the plugin READMEs, `practices/`, and `practices/guards.md`. No `/rfr-core:` name of a moved skill or agent remains outside the changelog and `docs/research/`. | test: a scan for the moved names under `rfr-core:`. |
| AC-10 | `rfr-core` 4.0.0, `rfr-web` 1.0.0, and `rfr-unreal` 1.0.0 are released together. The changelog entry lists every moved skill, agent, and hook with its new plugin, and its Adopters line says: enable `rfr-web` for web projects and `rfr-unreal` for Unreal plugins, and use the new names (`/rfr-web:a11y-audit`, `/rfr-web:perf-audit`, `/rfr-unreal:package-unreal-plugin`, `/rfr-unreal:profile-unreal-plugin`). | review: the changelog and the release. |

## Scope

- In: the two new plugins and the moves; the build copies; the marketplace and validation; template settings and `install-rules` guidance; the eval harness; documentation; the release.
- Out: splitting the rule packs or the `install-rules` payload by domain (rules are already chosen per profile); splitting the cross-domain reviewers (decision 1); changes to `rfr-process` or `rfr-feedback` beyond names they mention; any change to what a guard decides.

## APIs and assumptions

- Claude Code namespaces a plugin's skills and agents by the plugin name (`/rfr-web:a11y-audit`, `rfr-web:web-engineer`), so moving a skill changes its name for users.
- A plugin's hooks run from its own folder (`${CLAUDE_PLUGIN_ROOT}`) and cannot import from another plugin, which is why shared scripts are copied by the build (AC-5).
- `CLAUDE_PLUGIN_DATA` is per plugin, so each plugin's guards log separately (AC-6).
- `claude plugin validate --strict` (2.1.319) accepts a `dependencies` field in `plugin.json`; whether Claude Code installs or enables a declared dependency is not yet confirmed, so AC-4 checks the plugins reference before relying on it.

## Delivery

- Plan or roadmap item: `PLAN.md`, Phase 16.
- Order: after #143 and #146 merge, because both change `plugins/core/` heavily.
- Slices: 16a the two plugins, the moves, the build copies, the marketplace, and the guard changes (AC-1 to AC-6); 16b templates, `install-rules`, the eval harness, and documentation (AC-7 to AC-9); then the release (AC-10). `main` holds the moves between 16a and 16b under `[Unreleased]`; nothing is released until both slices are in.
- Pull requests: #147 (spec), #148 (16a), #150 (16b and the release).
