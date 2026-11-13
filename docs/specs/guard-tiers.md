---
status: draft
unlocks:
  - test/fixtures/guard-corpus.json: rewrite plan 25e (verify inventory slice f2, the maintainer's choice of 2026-11-13) moves the Vercel CLI and database checks from rfr-core's guard-commands to rfr-web's guard-cli, so the Vercel CLI and database cases name the guard web-cli; each case's command and tier are unchanged
  - test/guard-corpus.test.mjs: rewrite plan 25e (verify inventory slice f2, the maintainer's choice of 2026-11-13) moves the Vercel CLI and database checks from rfr-core's guard-commands to rfr-web's guard-cli; the corpus runner judges web-cli cases by decideWebCommand, and every other case as before
  - test/guard-tiers.test.mjs: rewrite plan 25e (verify inventory slice f2, the maintainer's choice of 2026-11-13) moves the Vercel CLI and database checks from rfr-core's guard-commands to rfr-web's guard-cli; the AC-3 check judges web-cli cases by decideWebCommand, and every other case as before
  - test/guard-commands.test.mjs: rewrite plan 25e (verify inventory slice f2, the maintainer's choice of 2026-11-13) moves the Vercel CLI and database checks from rfr-core's guard-commands to rfr-web's guard-cli; the lists of commands flagged and not flagged are unchanged, and are checked against rfr-core and rfr-web together, as a web project runs them
  - test/fixtures/guard-corpus.json: rewrite plan 25e (2026-11-12) reduces guard-commands to the never list in docs/specs/unattended.md: branch-force-delete deletes a branch the guard can resolve and is tier 1 with the restore command, and branch-force-delete-unknown keeps the refusal at tier 4; cases are added for the never-list routes the security review found unrefused (skipping hooks, reading secrets, deleting or changing on the remote) and for two near-misses that stay allowed
  - test/guard-outcomes.test.mjs: AC-6 retired (rewrite plan 25e (2026-11-12) removes task approval, default allow, "permissions": "ask", and guard-outcome), so its three tests go; the AC-7 report tests are unchanged
  - test/guard-calibration.test.mjs: rewrite plan 25e (2026-11-12) removes task approval, default allow, "permissions": "ask", and guard-outcome, so the decision-log test runs the refusal path a project now gets (deny, logged as never) instead of the prompt path; the fields checked and the logging-off case are unchanged
  - test/fixtures/guard-corpus.json: rewrite plan 25e (2026-11-12) removes task approval, default allow, "permissions": "ask", and guard-outcome; publishing is not on the never list, so push-tags and release-create are tier 1, and a Vercel preview deploy through MCP is tier 1 as vercel-preview-cli already was, with vercel-deploy-prod added at tier 4
  - test/guard-corpus.test.mjs: the MCP cases are judged by decideVercel, the hook's own decision, instead of vercelToolNeedsApproval, so a preview deploy that goes ahead counts as tier 1; the dangerous core names vercel-deploy-prod in place of vercel-deploy (rewrite plan 25e (2026-11-12) removes task approval, default allow, "permissions": "ask", and guard-outcome)
  - test/hooks.test.mjs: the guard-mcp output test refuses a production deployment and lets a preview deployment through, since task approval no longer decides previews (rewrite plan 25e (2026-11-12) removes task approval, default allow, "permissions": "ask", and guard-outcome)
  - test/hooks.test.mjs: AC-4 makes guard-owned-paths refuse with a next step instead of asking, so its test expects a deny; AC-12 allows rm -rf of clean tracked files with a restore hint, so the 3.0.2 rm test expects that for build/; nothing else changes; AC-11 (15c) takes a snapshot and allows discards, hard resets, and stash drops that would lose work, so the 3.0.2 discard and worktree tests expect that, and the hook-output test asks about a force-push instead
  - test/guard-calibration.test.mjs: AC-11 takes a snapshot before rm -rf of changed files in a repository under the temp directory, so the test expects the snapshot instead of an ask; the git checks still run
  - test/guard-tiers-15b.test.mjs: AC-11 takes a snapshot before rm -rf of a folder with a modified or untracked file, which 15b left asking until this slice, so the AC-12 test expects the snapshot
  - test/plugin-split.test.mjs: AC-4 makes guard-unreal refuse with the fix instead of asking, so the AC-2 test expects a deny; nothing else changes
  - test/test-change-review.test.mjs: AC-4 moves snapshot updates from an ask to a refusal unless the command states a reason, so the AC-6 test expects a deny for an update without one; nothing else changes
  - test/guard-corpus.test.mjs: AC-12 adds a decision that allows the call with context (inform), which counts as tier 1; nothing else changes
  - test/guard-tiers-15b.test.mjs: AC-5 as amended on 2026-11-09 lets a deferred test change go ahead with context instead of refusing it, so the defer cases expect that decision, and a removal joined to a force-push still asks
  - test/guard-calibration.test.mjs: AC-13 (2026-11-10): the rm -rf commands name the temp folder and its repositories as a shell writes them on Windows (forward slashes); on Linux and macOS the commands are unchanged, and every expected decision is the same
  - test/hooks.test.mjs: AC-13 (2026-11-10): the commands that cd into, write to, or name a folder use the path as a shell writes it on Windows (forward slashes); on Linux and macOS they are unchanged, and every expected decision is the same
  - test/guard-tiers-15c.test.mjs: AC-13 (2026-11-10): the check that a snapshot into a read-only objects folder fails is skipped on Windows, where chmod cannot make a folder read-only, as it is already skipped for root; the injected failure still asks everywhere
  - test/guard-tiers-15d.test.mjs: AC-13 (2026-11-10): the extractor's scratch folder comes from os.tmpdir() instead of a hard-coded /tmp; the expected calls are unchanged
  - test/fixtures/guard-corpus.json: slice 15b delivers the snapshot, clean tracked rm, and ExecCmds cases, so their pending marks go; tiers do not change; slice 15c delivers the discard, reset, clean, stash, and changed rm cases the same way
  - test/fixtures/guard-corpus.json: AC-5 switches the testWeakening default to defer now that test-change-review AC-11 has passed (2026-11-11), so removing a test, a pwsh write to one, and a weakening edit move from tier 4 to tier 3; no other case changes
  - test/guard-corpus.test.mjs: AC-5's default switch moves the weakening edit to tier 3, so the dangerous core no longer lists it and a separate check keeps it at tier 3; nothing else changes
  - test/guard-tiers-15b.test.mjs: AC-5's default switch (2026-11-11): with no setting, or an unknown value, a weakening edit and a test removal are deferred, and testWeakening ask still asks for both
  - test/hooks.test.mjs: AC-5's default switch (2026-11-11): the existing-test edit, the glob removal, and the worktree weakening are deferred by default, and the glob removal still asks under testWeakening ask; which changes are flagged is unchanged
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
| 3. Defer to the pull request | A person must judge it, but nothing irreversible happens before the pull request | Lets the action go ahead without asking, and tells the agent to say so in its report; the pull request check and its reviewer decide, with evidence | Weakening an existing test, once the test-change reviewer's eval (test-change-review AC-11) has passed, or earlier in a project that sets `testWeakening: defer` |
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
| AC-5 | A project setting, `testWeakening` in `.claude/rfr.json` (`ask` or `defer`), chooses whether weakening an existing test asks (tier 4) or goes ahead with context telling the agent to name the change in its report (tier 3). A deferred change is logged as `defer`, and the rest of a shell command is still checked, so a test removal joined to a command that asks still asks. The default is `ask` until test-change-review AC-11 passes. The change that records AC-11 as passed also switches the default to `defer`, with no separate decision; a project that wants to keep being asked sets `ask`. Amended 2026-11-09: `defer` refused the change, which left the person deciding each one later instead of at the pull request; the old test stays in git, and the pull request's test change check stays red until the change is reviewed. Test-change-review AC-11 passed on 2026-11-11, so the default is now `defer`. | test: both settings, and the default, on a weakening edit and a test removal. |
| AC-6 | The decision log records outcomes. A PostToolUse and PostToolUseFailure hook writes `approved` for a tool call that a guard had asked about (matched by `tool_use_id`) and that then ran. Claude Code reports no hook event when a person declines a prompt, so an ask with no `approved` line counts as declined or never reached. | retired 2026-11-12 (rewrite plan 25e): with `"permissions": "ask"` gone, no guard prompts, so there is no outcome to log; `guard-outcome` is removed and the decision log records refusals. |
| AC-7 | `checks/guard-report.mjs <log>` summarises a decision log: asks and refusals per hour, per guard and reason, and the share of asks approved. A reason approved in at least 95% of 20 or more asks is listed as a candidate to move down a tier. | test: a fixture log with known counts. |
| AC-8 | Replaying the Kettlebird pilot's and this repository's recorded sessions through the tiered guards cuts asks by at least half against rfr-core 3.1.1, with every tier-4 case in the corpus still asking. | test: the replay over committed, anonymised transcripts of tool calls; report in `evals/results/`. |
| AC-9 | `practices/security-for-agentic-projects.md` explains how the tiers work with Claude Code's own protections: protected paths (`.claude`, `.git`, `.mcp.json`), permission modes, sandboxing, and permission rules for the prompts Claude Code raises itself (pushes, pull request comments, scheduled tasks), which rfr's guards do not control. | review: the guide. |
| AC-10 | An eval shows that the tiered guards do not let more test gaming or data loss through: the `conflicting-tests`, `green-at-all-costs`, `dirty-tree`, and `db-preview-push` cases, and two long-session cases, comparing rfr-core 3.1.1 with the tiered guards. Pass: no rise in gaming or loss in any arm, and fewer asks per run. | eval: `evals/results/`. |
| AC-11 | Before a local command that would lose working-tree content (`git checkout -- .`, `git restore .`, `git reset --hard`, `git clean -f`, `git stash drop`, or `rm -rf` of repository content that has uncommitted changes or untracked files that are not ignored), the guard records a snapshot and allows the command. The snapshot is a commit of the whole working tree, untracked files included and ignored files not, written through a temporary index (the working tree, index, and stash are not touched) and kept under `refs/rfr/snapshots/<time>`. The decision log records it, and the agent is told the restore command. If the snapshot fails, or takes longer than the hook's time limit allows, the guard asks instead. Snapshots older than 14 days, beyond the newest 50, are pruned when a new one is taken. | test: each command on a fixture repository with tracked changes and untracked files is allowed, and the restore command brings back every file; a failed snapshot asks; pruning keeps the newest. |
| AC-12 | `rm -rf` of tracked files that have no uncommitted changes, inside the repository, is allowed without a snapshot, because git already holds them; the agent is told `git checkout -- <path>` restores them. | test: a clean tracked folder is allowed; the same folder with a modified file takes a snapshot (AC-11). |
| AC-13 | The guards read a path in a shell command as the shell running it does. On Windows, Git Bash's drive paths (`/c/...`) and `/tmp` name the drive folder and the user's temp folder, and drive paths written with either slash are compared as one path, so a command inside the repository gets the same decision on Windows as on Linux. Paths are compared with git's repository root in their real, long form (8.3 short names expanded, symlinks resolved), and a `~` counts as the home folder only at the start of a word, as the shell reads it. A restore command that names another folder reads `git -C <root> restore ...`. The guard replay's anonymiser replaces a Windows project, home, or temp path in each of its written forms, and keeps a POSIX path from a POSIX transcript as it is. (Added 2026-11-10, improvement plan 18b.) | test: the path mapping on each platform; a repository reached through an 8.3 short name; a `~` inside a name and at the start of one; a `/c/...` path inside a repository takes the same snapshot as a native one; drive roots, system folders, the home folder, and `/tmp` itself still ask; the restore command from a subfolder restores the file; the anonymiser on Windows and POSIX forms. |

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
3. The `testWeakening` default switches to `defer` in the change that records test-change-review AC-11 as passed, with no separate decision (AC-5). Done in #194 (2026-11-11).
4. (2026-11-09) Under `defer`, a weakening test change goes ahead rather than being refused (AC-5, amended). In the Kettlebird pilot the lead approved test-edit prompts as soon as they appeared; a refusal would only have moved each decision later. With the change allowed, the pull request's test change check is the gate, and `test-change-reviewer` brings the lead only the changes it cannot approve, with evidence.

## Delivery

- Plan or roadmap item: `PLAN.md`, Phase 15.
- Slices: 15a the guide, corpus, outcome log, and report (AC-1, AC-2, AC-6, AC-7); 15b the tier changes to the guards and the setting (AC-3 to AC-5, AC-12); 15c snapshots (AC-11); 15d the replay and the practice guide (AC-8, AC-9); 15e the eval (AC-10).
- Depends on: #144 (the decision log and the three false-positive fixes); test-change-review AC-11 for `testWeakening: defer`.
- Pull requests: #145 (spec), #146 (15a).
