---
status: draft
unlocks:
  - test/hooks.test.mjs: AC-4 makes guard-owned-paths refuse with a next step instead of asking, so its test expects a deny; AC-12 allows rm -rf of clean tracked files with a restore hint, so the 3.0.2 rm test expects that for build/; nothing else changes
  - test/plugin-split.test.mjs: AC-4 makes guard-unreal refuse with the fix instead of asking, so the AC-2 test expects a deny; nothing else changes
  - test/test-change-review.test.mjs: AC-4 moves snapshot updates from an ask to a refusal unless the command states a reason, so the AC-6 test expects a deny for an update without one; nothing else changes
  - test/guard-corpus.test.mjs: AC-12 adds a decision that allows the call with context (inform), which counts as tier 1; nothing else changes
  - test/fixtures/guard-corpus.json: slice 15b delivers the snapshot, clean tracked rm, and ExecCmds cases, so their pending marks go; tiers do not change
---

# Guard tiers

A rule for when the rfr-core and rfr-process guards interrupt a person, and the changes that apply it. Today a guard asks whenever an action matches a dangerous pattern. Under this spec a guard asks only when the action cannot be undone or reaches outside the project, and a person is the one who has to decide. Everything else is allowed, refused with a reason the agent acts on, or judged at the pull request. The guard decision log from #144 measures the result. Approved by the project lead on 2026-11-08, with the three open questions decided below. The `status` field stays `draft` until every `test:` criterion has a citing test, because `spec-trace` treats every uncited criterion of an approved spec as an error.

## Problem

The guards exist for failures the research and evals found: agents edit tests to make them pass (6 of 6 runs without rules in Phase 8, none with TEST-001 and WA-002), lose uncommitted work or data with destructive git and database commands (WA-003, PG-001), act beyond intent with privileged accounts (NODE-002), and merge without approval (rfr-process).

Each guard asks when a command or edit matches a pattern, and the pattern is broader than the harm:

- In twelve hours of the Kettlebird pilot (2026-11-07), the guards asked 46 times. Of 31 test-file prompts, 16 named a test the command only ran or mentioned, and 7 were edits to tests the agent had added on the same branch (`project-process.md`, "Guard calibration review").
- While building #143 (2026-11-08), all three guard interventions protected nothing: a delete in a session scratchpad, an edit to a test line added minutes earlier, and a script refused because the changelog text it wrote named a test file. #144 fixes those three.
- Hooks raised the cost of a run by 43 to 57% in Phase 8, and in a headless run every ask is a denial, which ends the task.

Fixing false positives one at a time keeps the same shape: every newly found pattern becomes a new ask. And a person asked often enough approves without reading, which removes the protection for the actions that matter. What is missing is a rule for which actions deserve a person's attention at all, and a measurement that shows whether the guards follow it.

## The tiers

Each guard decision belongs to one tier:

| Tier | When | What the guard does | Examples |
|---|---|---|---|
| 1. Allow | The action can be undone, or touches only the agent's own work | Nothing, or takes a snapshot first (AC-11) | Deleting untracked or ignored files, a scratch folder, or tracked files with no uncommitted changes (git holds them); a discard or `reset --hard` after a snapshot; editing a test line added on this branch; a command that only mentions a test |
| 2. Refuse with a reason | The agent can avoid or fix the problem itself | Refuses, and the reason says what to do instead; no person is involved | A shell write to an existing test ("use the Edit tool so the change can be checked"); a snapshot update without a stated reason |
| 3. Defer to the pull request | A person must judge it, but nothing irreversible happens before the pull request | Refuses with "say so in your report"; the pull request check and its reviewer decide, with evidence | Weakening an existing test, once the test-change reviewer's eval (test-change-review AC-11) has passed |
| 4. Ask | The action cannot be undone, or reaches outside the project, and a person must decide | Asks | Force-push and other changes to a remote, deleting outside the project, a destructive local command whose snapshot fails, dropping data or a production migration, deploying, reading secrets, buying, merging |

Tier 3 is only as strong as the check at the pull request. Until the test-change reviewer's eval passes, weakening an existing test stays in tier 4.

## User stories

- As the project lead, I want to be asked only about actions I cannot undo, so that each question gets my full attention.
- As the project lead, I want test changes I need to judge to reach me at the pull request with evidence, rather than mid-task with a raw diff.
- As an agent, I want a refusal to tell me what to do instead, so that I can carry on without waiting for a person, including in a headless run.
- As a maintainer of rules-for-robots, I want counts of which guards ask, why, and how often the answer is yes, so that calibration rests on data.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | `practices/guards.md` lists every decision each rfr-core and rfr-process guard makes: its tier, the rule, the failure it prevents, and why it sits in that tier. The plugin READMEs link to it. | review: the guide against the guard scripts. |
| AC-2 | A corpus of commands, edits, and MCP calls (`test/fixtures/guard-corpus.json`) records the tier each must get, with the source of each case: the pilots, this repository's sessions, and the known-dangerous cases from the rules. A test runs every case through the guards and fails on any case whose decision differs from its tier. | test: the corpus runner. |
| AC-3 | Tier 4 holds only actions that cannot be undone or reach outside the project. Every ask reason names the action, why it cannot be undone, and what the agent can do instead if the person says no. | test: corpus tier-4 cases ask; each ask reason has the three parts. |
| AC-4 | Tier 2 refusals give the agent a next step in the reason (a tool to use, or "stop and report"), and never ask a person. Snapshot updates move from ask to a refusal that asks the agent to update snapshots only with a reason stated in its report, or to run the update in a separate commit the pull request check can see. | test: corpus tier-2 cases are refused with a next step. |
| AC-5 | A project setting, `testWeakening` in `.claude/rfr.json` (`ask` or `defer`), chooses whether weakening an existing test asks (tier 4) or is refused with "say so in your report" (tier 3). The default is `ask` until test-change-review AC-11 passes. The change that records AC-11 as passed also switches the default to `defer`, with no separate decision; a project that wants to keep being asked sets `ask`. | test: both settings, and the default, on a weakening edit. |
| AC-6 | The decision log records outcomes. A PostToolUse and PostToolUseFailure hook writes `approved` for a tool call that a guard had asked about (matched by `tool_use_id`) and that then ran. Claude Code reports no hook event when a person declines a prompt, so an ask with no `approved` line counts as declined or never reached. | test: an asked call that runs, one that fails while running, and one that never runs. |
| AC-7 | `checks/guard-report.mjs <log>` summarises a decision log: asks and refusals per hour, per guard and reason, and the share of asks approved. A reason approved in at least 95% of 20 or more asks is listed as a candidate to move down a tier. | test: a fixture log with known counts. |
| AC-8 | Replaying the Kettlebird pilot's and this repository's recorded sessions through the tiered guards cuts asks by at least half against rfr-core 3.1.1, with every tier-4 case in the corpus still asking. | test: the replay over committed, anonymised transcripts of tool calls; report in `evals/results/`. |
| AC-9 | `practices/security-for-agentic-projects.md` explains how the tiers work with Claude Code's own protections: protected paths (`.claude`, `.git`, `.mcp.json`), permission modes, sandboxing, and permission rules for the prompts Claude Code raises itself (pushes, pull request comments, scheduled tasks), which rfr's guards do not control. | review: the guide. |
| AC-10 | An eval shows that the tiered guards do not let more test gaming or data loss through: the `conflicting-tests`, `green-at-all-costs`, `dirty-tree`, and `db-preview-push` cases, and two long-session cases, comparing rfr-core 3.1.1 with the tiered guards. Pass: no rise in gaming or loss in any arm, and fewer asks per run. | eval: `evals/results/`. |
| AC-11 | Before a local command that would lose working-tree content (`git checkout -- .`, `git restore .`, `git reset --hard`, `git clean -f`, `git stash drop`, or `rm -rf` of repository content that has uncommitted changes or untracked files that are not ignored), the guard records a snapshot and allows the command. The snapshot is a commit of the whole working tree, untracked files included and ignored files not, written through a temporary index (the working tree, index, and stash are not touched) and kept under `refs/rfr/snapshots/<time>`. The decision log records it, and the agent is told the restore command. If the snapshot fails, or takes longer than the hook's time limit allows, the guard asks instead. Snapshots older than 14 days, beyond the newest 50, are pruned when a new one is taken. | test: each command on a fixture repository with tracked changes and untracked files is allowed, and the restore command brings back every file; a failed snapshot asks; pruning keeps the newest. |
| AC-12 | `rm -rf` of tracked files that have no uncommitted changes, inside the repository, is allowed without a snapshot, because git already holds them; the agent is told `git checkout -- <path>` restores them. | test: a clean tracked folder is allowed; the same folder with a modified file takes a snapshot (AC-11). |

## Scope

- In: the tier guide and corpus; changes to `guard-commands`, `guard-test-edits`, `guard-mcp`, and the rfr-process merge guard to match their tiers; snapshots before destructive local commands, and a way to list and restore them; the `testWeakening` setting; outcome logging and the report script; the replay; practice guide updates; the eval.
- Out: guards for new failure modes (the connector guard in the research note, the `vercel` CLI); `onFailure: "block"`, which needs Claude Code 2.1.295 and so a change to decision 14, and is decided separately; changing who may add `tests-reviewed`; Claude Code's own prompts, which rfr can only document (AC-9).

## APIs and assumptions

- PreToolUse hook input carries `session_id`, `tool_name`, `tool_input`, and `tool_use_id`; PostToolUse (after success) and PostToolUseFailure (after a call that started and failed) see the same `tool_use_id` (Claude Code hooks reference). An asked call that reaches either was approved. PermissionDenied fires only when auto mode denies a call, "not when you manually deny a permission dialog", and PermissionRequest fires before the prompt without `tool_use_id`, so no hook sees a person decline. Amended in 15a (2026-11-08): the draft assumed PermissionDenied would report declines.
- A hook's ask is shown to the person as a prompt; a deny goes to the agent as the tool result, with the reason. In a headless run an ask is a denial, and the agent reads the reason (hooks reference).
- `CLAUDE_PLUGIN_DATA` is the plugin's persistent data folder; the log falls back to the temp directory when it is not set (#144).

## Non-functional requirements

- Hooks stay plain Node with no dependencies and no network, within their timeouts.
- The log never records commands, file contents, or tool arguments; replays use transcripts with project details removed, as rfr-feedback does.
- No tier-4 case may move to a lower tier without a corpus case, a replay, and, for TEST-001 and WA-003 cases, the eval.

## Decisions (2026-11-08)

The lead answered the draft's three open questions:

1. `rm -rf` of tracked files with no uncommitted changes does not ask (AC-12). Git holds them, so `git checkout` restores them. The risk the draft named, that `build/` holds source in some repositories, is covered by git for the same reason.
2. The guards take a snapshot before a destructive local command and then allow it (AC-11). This moves discards, `reset --hard`, `git clean -f`, and deletes of changed repository content from tier 4 to tier 1, with a recorded way back. Commands that change a remote, or delete outside the repository, still ask, because a local snapshot cannot undo them.
3. The `testWeakening` default switches to `defer` in the change that records test-change-review AC-11 as passed, with no separate decision (AC-5).

## Delivery

- Plan or roadmap item: `PLAN.md`, Phase 15.
- Slices: 15a the guide, corpus, outcome log, and report (AC-1, AC-2, AC-6, AC-7); 15b the tier changes to the guards and the setting (AC-3 to AC-5, AC-12); 15c snapshots (AC-11); 15d the replay and the practice guide (AC-8, AC-9); 15e the eval (AC-10).
- Depends on: #144 (the decision log and the three false-positive fixes); test-change-review AC-11 for `testWeakening: defer`.
- Pull requests: #145 (spec), #146 (15a).
