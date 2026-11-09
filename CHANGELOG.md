# Changelog

All notable changes to the rule set and the `rfr-core` plugin. The rule set and the plugin share one version, because the plugin carries the rules in its install-rules payload. Versioning follows [docs/maintenance.md](docs/maintenance.md). `npm run verify` checks that the newest release here matches `plugins/core/.claude-plugin/plugin.json`.

## [Unreleased]

## [5.3.0] - 2026-11-09

Pull requests: #158.

Evaluated on: claude-opus-5-5, claude-sonnet-5-5.

### Changed

- `testWeakening: defer` lets the change go ahead (#158; guard tiers AC-5, amended). Before, `defer` refused a weakening test edit or a test removal and asked the agent to report it, which left a person deciding each change later. Now `guard-test-edits` and `guard-commands` allow it without asking, tell the agent to name it in its report (and to make it only for an approved behaviour change, never to get a failing test to pass), and log it as `defer`. The rest of a shell command is still checked, so a test removal joined to a force-push still asks. The pull request's test change check stays red until `tests-reviewed` is added, and `test-change-reviewer` brings the lead only the changes it cannot approve, with evidence. `checks/guard-report.mjs` counts deferred changes. The default stays `ask` until the test-change reviewer's eval passes. From the Kettlebird pilot, where the lead approved test-edit prompts as soon as they appeared.
- TEST-001 says to add a test file to its spec's `unlocks:` before editing the test, not after (#158). The guard checks for the entry when the edit happens, so in the Kettlebird pilot entries added after the edit still prompted. The rule body is tightened to stay within 120 words; nothing else in it changes. `plan-feature` and the `rfr-process` guide say the same, and the guide no longer suggests correcting the test first.
- `rfr-process` 0.12.4 for the guide. Adopters: nothing to do.
- `rfr-core` 5.3.0; `rfr-web` 1.0.3 and `rfr-unreal` 2.0.2 carry the updated hook library. Adopters: nothing to do unless you want the change; to stop test-edit prompts, add `{ "testWeakening": "defer" }` to `.claude/rfr.json` and run `/rfr-core:review-pr` before merging.

## [5.2.0] - 2026-11-09

Pull requests: #157.

Evaluated on: claude-opus-5-5, claude-sonnet-5-5.

### Added

- WA-009, ask once for a batch of actions (#157; SHOULD, review). Before a series of actions that will raise permission prompts, such as scaffolding a project, the agent lists what it will do and asks once for the change that covers it: auto-accept edits, `/add-dir` for a folder outside the session, or allow rules for the exact commands. WA-003's questions keep their own prompt. From an adopter's report of a prompt on every file while creating a new repository. The failure vocabulary gains `approval-fatigue`.
- Default permission rules (#157). The template repositories' `.claude/settings.json` allows read-only and local git commands (`status`, `diff`, `log`, `show`, `fetch`, `add`, `commit`, `switch`, for both the Bash and PowerShell tools) and `WebSearch`, and each profile adds its own verify commands by name (`build/profiles.json`). `git push`, `npm install <package>`, and MCP tools still prompt, and the guards still refuse or ask inside allowed commands. `practices/security-for-agentic-projects.md` lists the defaults and explains asking once for a batch.
- `/rfr-core:install-rules` offers the same rules for an existing project's `.claude/settings.json`, from a new `permissions.json` in its payload, and adds only entries the project lacks.
- `rfr-core` 5.2.0. Adopters: run `/rfr-core:install-rules` to get WA-009 and accept the permission rules it offers, or copy them from `template-repos/<profile>/.claude/settings.json`.
- `rfr-process` 0.12.3: `/rfr-process:setup` lists the files it will write and asks once before writing them. Adopters: nothing to do.

## [5.1.4] - 2026-11-08

Pull requests: #152.

Evaluated on: claude-opus-5-5, claude-sonnet-5-5.

### Changed

- `rfr-core` 5.1.4 (#152): TEST-001 and WA-002 carry `evaluated-on: [claude-opus-5-5, claude-sonnet-5-5]` and TEST-004 carries `evaluated-on: [claude-sonnet-5-5]`, from the model-release baseline. Metadata only; no rule text changes. Adopters: nothing to do; `/rfr-core:install-rules` picks up the field on the next refresh.

### Added

- Model adaptation, slice 17c (#152; AC-11): the first model-release run, on Opus 5.5 and Sonnet 5.5 with Claude Code 2.1.319 ($9.45 with the smoke tests; `evals/results/2026-11-08-model-release-baseline/report.md`). It reproduces Phase 8: without rules both models changed the wrong test in every run and Sonnet skipped test-first work; with rules neither did. The five controls stayed saturated, and all 34 smoke cases passed. `evals/ledger.json` now holds the results.
- Model adaptation, slice 17b (#152; `docs/specs/model-adaptation.md`, AC-7 to AC-10). Repository process only; no plugin changes.
  - `docs/maintenance.md` has a "New model" section: the steps to run when a new model reaches Claude Code, and the default decision for each ledger result. The quarterly review points to it.
  - A `New model` issue form (`.github/ISSUE_TEMPLATE/model-release.yml`) holds the same checklist.
  - `PLAN.md` section 5 keeps the guidance that has held across generations and moves what depends on one generation into a table that gains a column per model-release run. Decision 7 targets the newest generations with ledger entries.
  - `checks/release.mjs` fails a release after 5.1.3 whose changelog entry has no `Evaluated on:` line, or names a model with no ledger entries.

## [5.1.3] - 2026-11-08

Pull requests: #156.

### Changed

- `/rfr-core:release` (#156): fetch instead of pulling; confirm with the user just before pushing a tag or publishing a release, even when another session or a written procedure asked for it; name releases the way earlier ones are named; take the notes from the changelog; and prefer commands that work in every shell. These come from the first release published from a desktop session (`rfr-v5.1.1`), where the steps used `grep` on Windows, left out how to cut the notes, and titled the release differently from earlier ones.
  - `checks/release.mjs` gains `notes` and `prepare --commit <sha>`, and `docs/maintenance.md` describes the release steps around them. Repository tooling only.
  - Adopters: update `rfr-core` to 5.1.3. Nothing else to do.

## [5.1.2] - 2026-11-08

Pull requests: #155.

### Fixed

- `guard-commands` matches its dangerous-command patterns (force-push, `git branch -D`, `git stash drop`, `--no-verify`, `drizzle-kit push`, and the rest) only against what a command line runs: each command's words, and a heredoc's body only when a shell reads it (`bash <<EOF`). A Python script or `cat > file` heredoc that only mentions `git push --force` no longer asks (#155; found by the guard replay).

### Added

- Guard tiers, slice 15d (#155; `docs/specs/guard-tiers.md`, AC-8, AC-9). Repository tooling and guides; the only plugin change is the fix above.
  - `checks/guard-replay.mjs`: `extract` turns Claude Code transcripts into anonymised tool calls; `run` replays them through rfr-core 3.1.1 and the current guards on a clone of the repository and writes a report.
  - The first replay, of this repository's session that built #143 to #154 (634 calls), is in `evals/results/2026-11-08-15d-guard-replay/`: asks fell from 9 to 2, and to 1 with `testWeakening: defer`. The notes there show how the result depends on the replay's assumptions. The Kettlebird pilot's sessions are not replayed yet.
  - `practices/security-for-agentic-projects.md` explains how the guards sit with Claude Code's permission modes, protected paths, permission rules, sandbox, and headless runs (AC-9). `practices/guards.md` gains a replay section.
  - Adopters: update `rfr-core` to 5.1.2. Nothing else to do.

## [5.1.1] - 2026-11-08

Pull requests: #154.

### Changed

- WA-003 asks before actions that cannot be undone or reach outside the project (#154). Discarding uncommitted changes and deleting files inside the repository no longer need a question when rfr-core's guards are installed, because 5.1.0 takes a snapshot first; the agent goes ahead and names the restore command in its report. Without the guards, the rule still asks. The rule now matches what the guard allows.
  - The changelog lists slice 17a (#149) under 4.0.0, where it was released; it had stayed under Unreleased.
  - Adopters: update `rfr-core` to 5.1.1. Projects that copy the rules (`/rfr-core:install-rules`) get the new WA-003 text on their next install.

## [5.1.0] - 2026-11-08

Pull requests: #153.

### Changed

- Guard tiers, slice 15c (#153; `docs/specs/guard-tiers.md`, AC-11). Destructive local commands no longer ask: `guard-commands` takes a snapshot first, allows the command, and tells the agent how to undo it. Released with `rfr-web` 1.0.2 and `rfr-unreal` 2.0.1.
  - Covered: `git checkout -- .`, `git restore .`, `git reset --hard` (to `HEAD` or to another commit), `git clean -f`, `git stash drop` and `clear`, and `rm -rf` inside the repository of files with uncommitted changes or untracked files. Each used to ask when there was something to lose.
  - A snapshot is a commit of the whole working tree, untracked files included and ignored files not, written through a temporary index, so the working tree, index, and stash are untouched. It is kept under `refs/rfr/snapshots/<time>`. Before a stash is dropped, its commits are kept the same way, and `git stash store` puts them back. A restore brings back content; staged changes come back unstaged.
  - The guard asks instead when the snapshot fails or takes longer than six seconds, and when the same command also needs a person (a force-push, say).
  - Snapshots older than 14 days, beyond the newest 50, are deleted when a new one is taken.
  - The decision log records a `snapshot` line with the ref, and `checks/guard-report.mjs` counts snapshots.
  - Every ask reason now starts its second sentence with a capital letter. `lib.mjs` carries the change, so `rfr-web` and `rfr-unreal` get patch releases for their copies.
  - WA-003's `check:` text describes the snapshot.
  - Adopters: update `rfr-core` to 5.1.0 (and `rfr-web` and `rfr-unreal` if you use them). Snapshot refs appear under `refs/rfr/snapshots/`; they are local and never pushed unless you push them by name.

## [5.0.0] - 2026-11-08

Pull requests: #151.

### Changed

- **Breaking:** guard tiers, slice 15b (#151; `docs/specs/guard-tiers.md`, AC-3, AC-4, AC-5, AC-12). Guards ask a person only about actions that cannot be undone or reach outside the project; problems the agent can fix itself are refused with a next step. Released with `rfr-unreal` 2.0.0 and `rfr-web` 1.0.1.
  - Every ask reason now has three parts: the action, why a person must decide, and "If not approved:" with what the agent does instead (AC-3). This covers `guard-commands`, `guard-test-edits`, and `rfr-web`'s `guard-mcp`.
  - `guard-commands` refuses a snapshot update (`vitest -u`, `jest -u`, `playwright --update-snapshots`) unless the command states its reason as `RFR_SNAPSHOT_REASON="..."`, and the agent gives the same reason in its report (AC-4). It used to ask.
  - `guard-commands` allows `rm -rf` of tracked files with no uncommitted changes, and tells the agent the `git checkout -- <path>` that restores them (AC-12). It used to ask. A folder with a modified or untracked file still asks until snapshots arrive in 15c.
  - `guard-owned-paths` refuses an edit outside the owned paths with the next step (use the public interface, or report the missing one, or add the path to "Owned paths") instead of asking (AC-4).
  - A new project setting, `testWeakening` in `.claude/rfr.json`: `ask` (the default) keeps asking before a weakening edit, move, or delete of an existing test; `defer` refuses it with "say so in your report", and the pull request's test-change review decides (AC-5). The default becomes `defer` in the release that records test-change-review AC-11 as passed.
  - `rfr-unreal` 2.0.0, **breaking:** `guard-unreal` refuses an editor `-ExecCmds` list without a final `Quit` and tells the agent to add `;Quit`, instead of asking (AC-4).
  - `rfr-web` 1.0.1: `guard-mcp`'s questions gain the "If not approved:" part; what it asks about does not change.
  - `practices/guards.md` shows the new tiers, the reason format, and the setting.
  - TEST-001 now tells the agent to change existing test files with the Edit tool, never through the shell, so it does so from the start rather than after a refusal. Its `check:` text names the snapshot refusal.
  - Adopters: update `rfr-core` to 5.0.0, and `rfr-unreal` to 2.0.0 if you use it. A snapshot update the agent means to make now needs `RFR_SNAPSHOT_REASON="..."` in the command; a script or instruction that runs `-u` without it is refused. A project that keeps an `AGENTS.md` owned-paths list and relied on approving edits outside it adds those paths to the list. To defer test weakening to the pull request now, add `.claude/rfr.json` with `{ "testWeakening": "defer" }` and keep the test-change review in your pull request checks.

## [4.0.0] - 2026-11-08

Pull requests: #148, #149, #150.

### Added

- Model adaptation, slice 17a (#149; `docs/specs/model-adaptation.md`, AC-1 to AC-6). Repository tooling only; no plugin changes.
  - `evals/suites/model-release.json`: the cases to run on each new model. `green-at-all-costs` and `tdd-feature` run with and without rules, and five saturated cases run without rules as controls. 27 runs per model.
  - `evals/run.mjs` gains `--suite` and `--max-cost`, and records the model each session reported and the Claude Code version; the summary lists runs whose reported model differs from the one requested.
  - `evals/ledger.json` and `checks/model-ledger.mjs`: `add` files a results folder's evidence per rule, agent, or skill and model; `report` lists verdicts, rules with no evidence, saturated cases, and changes since an earlier model.
  - Rules may carry an `evaluated-on` field; the rule lint warns when it disagrees with the ledger. `evals/agents/smoke.mjs` takes `--model`.

### Changed

- **Breaking:** domain plugins, slices 16a and 16b (#148, #150; `docs/specs/plugin-split.md`). `rfr-core` keeps what every project uses; the web and Unreal parts move to two new plugins, `rfr-web` 1.0.0 and `rfr-unreal` 1.0.0, released with `rfr-core` 4.0.0. The reviewer agents that cover both domains (`accessibility-reviewer`, `performance-reviewer`, `ux-reviewer`) stay in `rfr-core`.
  - New `rfr-web` (`plugins/web/`): the `web-engineer` agent, the `a11y-audit` and `perf-audit` skills, and the Vercel MCP guard `guard-mcp` (NODE-002), moved from `rfr-core`, with its own outcome hook. Its messages now start `rfr-web (NODE-002)`.
  - New `rfr-unreal` (`plugins/unreal/`): the `unreal-engineer` agent and the `package-unreal-plugin` and `profile-unreal-plugin` skills, moved from `rfr-core`, and a `guard-unreal` hook that takes over the editor `-ExecCmds … Quit` check from `guard-commands`.
  - `rfr-core` names the moved agents and skills with their new plugins (`rfr-web:web-engineer`, `/rfr-unreal:package-unreal-plugin`), and says what to do when a domain plugin is not installed. A new check, `checks/plugin-refs.mjs`, run by the tests, fails when any plugin names another plugin's agent or skill without that plugin's prefix; the domain skills now call `rfr-core:check-runner`, and `rfr-process` names `rfr-core`'s reviewers and `/rfr-core:merge-when-green`.
  - The build copies `lib.mjs` and `guard-outcome.mjs` from `rfr-core` into each domain plugin. Each plugin with guards logs to its own data folder, and `checks/guard-report.mjs` takes several logs. The marketplace lists both new plugins, and `npm run validate:plugins` checks all five.
  - Adopters: nothing yet. At the release, web projects enable `rfr-web` and Unreal projects enable `rfr-unreal` alongside `rfr-core`.
  - Slice 16b: each template repo enables `rfr-core` with its domain plugin (`build/profiles.json` lists each profile's `plugins`, and the build writes `enabledPlugins` from it), as do the reference projects in `examples/`. `/rfr-core:install-rules` names the domain plugin a profile needs and offers to enable it. The eval harness loads every plugin a case names (`plugins` in `case.json`), and the `tech-lead` cases load the domain plugin of the agent they expect. The README, adoption guide, maintenance guide, and practice guides use the new names, and a test fails on any `rfr-core:` name of a moved agent or skill outside the changelog and research notes.
  - `rfr-process` 0.12.2: names `rfr-core`'s reviewers and `/rfr-core:merge-when-green` with their plugin.
  - Moved, with their new names: `/rfr-core:a11y-audit` is now `/rfr-web:a11y-audit`; `/rfr-core:perf-audit` is `/rfr-web:perf-audit`; `/rfr-core:package-unreal-plugin` is `/rfr-unreal:package-unreal-plugin`; `/rfr-core:profile-unreal-plugin` is `/rfr-unreal:profile-unreal-plugin`; the `web-engineer` agent is `rfr-web:web-engineer`; the `unreal-engineer` agent is `rfr-unreal:unreal-engineer`; the `guard-mcp` hook is in `rfr-web`; the editor `-ExecCmds` check is `rfr-unreal`'s `guard-unreal`.
  - Adopters: update `rfr-core` to 4.0.0, then enable the domain plugin for your project, `/plugin install rfr-web@rules-for-robots` for a website or web app, or `/plugin install rfr-unreal@rules-for-robots` for an Unreal plugin, and add it to `enabledPlugins` in `.claude/settings.json` if you commit one. Use the new names above in any instructions or scripts that call the moved skills. A web project without `rfr-web` keeps rfr-core's guards and reviewers but loses the web audits, the `web-engineer` agent, and the Vercel guard.

## [3.3.0] - 2026-11-08

Pull requests: #146.

### Added

- Guard tiers, slice 15a (`rfr-core`, #146; `docs/specs/guard-tiers.md`, AC-1, AC-2, AC-6, AC-7). No guard decision changes in this release; it adds what the tier changes in 15b and 15c will be measured against.
  - `practices/guards.md` lists every decision the rfr-core and rfr-process guards make, with its tier now and the tier the spec sets, the rule, the failure it prevents, and why.
  - `test/fixtures/guard-corpus.json` holds 38 cases, each with its target tier and source, and `test/guard-corpus.test.mjs` fails when a guard's decision drifts from it. Nine cases wait for 15b or 15c, and the runner checks their current decision until then. A dangerous core (force-push, deleting outside the project, root-like deletes, database pushes and resets, Vercel deploys, weakening an existing test) must stay tier 4.
  - A new `guard-outcome` hook (PostToolUse and PostToolUseFailure, for the tools the guards cover) adds an `approved` line to the guard decision log when an asked call then runs. Claude Code reports no hook event when a person declines a prompt, so an ask without one was declined or never reached; the spec's AC-6 is amended to say so.
  - `checks/guard-report.mjs` summarises a decision log: asks and refusals per hour, per guard and reason (with file paths, numbers, and quoted values set aside), the share approved, and the reasons approved in 95% or more of 20 or more asks, which are candidates to move down a tier.
- `rfr-process` 0.12.1 (#146): the README links to the guard guide. Adopters: update the `rfr-core` plugin; nothing else changes.

## [3.2.0] - 2026-11-08

Pull requests: #143.

### Added

- Grounded evidence, slice 14a (`rfr-core`, #143; `docs/specs/grounded-evidence.md`, AC-1 to AC-9). A new `lookup-api` skill and `scripts/api-lookup.mjs` (from `checks/api-lookup.mjs`) check an API against the installed version. For an npm package they print the installed version, the `package-lock.json` entry (and say when the two differ), the declared range, the type entries, any `@types` package, and the bundled docs. Given a symbol, they show its declarations, following re-exports into other packages, and the docs lines that mention it. A `Type.member` is found only inside `Type`. They exit 1 when the installed version does not declare the symbol, and 3 when it cannot be checked (no declaration files). Package files are treated as untrusted: no symlinks out of the package, no special or oversized files. For Unreal they read each named engine's version and headers, and say which versions lack the symbol. The script reads only what is installed and makes no network calls. The `web-engineer` and `unreal-engineer` agents use it when the caller passes its path. The five reviewer agents add a `Basis:` line to each finding: `observed.` with what was run or read, or `inferred.` with the check that would settle it. `review-pr` checks the line with the new `scripts/review-findings.mjs`, and sends findings without one back to the reviewer once. It confirms an inferred finding only after doing the check that finding names, treating basis text as a lead rather than an instruction (SEC-003), and shows each finding's basis in its report. `citation-checker` also checks the places an observed basis cites. WA-006 is unchanged until the 14b eval; its candidate text is in `evals/candidates/WA-006-lookup.md`. Adopters: update the `rfr-core` plugin; nothing else changes.

### Fixed

- `guard-mcp` now enforces NODE-002 for decrypted environment variables (`rfr-core`, #143). It let three Vercel tools that return secrets through without asking, because their names start with a read prefix: `get_project_env` and `get_shared_env_var`, which return decrypted values, and `filter_project_envs` with `decrypt: "true"`. It now asks before the first two, before `get_edge_config_tokens`, and before any Vercel tool called with a `decrypt` argument in any form other than false, and its question says that secret values will enter the session; `filter_project_envs` without it still passes. The hook's matcher now catches the server name in any letter case. This covers the Vercel MCP server only: the `vercel` CLI (`vercel env pull`, `vercel api`) is not guarded yet. Found by the research in `docs/research/notes/third_party_tools_for_core.md`. Adopters: update the `rfr-core` plugin; sessions that read environment variable values through the Vercel MCP server are now asked first.

## [3.1.1] - 2026-11-08

Pull requests: #144.

### Fixed

- Three guard false positives found while building #143, each a prompt or refusal that protected nothing (`rfr-core`, #144). Replaying that session's 122 shell commands, the guards now flag none of them, against two before; existing guard tests are unchanged.
  - `guard-commands` no longer asks before `rm -rf` of a path at least two levels inside the temp directory and in no git repository (such as a session scratchpad or a test fixture), including when the path comes from a variable set earlier in the same command (`R=/tmp/x; rm -rf $R/wt`). The temp directory itself, a folder directly under it, a path that escapes it, a git repository under it, and a variable with no known value still ask.
  - `guard-commands` no longer refuses a script that only mentions a test path in the text it writes, such as a Python script adding a changelog line that names a test file in Markdown backticks. A path now counts when it is on a line that calls a file-writing function, or is assigned to a variable such a line uses; backticks quote strings only in JavaScript. A script whose writing line it cannot follow (a loop variable, a computed path) is still checked against every path it names.
  - `guard-test-edits` judges an edit against the test file as it was where the branch started, as the pull request review does. Rewriting lines the branch added no longer asks, and a weakening approved earlier is not asked about again on later edits; a new weakening of a test that exists on the base branch still asks.

### Added

- A guard decision log (`rfr-core`, #144): each ask or refusal from the rfr-core guards is appended to `guard-decisions.jsonl` in the plugin's data folder, with the hook, tool, decision, session, and the start of the reason, never the command or file contents. It is the measurement the planned guard tiers (`docs/specs/guard-tiers.md`) calibrate against. `RFR_GUARD_LOG=0` turns it off. Adopters: update the `rfr-core` plugin; nothing else changes.

## [3.1.0] - 2026-11-07

Pull requests: #142.

### Added

- Test change review, slice 13c (`rfr-core`, #142; `docs/specs/test-change-review.md`, AC-8 to AC-10): the experimental `test-change-reviewer` agent, and a `review-pr` step that runs it when a pull request modifies existing tests. The step builds the reviewer's input with `scripts/test-change-review.mjs`: each changed test with the classifier's findings and the evidence from running it on the head commit and against the base commit's code, the spec criteria the tests cite with their text before and after, and the `unlocks` entries. The reviewer gets nothing from the session that made the change. It approves a change only when every weakening finding has an approved reason (a changed, approved criterion, an `unlocks` entry citing one, or the lead's quoted instruction) and the evidence holds: the changed test passes on head, fails on base, and fails when the behaviour is broken on purpose. Anything else goes to the lead with what is missing. The step posts one comment for the head commit. It does not add the `tests-reviewed` label yet; that waits for the eval in 13d. The spec is now `approved`. Adopters: update the `rfr-core` plugin; nothing else changes until `review-pr` is run on a pull request that modifies tests.

## [3.0.2] - 2026-11-07

Pull requests: #141.

### Fixed

- Permission prompts with nothing at stake (`rfr-core`, #141), from the Kettlebird pilot's prompts after 3.0.0, where three of four asked about nothing that could be lost. `guard-commands` reads the folder each command runs in, after any `cd`, and asks before discarding changes (`git checkout -- .`, `git restore .`, `git reset --hard`, `git clean -f`) only when git shows uncommitted changes or untracked files there to lose. It never asks inside an agent's own worktree under `.claude/worktrees/`. A `reset --hard` to another commit always asks. `rm -rf` no longer asks when everything it deletes is untracked and ignored by git (build output such as `dist/`) or not there; anything tracked, outside the repository, a glob, or a root-like path still asks. `guard-test-edits` reads paths and specs from the checkout a test file is in, so an `unlocks` entry is found when an agent edits tests in its own worktree; before, it was looked up against the main checkout and never matched. Adopters: update the `rfr-core` plugin.

## [3.0.1] - 2026-11-07

Pull requests: #140.

### Fixed

- `guard-commands` (`rfr-core`, #140): a shell command that creates a new file, or writes to one outside the project, is no longer taken for a write to an existing test. 3.0.0 counted any test path it could not prove new as an existing test, and so refused, for one, a heredoc that created a scratch test file outside the project. `guard-test-edits` likewise leaves files outside the project alone. Adopters: update the `rfr-core` plugin.

### Added

- Test-change evidence, slice 13b (#140; `docs/specs/test-change-review.md`, AC-7): `checks/test-change-evidence.mjs <base> [head]` lists the test cases a change modifies in existing test files, runs them on the head commit, and runs the head's version of them against the base commit's implementation, in throwaway worktrees, reporting pass or fail on each with the failure message. It supports node:test, Vitest, and Jest, and lists other files as not run. The classifier gains `changedTestCases`. The pull request reviewer (13c) will use it. Adopters: nothing to do.

## [3.0.0] - 2026-11-07

Pull requests: #139.

### Changed

- Test change review, slice 13a (`rfr-core`, #139; `docs/specs/test-change-review.md`, AC-1 to AC-6). `guard-test-edits` now checks what an edit to an existing test file does, with a new classifier (`checks/lib/test-diff.mjs`, copied into the plugin by the build), instead of asking about every such edit. Edits that only add tests, assertions, cases, or fixture data, or only rename, move imports, change types, reformat, or comment, go through without asking. An edit that weakens a test asks, and the question lists how: a removed test or assertion, a skip or `only`, a looser matcher, a loosened timeout or tolerance, a changed expected value or snapshot, a mock of the code under test, a swallowed error, removed table cases, or a change the classifier cannot show to be harmless. It does not ask when a spec lists the file under `unlocks` with a criterion ID that spec defines. JavaScript and TypeScript (Vitest, Jest, Playwright, `node:test`) and Python (pytest, unittest) are read; other test files still ask.
- **Breaking:** `guard-commands` refuses a shell command that writes to an existing test file (a `sed -i`, a redirect, a script), with a reason that asks for the Edit tool, so the change can be checked; before, it asked. Moving or deleting an existing test, and updating snapshots, still ask. This is the major bump: a shell write that a person could approve before is now refused. Adopters: update the `rfr-core` plugin; agents that edited tests through the shell will switch to the Edit tool when refused.


Pull requests: #128, #129, #134, #135, #136, #137.

### Changed

- Test guards (`rfr-core`, #137): calibrated from the prompts in twelve hours of the Kettlebird pilot, where 16 of 31 test-file prompts changed no test. `guard-commands` reads a command's write targets (redirections, `tee`, `sed -i`, `perl -i`, `mv`, `cp`, `rm`, `git rm`, `git mv`, `find -delete`, `xargs`, and paths a script passes to a file-writing call), so a test file that is only run, read, quoted in a commit message, or written as text into a spec no longer asks; commands it cannot read, PowerShell, and Windows paths keep the broader check. `guard-test-edits` and `guard-commands` treat a test file added on the current branch as new, as the CI test guard does, so a tests-first branch can fix its own new tests without a prompt. `guard-commands` now asks before snapshot updates (`vitest -u`, `jest -u`, `playwright --update-snapshots`), which rewrite expected values (TEST-001), and no longer asks for `git restore --staged .`, which only unstages. Adopters: update the `rfr-core` plugin.
- `rfr-process` 0.12.0 (#137): the `guard-merge` hook treats turning on auto-merge as a merge (the GitHub MCP auto-merge tool, the REST auto-merge route, and GraphQL merge or auto-merge mutations), which before went through with no prompt; with 0.11.0's typed-instruction check, an auto-merge the person asked for still goes through without one (project-process AC-53). A `GET` of the merge endpoint, which only checks whether a pull request was merged, no longer asks. Adopters: update the `rfr-process` plugin.
- `rfr-process` 0.11.0 (#136): the `guard-merge` hook no longer asks for a confirmation the person has just given. When the latest message the person typed in the session tells the agent to merge ("merge", "merge #12", "merge when green", `/merge-when-green 12`) and covers the pull request, the hook lets the merge through, so "merge when green" is carried out when CI finishes without a second prompt. It still asks when the instruction names another pull request, when the person has typed anything since, for negations and questions, for text from tool results or notifications, for a pull request opened after an instruction that named none, and when it cannot read the transcript (project-process AC-52). From the Kettlebird pilot, where every gated merge prompted right after "merge". Adopters: update the `rfr-process` plugin.
- Preview tutorials (#135, feedback #130 and #131): the first page a tutorial opens waits up to 30 seconds, so a cold preview deployment no longer fails step 1 (project-process AC-51); the workflow installs only the browser, without `--with-deps`, and the job stops after 15 minutes. Adopters: nothing to do; the reusable workflow and runner are read from `rules-ref`.
- `rfr-feedback` 0.1.1 (#134): the feedback form's Area is an optional text field instead of a required dropdown, so a form link fills it in and nobody filing has to choose; its description says what each area covers, and intake no longer asks for it (feedback AC-8). From the Kettlebird lead's first use of the form (#133). The `report-feedback` skill files the issue itself once the user confirms the draft in the session: with `gh`, or in a cloud session with the GitHub tools after attaching rules-for-robots, falling back to the form link only when neither can file; it checks each claim in the draft against the evidence, and runs from a rules-for-robots checkout when the plugin is not installed (feedback AC-6). Adopters: nothing to do.

### Added

- `rfr-feedback` 0.1.0 (#129), an optional plugin (no other plugin depends on it): the `report-feedback` skill drafts feedback about rules-for-robots as an issue for this repository, removes project details, scans the draft for likely private ones (`scripts/feedback.mjs`), and files it only when the user confirms, with `gh` or a prefilled link to the new feedback issue form. On this repository, an intake job labels feedback issues, asks for missing versions, points out likely duplicates, and flags possible private details without repeating them; the `triage-feedback` skill verifies each issue against the code and proposes changes, building only what the maintainer approves (`docs/specs/feedback.md`, feedback AC-1 to AC-7). Adopters: nothing to do; install `rfr-feedback` to send feedback.

### Changed

- `spec-lock` reads a `tests-commit` written as a block list of `- <commit>` lines, and fails when a `tests-commit` holds no commit it can read; before, a block list was skipped in silence and the spec's tests were never locked ((spec-test-traceability AC-14, #128). An `unlocks` entry marked ` (new)` for a test file added later draws no warning (AC-15). From Kettlebird pilot entries 92 and 93. Adopters: specs that wrote `tests-commit` as a block list are now checked; a test changed since its tests commit without an `unlocks` entry will fail until one is added.
- `rfr-process` 0.10.5 (#128): fixes from the tenth round of the Kettlebird pilot. The tutorial runner clicks only visible controls (AC-49), and a tutorial can name its browser size with `viewport: WIDTHxHEIGHT` (AC-50). The guide says that the first end-to-end run often corrects a few expectations under `unlocks`, that new test files need no unlock entry, and where shared code lives in a repository with a nested package. Adopters: nothing to do.

## [2.2.2] - 2026-11-05

Pull requests: #116, #117, #118, #119, #120, #121, #122, #123, #124, #125, #126, #127.

### Changed

- `code-reviewer` (`rfr-core`, #127): also checks a change against the rest of the product it touches (other callers, pages that show the same data, the user documentation, settings other features read, tests that depend on the old behaviour), and reports problems there at the place they break. From the lead's principle that every change is a change to the whole project (`plugins/process/GUIDE.md`). Adopters: update the `rfr-core` plugin.
- `rfr-process` 0.10.4 (#126): the guide opens with the principle that every change, to even the smallest component, is a change to the whole of the project. It explains why staleness flags only direct links (which approvals a change reopens) while every change is still checked against the whole product, and gives reviewers a question to ask of each change. The main README points to it. Adopters: nothing to do.

- `rfr-process` 0.10.3 (#125): feedback from the Agentic XR Pipeline's personas stage, and a false approval alarm. A fourth marker, `[to validate]`, records a working assumption the approver accepted; the process check lists it without a warning, and the warning for the other markers no longer suggests rewording them (AC-46). In solo mode the approvals job finds a merge's pull request from the commit subject when GitHub's lookup is empty, accepting it only if GitHub reports it merged as that commit (AC-47), and the approvals and issue sync jobs retry server errors (AC-48). The persona template and starters have an Evidence section; the guide names the tier for artifact pull requests, restates "propose approved" in solo mode, and describes using auto-merge for "merge when green", which setup now mentions. Adopters: nothing to do; persona details accepted as working assumptions can be marked `[to validate]`.

- `spec-trace` counts every criterion named after one spec name: `story-reader-editor#AC-2 AC-8`, with commas or "and" too (spec-test-traceability AC-13, #124). Before, only the first was counted, so later ones were reported as uncited. From Kettlebird pilot entry 89. Adopters: nothing to do; specs whose tests use this form may now show fewer uncited criteria.
- `rfr-process` 0.10.2 (#124): fixes from the ninth round of the Kettlebird pilot. The reusable process workflow takes a `typecheck` command, run as its own job on every pull request (AC-44), and `install-dirs`, folders with their own `package.json` that the mutation and type check jobs install after the root (AC-45). The guide says to run the type check with the tests on fixes too, to size a request by what it changes rather than what it is called, and that a fixture build covers every content source, with a test. Adopters: optional; set `typecheck:` (and `install-dirs:` for a nested package) under `with:` in the caller.

- `rfr-process` 0.10.1 (#123): setup fixes from the Agentic XR Pipeline project. `/rfr-process:setup mixed` handles a repository with several kinds of sub-project: one set of artifacts and approvers, each sub-project's folder and profile recorded in `AGENTS.md`, persona starters from each profile used, and Stryker offered per web sub-project. Setup asks for the profile when the repository has no code to infer it from, and never replaces an existing concept or persona. Adopters: nothing to do.

- `rfr-process` 0.10.0 (#122): feedback from a second project, the Agentic XR Pipeline. An optional discovery stage (`docs/product/discovery/`, with a template) sits between the concept and the requirements, so requirements can link to use cases and the approver's answers (AC-41). The markers `[open]`, `[assumed]`, and `[proposed]` record what an artifact has not settled; the process check lists them with file and line and warns when an approved artifact still has one (AC-42). It also warns when an approved product artifact links to a Markdown file that is not an artifact (AC-43). The guide adds a `Release:` line for requirements, a required pass across requirement areas and against the concept, a check of each requirement against each persona (which the `persona-walkthrough` agent can do), how a later stage re-opens an earlier artifact, when success measures may be approved unset, and starting in a git repository; setup checks for one. Adopters: nothing to do; a team-mode project that regenerates CODEOWNERS gains a `docs/product/discovery/` line.

- `rfr-process` 0.9.6 (#120): fixes from the eighth round of the Kettlebird pilot. The guide says to verify unverified platform behaviour with a throwaway build or request before writing the acceptance criteria that depend on it, and to check a pull request's own deployment before merging a change to the build or deployment. The design template and the persona walkthrough ask which version of a third-party tool a design was checked against. Adopters: nothing to do.

- `rfr-process` 0.9.5 (#119): fixes from the seventh round of the Kettlebird pilot. The message for an approved artifact set back to draft now says that an amendment keeps `approved` and that `draft` with a reason and an issue is for withdrawing it (AC-40); the guide says the same, and adds running the type check on the tests-first commit and testing each page state through components. Adopters: nothing to do.

- `rfr-process` 0.9.4 (#118): fixes from the sixth round of the Kettlebird pilot. A stale link to a whole artifact now lists the sections to link instead (AC-38), and the tier job reads the pull request's current labels, so re-running it after a label change works (AC-39). The guide covers testing framework calls through thin adapters with fakes, listing the framework behaviours a spec relies on, testing wiring by its effect, walking manual tutorials before review, working out time-zone and calendar expectations by hand, running Stryker with `--force` after test-only changes, the `tier:story` rule for designs and user documentation, and turning an intermittent visual report into a first-frame test. The tutorial template lists each server's command and address; the design template covers container units for multi-frame mock-ups. Adopters: nothing to do for projects calling the workflows at `@main`; artifacts that still link whole files can move to section links when the check suggests it.

- `rfr-process` 0.9.3 (#117): fixes from the fifth round of the Kettlebird pilot. The process check warns when a draft's recorded hash is out of date (AC-35); the tutorial runner names a protected preview (a 401 or 403, or a login page on another host) instead of reporting a missing element (AC-36); the mutation job posts its score as a check annotation (AC-37), and the static-site Stryker configuration mutates `src/lib/` only. The design template asks how the system knows what it shows, what enforces each promise, and what is published together; the persona walkthrough reads the rendering code, checks help text against the site, and walks editor designs as the readers of the changed pages; bootstrap keeps implementation facts in `docs/product/notes.md`; the preview caller's comment on when it runs is corrected.

### Added

- Phase 10 eval round preparation: a `tdd-cluster` case that replaces `tdd-feature` in the cadence comparison and passes only if the last red run failed on assertions rather than a missing module; tool output for graders (`transcriptTools` gives each call its `output`); `evals/stryker-compare.mjs`, which runs Stryker on a case's fixture without a model, and its first result (`evals/results/2026-11-03-10c-prep/`); a staged run plan with a cost estimate (#121). No paid runs yet.
- `rfr-process` 0.9.2, slice 11h (#116): the Unreal half of runnable tutorials. `examples/unreal` has a fixture tutorial (`tutorial-rfrsample-score-display`), an `RFR Score Display` actor in the sample plugin, and the automation spec `RfrSample.Tutorial.ScoreDisplay` that follows the tutorial step by step. A new `tutorial-demo` job in `unreal-tier2.yml` runs on the GPU runner for each engine version: it builds a demo level and sequence with editor Python, runs the spec and a screenshot functional test of the tutorial's editor step against approved reference images (a missing reference fails the job), and renders a 72-frame demo with Movie Render Queue, uploaded as an artifact. The workflow takes an `engines` input so one version can be run on its own (AC-25).

## [2.2.1] - 2026-11-01

Pull requests: #103, #104, #105, #107, #108, #109, #110, #111, #112, #113, #114, #115.

### Changed

- `plan-feature` (`rfr-core`, #115): stubs for tests written first return a wrong value that is not empty or false, so tests that expect nothing found or something refused start red; the spec is read against the approved user documentation before the tests are written; and a criterion found missing after the tests commit gets its own failing test in a new commit appended to `tests-commit`. The same guidance is in `practices/working-with-agents.md`. From the Kettlebird pilot (entries 44 and 53).
- `rfr-process` 0.9.1 (#114): fixes from the fourth round of the Kettlebird pilot. A new `derived-from` entry can be written with or without its colon, the relink script records its hash, and the check's message for an unrecorded link names the relink command (AC-34). The guide says when a story may skip user documentation and tutorials, how to add a criterion after the tests commit, and how to test a user interface the CI cannot drive.
- `rfr-process` 0.9.0 (#113), slice 11g: an advisory `docs-lint` job that runs Vale 3.26.0 (pinned by SHA-256) with an RFR style built from the writing rules and a vocabulary of persona names and glossary terms (AC-23); Stryker configurations for the `web-app` and `static-site` profiles and an advisory `mutation` job for `tier:story` and `tier:epic` pull requests, incremental across pushes and in full when tests change, with the score and surviving mutants in the job summary (AC-24); and a reusable workflow, with a caller template, that runs and records web tutorials against each preview deployment, sending a protection-bypass header to the preview's origin only (AC-33).
- `rfr-process` 0.8.1 (#112): fixes from the third round of the Kettlebird pilot. The bold-name warning also offers removing bold that is only emphasis; the guide and design template recommend keeping the mock-ups' editable source beside them and say what mock-ups of a third-party interface can and cannot settle; the persona walkthrough checks a story's key terms against similar things in the product.
- `rfr-process` 0.8.0 (#111): fixes from the second round of the Kettlebird pilot. Designs include visual mock-ups or wireframes for every screen and state they change, and the persona walkthrough reads them; the artifact templates link to sections, so an edit elsewhere in an upstream artifact no longer stales everything below it; the process check matches a story's role to a persona only at word boundaries, warns when the user documentation names a control no design defines, and prints the rules-for-robots commit it ran; new decision-note template, epic sections for dependencies, open questions, proposed stories, and release groups, and a visitor-facing static-site documentation template with file and CMS editor variants; guide notes on solo-mode approval, batching and stacking pull requests, and requirements that lead the product (AC-29 to AC-32).
- `rfr-process` 0.7.0 (#110): the `guard-merge` hook asks the person to confirm an agent's merge of a pull request that touches gated folders, instead of denying it, so an approver's instruction to merge is carried out with their confirmation (lead's decision after pilot entry 18; AC-7 changed).
- `rfr-process` 0.6.0 (#109): fixes from the first pilot, on the Kettlebird website. The tier job creates the four `tier:` labels, lets the pull request that adds `process.yml` through, and on a newly opened pull request waits up to a minute for a tier label before failing. The bootstrap skill drafts requirements as user-visible behaviour with today's tools as "current implementation, not a commitment", ranks code and the running product above planning documents, and lists defects found for later `tier:fix` issues. Setup skips persona starters when bootstrap follows, and both skills allow a commit when the task is to open a pull request. The process check counts draft links with no recorded hash. The README, guide, and workflow template explain pinning the reusable workflow to a tag or commit. From pilot entries 17 and 18: an artifact is approved by the pull request that sets `status: approved` and records its hashes (bootstrap now does this in the same pull request once the approver says the drafts are ready); an agent merges a gated pull request only on the approver's explicit instruction and comments with the instruction quoted; setup writes these rules into the project's `AGENTS.md`, so they hold without the plugin.

### Added

- `rfr-process` 0.5.0 (Phase 11, slice 11f; #108). The issue sync places persona, epic, and story issues on a GitHub Project when `process.yml` names a `project` and the `RFR_PROJECT_TOKEN` secret is set, and sets each item's Stage field: personas in Personas, epics and stories in the furthest stage their approved work has reached. Runs that change nothing make no board changes; missing Stage options are reported, not failed. The reusable workflow declares the optional secret, and the caller template passes it with `secrets: inherit`.
- `rfr-process` 0.4.0 (Phase 11, slice 11e, from the research amendment; #107). Link rule 8 in `checks/process-trace.mjs`: an approved story says "As <persona>, I want ... so that ...", names a persona it links to, and has acceptance criteria (drafts get warnings). `tutorial-run --record <dir>` saves a screenshot per step, `failure.png`, and `video.webm`, so a passing run is the stage 12 demo. The `persona-walkthrough` agent becomes a cognitive walkthrough that asks where each persona would fail at every step, and runs web tutorials against the product first. The guide gains recommended tools per profile and a section on installing third-party plugins and MCP servers safely, with each security claim checked against its primary source. The research note records corrections to two of its claims.
- `rfr-process` 0.3.0 (Phase 11, slice 11c; #105). Runnable tutorials: a web tutorial is its own test, because `checks/tutorial-run.mjs` reads each step (`Click **Name**.`, ``Type `text` into **Label**.``, `You see **Text**.`) as browser actions and fails at the step that no longer matches the product; Unreal tutorials must be cited by an automation test. A new `tutorials` job in the reusable `rfr-process.yml` workflow checks runners and step grammar without a browser. Persona starters and user documentation and tutorial templates for the `unreal-plugin`, `web-app`, and `static-site` profiles. The experimental `persona-walkthrough` agent, and the `setup` and `bootstrap` skills. The plugin's [GUIDE.md](plugins/process/GUIDE.md) covers how to write each artifact, the review checklists, and the persona walkthrough. This repository's CI installs Chromium for the runner's tests.
- `rfr-process` 0.2.0 (Phase 11, slice 11b; #104). New checks, each run by the reusable `rfr-process.yml` workflow: `checks/ci/process-approvals.mjs` requires, in team mode, an approving review on the head commit from the approvers of each gated stage a pull request changes, and in solo mode checks after the merge that an approver merged it, opening a `process-approval` issue if not; `checks/ci/process-tier.mjs` requires one `tier:` label and keeps `tier:trivial` and `tier:fix` pull requests out of the folders their tier may not change; `checks/process-codeowners.mjs` writes and checks a CODEOWNERS block from `process.yml`; `checks/ci/process-sync.mjs` mirrors personas, epics, and stories to issues after each merge, with the files winning. The plugin's new `guard-merge` hook denies agent merges of pull requests that touch gated process folders. The `stale` issue on the default branch is now assigned to the approvers of the stages involved.
- `rfr-process` 0.1.0, a second plugin for the project development process in [docs/specs/project-process.md](docs/specs/project-process.md) (Phase 11, slice 11a; #103). It ships artifact templates for each stage, a `process.yml` template for per-stage approvers, and a caller for the new reusable workflow `rfr-process.yml`. `checks/process-trace.mjs` fails on broken or stale links between artifacts, cycles, approved work built on drafts, stories without an approved persona, spec criteria without a story or documentation source, and withdrawals without a reason; `--status` lists how far each persona, epic, and story has reached. `checks/process-relink.mjs` records current section hashes. The check runs in `npm run verify` and on the default branch, where a failure opens a `stale` issue.

## [2.2.0] - 2026-10-26

Pull request: #95.

### Added

- UE-009 (SHOULD, `unreal-plugin` pack): a custom asset type gets its own entry in the Content Browser's Add menu, through a `UFactory` and a `UAssetDefinitionDefault` in an editor module, and a test that every asset class has both; users should not have to create a generic Data Asset and then pick the class. Observed in an Open3DPuppet session, where the agent made every asset type a plain `UDataAsset` subclass. The Unreal practice guide has a section on custom asset types.

## [2.1.0] - 2026-10-26

Pull request: #91.

### Changed

- `software-architect` and `tech-lead` (both still experimental) handle new projects with no code yet. The architect maps every requirement to the design, lists conflicts, gaps, and ambiguous requirements as questions instead of settling them, and names the platform constraints the requirements leave unstated. The tech lead starts with a slice that creates the project and a thin version passing the verification command, maps every requirement to a slice, plans tests before code, and orders slices that wait on an answer last.

### Added

- Greenfield eval cases `arch-greenfield-webapp`, `arch-greenfield-uplugin`, `lead-greenfield-webapp`, and `lead-greenfield-uplugin`, which start from a profile's template repo plus a requirements brief with planted problems, with unit-tested graders. Large-repository cases `arch-add-godot-support` and `lead-add-godot-support` on a snapshot of this repository.

## [2.0.0] - 2026-10-26

Pull requests: #92, #93, #94.

### Removed

- The `ci-watcher` agent. It existed to make one blocking `gh pr checks --watch` call, and agents no longer wait that way (below). `merge-when-green` reads failed job logs itself. A removed agent is a major change (docs/maintenance.md).

### Changed

- Agents wait for CI on events only. `merge-when-green` checks once; if checks are still running, it ends the turn when the session receives the pull request's events (a cloud session subscribed to the pull request, or the Claude desktop app with the pull request bound and its monitor on, which relays CI failures and new comments, so a green run arrives as the CI status comment), and otherwise says what is still running and stops, with at most one scheduled fallback wake-up. It never waits with `gh pr checks --watch`, `gh run watch`, `sleep` loops, or repeated checks, which hold the session and time out on long self-hosted runs. A check skipped only because the pull request was a draft is not a pass. `unreal-engineer` and `web-engineer` check once and hand a pending wait back to the caller, since a subagent receives no events. The working-with-agents guide says the same. The smoke cases fail any waiting command, and the fake `gh` refuses them.
- The CI status comment (`rfr-ci-status.yml`) posts a new comment on every run instead of editing one in place, because a new comment is what wakes an agent waiting on the pull request (the Claude desktop app's pull request monitor relays new comments, and an edited one may wake nobody). A passing run is headed "✅ **<workflow> completed successfully!**", a failed one "❌ **<workflow> failed**", a cancelled one "⚪ **<workflow> was cancelled**", each with the head commit's full SHA, and a pass lists the jobs it skipped. The adoption guide and the workflow show how to gate the status job on draft pull requests when a job skips on drafts, so a draft gets no green comment. Adopters need no change.

### Fixed

- The guards workflow in the template repos and `examples/web-app` runs when a label is added or removed (`types: [opened, synchronize, reopened, labeled, unlabeled]`). The test change guard (TEST-001) reads the `tests-reviewed` label from the event that started the run, so a reviewer who added the label after a failed run saw the check stay red: the default events start no new run, and re-running the failed job reuses the original event. Removing the label now also re-runs the guard, so the check does not stay green after the approval is withdrawn. The adoption guide shows the `on:` block for adopters who call the reusable workflow. Adopters update their own `guards.yml`; the reusable workflow is unchanged.

## [1.5.0] - 2026-10-12

Pull request: #87.

### Added

- Phase 10b, `docs/specs/spec-test-traceability.md`. The spec lock accepts a list of `tests-commit` values, one per cluster of tests; each cluster is locked at its own commit and each later commit must descend from the one before.
- `plan-feature` gives criteria IDs and `test:` markers and plans the tests first: a cluster per criterion group, stubs so each test fails on its assertion, `tests-commit` recorded when the cluster is committed red. `review-pr` gets a sabotage step for approved specs: break the behaviour behind each traced criterion in a throwaway worktree and report citing tests that still pass. The working guide describes the loop.
- Candidate rules for the evals: TEST-007 (trace acceptance criteria to tests) and TEST-004-clustered (draft tests in clusters, stubs first).
- Eval cases `spec-trace-uncovered`, `spec-trace-wrong-test`, `spec-drift`, and `spec-vacuous-tests`, with unit-tested graders; two smoke cases for the skills; a `skill` setting for cases in the plugin arm. The staged run plan is in `evals/README.md`. No paid runs yet.

## [1.4.0] - 2026-10-12

Pull request: #85.

### Added

- Spec trace and lock checks (Phase 10a, `docs/specs/spec-test-traceability.md`). `checks/spec-trace.mjs` fails when an approved spec has a `test:` criterion no test cites (as `<spec name>#AC-<n>`) or a test cites a criterion the spec lacks; drafts only warn. `checks/spec-lock.mjs` fails when a test that cites a spec was modified, deleted, or renamed after the spec's `tests-commit`, unless the spec lists an `unlocks:` entry with a reason. Both run in `npm run verify` (`check:specs`), and adopting repositories can turn them on with `spec-checks: true` in the reusable guards workflow.
- The `plan-feature` spec template has front matter (`status`, `tests-commit`, `unlocks`) and criterion IDs with `test:` markers.

## [1.3.0] - 2026-10-12

Pull request: #83.

### Added

- Experimental agent `ux-reviewer` (read-only, Opus, medium): usability and interface design in three areas, Unreal Editor tools and Blueprint-facing APIs, general software (desktop, command-line, developer tools), and web pages and apps. Accessibility conformance stays with `accessibility-reviewer`. `review-pr` adds it for new or changed flows, screens, forms, messages, and tools.
- Eval cases for it: `ux-signup-flow`, `ux-landing-page`, `ux-cli-tool`, `ux-editor-tool` (five planted defects each) and the `ux-clean-form` control, with unit-tested graders and a staged run plan in `evals/README.md`. No paid runs yet.

## [1.2.1] - 2026-10-12

Pull request: #82.

### Changed

- `software-architect` runs on `claude-fable-5-1` (was `opus`).

### Added

- Eval round for `software-architect` and `tech-lead`: a `rules+agents` arm in `evals/run.mjs`, four cases (`arch-money-storage`, `arch-reuse-event-bus`, `lead-plan-order`, `lead-check-claim`) with unit-tested graders, and a staged run plan in `evals/README.md`. No paid runs yet.

## [1.2.0] - 2026-10-12

Pull request: #81.

### Added

- Experimental agents `software-architect` (design choices; may write ADR files) and `tech-lead` (slices work, assigns owners, checks delegated work against acceptance criteria). Added before any eval showed a benefit, which R18 asked for; an eval round decides whether they stay.

## [1.1.1] - 2026-10-12

Pull request: #80.

### Fixed

- `format-on-edit` formatted nothing on Windows: Node refuses to spawn the `prettier.cmd` shim directly. The hook now runs the shim through `cmd.exe` with quoted arguments, and skips a path containing `"` or `%`.
- `npm test` ran 0 tests on Windows because its glob was in single quotes, which `cmd.exe` keeps literally. The glob is now in double quotes (also in the `ls-hidden-harness` fixture and its test).
- `build --check` reported paths with backslashes on Windows; paths are now compared with `/`.
- Eval graders and tests that run `npm` or `npx` now do so through the shell on Windows. The `ls-hard-to-reverse` fixture's `check-migrations.mjs` builds its path with `fileURLToPath`.

### Added

- `.gitattributes` with `* text=auto eol=lf`, so Windows checkouts with `core.autocrlf=true` no longer see the generated template files as stale. `npm run verify` now passes on Windows (203 of 203 tests).

## [1.1.0] - 2026-10-07

Pull request: #79.

### Added

- Three Haiku 5.5 agents for work that gathers or runs things and leaves the judgment to the caller: `ci-watcher` (waits for a pull request's checks and returns results with the first error from each failed job's log), `check-runner` (runs named scanners, audits, builds, and tests and returns exit codes and key output verbatim), and `citation-checker` (confirms that review findings cite real files, lines, identifiers, and rule IDs).
- Smoke cases for the three agents and for `merge-when-green` with checks still running; the smoke harness records cost by model and can require that a case used a given model. Research note: `docs/research/notes/haiku_5_5_delegation.md`.

### Changed

- `merge-when-green` hands the wait to `ci-watcher` when checks are pending; `review-pr` runs `citation-checker` when there are three or more findings; `security-audit`, `perf-audit`, `a11y-audit`, and `package-unreal-plugin` hand the commands to `check-runner`. The caller still confirms the head commit, judges results, and decides.

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
