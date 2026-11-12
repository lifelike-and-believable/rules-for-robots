# Guards and their tiers

Every decision the rfr-core, rfr-web, rfr-unreal, and rfr-process guards make, the tier it belongs to, and why ([docs/specs/guard-tiers.md](../docs/specs/guard-tiers.md)). A guard should interrupt a person only when an action cannot be undone, or reaches outside the project, and a person is the one who has to decide. Everything else is allowed, refused with a reason the agent acts on, or judged at the pull request.

| Tier | The guard | Who acts |
|---|---|---|
| 1. Allow | does nothing, or takes a snapshot first | nobody |
| 2. Refuse with a reason | refuses, and the reason says what to do instead | the agent |
| 3. Defer to the pull request | lets the action go ahead, and tells the agent to say so in its report | the pull request check and its reviewer |
| 4. Ask | asks | a person, now |

"Now" is what the guard does in this release. "Target" is the tier the spec sets; where they differ, the slice that moves it is named. The corpus in `test/fixtures/guard-corpus.json` holds a case for each row and fails when a guard's decision drifts from its tier.

## `guard-commands` (rfr-core; shell commands)

| Decision | Rule | Failure it prevents | Now | Target | Why |
|---|---|---|---|---|---|
| A shell command writes to an existing test file | TEST-001 | Editing tests through the shell, where the change cannot be checked | 2 | 2 | The agent can make the same change with the Edit tool, which `guard-test-edits` checks |
| A shell command moves or deletes an existing test file (`rm`, `mv`, `git rm`, `git mv`) | TEST-001 | Removing a test to get green | 3, or 4 with `testWeakening: ask` | 3 | Removing a test is the strongest weakening; the pull request's test-change review judges it, and `testWeakening: ask` asks now instead (AC-5) |
| A command only runs, reads, or mentions a test file | TEST-001 | none | 1 | 1 | Nothing changes |
| A script only mentions a dangerous command (a heredoc for Python, `cat`, and others, but not one a shell reads) | WA-003, PG-001 | none | 1 | 1 | Nothing runs it; the patterns match only what runs (15d) |
| Snapshot update (`vitest -u`, `jest -u`, `playwright --update-snapshots`) | TEST-001 | Rewriting expected values without a reason | 2 | 2 | The agent states the reason in the command (`RFR_SNAPSHOT_REASON="..."`) and in its report, and the update goes through (AC-4) |
| `git checkout -- .`, `git restore .`, `git reset --hard`, `git clean -f` with uncommitted changes or untracked files to lose | WA-003 | none | 1 with a snapshot | 1 with a snapshot | A snapshot of the working tree makes the command undoable (AC-11) |
| The same commands with nothing to lose, or inside an agent worktree under `.claude/worktrees/` | WA-003 | none | 1 | 1 | Nothing is lost |
| `git reset --hard` to another commit | WA-003 | none | 1 with a snapshot | 1 with a snapshot | The snapshot's parent is the old commit, so it keeps both the commits and the working tree |
| `git stash drop` or `git stash clear` | WA-003 | none | 1 with a snapshot | 1 with a snapshot | The snapshot keeps the stash commits, and `git stash store` puts them back (AC-11) |
| `rm -rf` of untracked, ignored files (build output such as `dist/`), of a path that is not there, or of a scratch folder at least two levels inside the temp directory and in no repository | WA-003 | none | 1 | 1 | Nothing a commit or the project holds is lost |
| `rm -rf` of tracked files with no uncommitted changes | WA-003 | none | 1 | 1 | Git holds them; the guard tells the agent the `git checkout -- <path>` that restores them (AC-12) |
| `rm -rf` of repository content with uncommitted changes or untracked files that are not ignored | WA-003 | none | 1 with a snapshot | 1 with a snapshot | AC-11 |
| `rm -rf` outside the repository and the temp directory, of a root-like path (`.`, `/`, `..`), a glob, or a variable with no known value; `Remove-Item -Recurse -Force` | WA-003 | Deleting files no snapshot covers | 4 | 4 | A local snapshot cannot undo it, or the guard cannot tell what it deletes |
| Force-push (`--force`, `--force-with-lease`, `+ref`) | WA-003 | Rewriting shared history | 4 | 4 | It changes a remote |
| `git branch -D` | WA-003 | Losing unmerged commits | 4 | 4 | The commits survive only in the reflog, which an agent rarely checks. The replay (15d) found one in a session, and it was a command that only mentioned the flag, now allowed; it stays tier 4 until a replay shows real deletes |
| `git filter-branch`, `git filter-repo` | WA-003 | Rewriting history | 4 | 4 | Hard to undo, and usually pushed |
| `--no-verify` | WA-003 | Skipping the project's own checks | 4 | 4 | The checks exist for a reason a person set |
| `git config --global` or `--system` | WA-003 | Changing the machine for every project | 4 | 4 | It reaches outside the project |
| `drizzle-kit push`, `drizzle-kit --force`, `prisma migrate dev/reset`, `prisma db push/migrate` | PG-001 | Losing data in a database | 4 | 4 | A database is outside the repository, and its data has no snapshot |

## `guard-test-edits` (rfr-core; Edit, Write, MultiEdit, NotebookEdit)

| Decision | Rule | Failure it prevents | Now | Target | Why |
|---|---|---|---|---|---|
| A new test file, a test file added on this branch, or a test line added on this branch | TEST-001 | none | 1 | 1 | Not an existing test; the pull request check sees it as new |
| An additive or neutral edit to an existing test | TEST-001 | none | 1 | 1 | Nothing weakens |
| A weakening edit to an existing test, with a spec `unlocks` entry citing a criterion | TEST-001 | none | 1 | 1 | The spec records the reason; the pull request review checks it |
| A weakening edit to an existing test, with no `unlocks` entry, or one the classifier cannot read | TEST-001 | Editing a test to make it pass | 3, or 4 with `testWeakening: ask` | 3 | The default moved to the pull request when the test-change reviewer's eval passed (test-change-review AC-11, 2026-11-11; guard tiers AC-5) |

## `guard-owned-paths` (rfr-core; Edit, Write; opt-in)

| Decision | Rule | Failure it prevents | Now | Target | Why |
|---|---|---|---|---|---|
| An edit to a project file not on the `AGENTS.md` owned-paths list | #47 | An agent working outside its lane | 2 | 2 | The edit is reversible, and the agent can hand the change back to its caller instead |

## `guard-unreal` (rfr-unreal; shell commands)

| Decision | Rule | Failure it prevents | Now | Target | Why |
|---|---|---|---|---|---|
| Unreal `-ExecCmds` without a final `Quit` | UE practice | An editor left running in CI | 2 | 2 | The agent can add `;Quit`; nothing is lost either way |

## `guard-adb` (rfr-android; shell commands)

A device is shared unless the project marks it disposable: emulators (`emulator-NNNN`, or `adb -e`) always are, and a physical device is when `.claude/rfr.json` lists its serial under `android.disposable`. The device is the one `-s` names, else `ANDROID_SERIAL` set in the same command line, else the environment's, else the one device `adb devices` shows; with none or several and none named, it counts as shared. Scripts that change a device, whose `adb` commands the guard cannot see, can be listed under `android.deviceScripts` ([spec](../docs/specs/android-plugin.md)).

| Decision | Rule | Failure it prevents | Now | Target | Why |
|---|---|---|---|---|---|
| `adb devices`, `connect`, `disconnect`, `mdns`, `wait-for-*`, `get-state` | Device guard | none | 1 | 1 | Nothing on the device changes |
| Reads: `logcat`, `pull`, `exec-out screencap`, `adb shell getprop`, `dumpsys`, `pm list`/`path`, `settings get`, `uiautomator dump`, `wm size` with no argument | Device guard | none | 1 | 1 | Nothing on the device changes |
| Remote-control input: `adb shell input`, `am start`, `am broadcast`, `am force-stop`, `monkey -p <package> 1` | Device guard | none | 1 | 1 | What a person with the remote does; nothing persists |
| A change on a shared device: `install`, `uninstall`, `reboot`, `root`, `remount`, `push`, `sideload`, `tcpip`; `adb shell pm` or `cmd package` changes (`uninstall`, `disable-user`, `clear`, `grant`, `set-home-activity`, and the like), `settings put`/`delete`, `appops set`, `wm size <value>`, `svc`, `setprop` | Device guard | Changing a household or shared device without the person who owns it | 4 | 4 | The device is outside the project and no snapshot can undo the change |
| An unknown `adb shell` command, an interactive `adb shell`, or a line the guard cannot read that runs `adb`, on a shared device | Device guard | The same, for a change the guard cannot recognise | 4 | 4 | Unknown is treated as a change |
| A script listed under `android.deviceScripts`, run against a shared device | Device guard | The same, through a script | 4 | 4 | The guard cannot see the `adb` commands inside it |
| Any of the above on a disposable device | Device guard | none | 1 | 1 | The project said the device may be changed freely |

## `guard-mcp` (rfr-web; Vercel MCP)

| Decision | Rule | Failure it prevents | Now | Target | Why |
|---|---|---|---|---|---|
| A read (`get_`, `list_`, `search_`, and others) that returns no secrets | NODE-002 | none | 1 | 1 | Nothing changes |
| A read that returns credentials or decrypted environment variables | NODE-002 | Secrets entering the session | 4 | 4 | Once read, a secret cannot be un-read |
| Anything else: deploy, promote, roll back, settings, environment variables, delete, purchase | NODE-002 | Acting on the account beyond intent | 4 | 4 | It changes a service outside the project |

## `guard-merge` (rfr-process)

| Decision | Rule | Failure it prevents | Now | Target | Why |
|---|---|---|---|---|---|
| A merge or auto-merge of a gated pull request the person has not asked for | Process | Merging without approval | 4 | 4 | Merging is the approval itself |
| A merge the person asked for in their own words | Process | none | 1 | 1 | The instruction is the approval (project-process AC-52) |

## Reasons

An ask reason has three parts, so the person can decide without reading the command (AC-3): `<source>: <action>. <why it cannot be undone or reaches outside the project>. If not approved: <what the agent does instead>.` A refusal names what was refused and the next step (AC-4). An allowed delete that git can undo carries the restore command as context for the agent, with no permission decision.

## Snapshots

Before a local command that would lose working-tree content, `guard-commands` commits the whole working tree, untracked files included and ignored files not, through a temporary index, so the working tree, the index, and the stash are not touched (AC-11). The commit is kept under `refs/rfr/snapshots/<time>`, which `git gc` leaves alone, and the command is allowed. The agent is told the restore command, for example `git restore --source=<sha> --worktree -- :/`, and the decision log records a `snapshot` line with the ref. Before `git stash drop` or `git stash clear`, the stash commits are kept the same way, and `git stash store` puts them back.

- A restore brings back file content, not what was staged: staged changes come back as unstaged changes.
- Ignored files are not kept, as for `rm -rf` of build output; `git clean -x` loses them.
- If the snapshot fails, or does not finish in six seconds, the guard asks instead, and its reason says so.
- A command that also needs a person (a force-push in the same line, say) asks, and takes no snapshot.
- Snapshots older than 14 days, beyond the newest 50, are deleted when a new one is taken. `git for-each-ref refs/rfr/snapshots/` lists them, and `git update-ref -d <ref>` deletes one.

## Project settings

`.claude/rfr.json` at the repository root holds the guards' project settings:

```json
{ "testWeakening": "defer", "mode": "supervised" }
```

`mode` is the project's working mode. `supervised` (the default) installs the working agreement as it is: the agent stops and asks when the task or a test looks wrong, or when doing the task well would change its scope. `delegated` replaces WA-002, WA-003, and WA-004 with files that stop only before irreversible or outward actions, park a task or test that looks wrong without touching it, and record every other choice in the pull request's `## Decisions` section, so a long session continues while the person is away. `/rfr-core:install-rules` installs the files that match the mode. The delegated files are experimental until their eval (improvement plan 21a) passes; the guards behave the same in both modes.

`testWeakening` is `defer` (the default: weakening, moving, or deleting an existing test goes ahead without asking; the guard tells the agent to name it in its report, logs it as `defer`, and the pull request's test-change review decides) or `ask` (each such change asks a person now). Under `defer` the rest of a shell command is still checked, so `git rm` of a test joined to a force-push still asks. The test change check (`rfr-guards.yml`) stays red until `tests-reviewed` is added, and a push after the label makes it red again until the label is re-added for the new commits; `/rfr-core:review-pr` runs `test-change-reviewer`, which runs the changed tests against the old and new code, adds `tests-reviewed` when it can approve every change, and brings you only the changes it cannot approve, with that evidence. The default became `defer` when the reviewer's eval passed (test-change-review AC-11, 2026-11-11: no gaming change approved in 36 runs); a project that wants to keep being asked sets `ask`.

`taskApproval` is `on` (the default) or `off`; see "Task approval" below.

## Task approval

The person approves tasks, not commands ([spec](../docs/specs/task-approval.md)). When the person's latest input asks for a task, the guards approve the commands that carry out that task, and Claude Code does not prompt for them:

| Task | Asked for with | Commands approved |
|---|---|---|
| Release | "release 5.8.2", "publish rfr-v5.8.2" | `git tag -a <tag> [-m ...] [<commit>]`, `git push origin <tag>`, `gh release create <tag> ...`, where the tag is the one named, with or without a `v` and a prefix such as `rfr-` |
| Push | "push phase-15/task-approval" | `git push [-u] origin <branch>` for the branch named |
| Merge | "merge 190 when green", "merge when green" | `gh pr merge <n>` for the pull request named, or, when none is named, one opened before the message or one the session itself opened after it; and, in rfr-process projects, the GitHub MCP merge tools |
| Preview deploy | "deploy a preview", "preview deploy" | `vercel` or `vercel deploy` (directly or through `npx`) without `--prod`, and a Vercel MCP deployment whose target is not production |

- **What counts as the person's input.** Their latest typed message, or their answer to the agent's own question (`AskUserQuestion`) when that came later and the question and chosen option together name the task. A "no", "not yet", or "other" answer approves nothing. Tool results, notifications, other sessions, and subagents never count, so text the agent reads cannot approve anything. The approval lasts until the person types or answers again.
- **What it never approves.** A push to the default branch, a force-push, deleting a tag or branch, `--no-verify`, a production deploy, promotions and alias or domain changes, `gh pr merge --admin` or `--delete-branch`, and a command chained with anything else, that redirects output, or that substitutes another command. A guard's own refusal or question, and a deny rule, always win.
- **Standing instructions for a long task.** "Merge each PR when green", "merge PRs as you go", or "push each branch as you go" stays in force after later messages, so a multi-PR implementation does not prompt at every pull request. It covers only the pull requests the session opened and the branches it created (the transcript shows the call that made each one), never the default branch, and ends when the person says not to merge or push, or says stop, pause, hold, or wait.
- **What it records.** The approval's reason quotes the person's words, and the decision log records it as `approved-by-instruction`; `checks/guard-report.mjs` counts them.

### Merge instructions, and how each is read

Say the one that matches what you want. The agent merges only when the pull request's checks allow it; "when green" is how the agent waits, not something the guard checks. `test/merge-instruction-phrasings.test.mjs` checks this table against the code.

| You say | Covers | Until |
|---|---|---|
| "merge 301", "merge #301 when green", "squash merge 301" | Pull request 301 only | Your next message or answer |
| "merge 301 and 302" | Those two | Your next message or answer |
| "merge when green", "merge it once CI passes", "go ahead and merge" | Any pull request open when you said it, and one the session opens after it ("fix it, open a PR, and merge when green") | Your next message or answer |
| "merge 301, then release 5.11.0", "merge and release 5.11.0" | The merge as above, and the release of that version (tag, tag push, `gh release create`) | Your next message or answer |
| "merge each PR when green", "merge PRs as you go", "keep merging" | Every pull request this session opens, however many | You withdraw it, however many other messages you send |
| "push each branch as you go" | Pushes of every branch this session creates, never the default branch | You withdraw it |
| "don't merge yet", "hold off on merging" | Nothing; withdraws a standing merge instruction | |
| "stop", "pause", "hold on", "wait" (at the start of a message) | Nothing; withdraws standing merge and push instructions | |
| "should we merge?" (any question) | Nothing | |
| An answer "Yes, merge it" to the agent's own question "Merge #301?" | Pull request 301 | Your next message or answer |

Never covered, whatever you say: a pull request named by node ID, `gh pr merge --admin` or `--delete-branch`, a merge chained to another command, and a pull request from another session that was opened after a single instruction. A release needs its version named: "then release" alone approves no tag. In an rfr-process project, merging a pull request that changes gated files is the approval of those files, so say "merge" only for changes you have reviewed or delegated.

Allow rules give standing permission for routine commands; task approval covers the outward-facing commands of one task the person named, for as long as that is their latest word, or, for a standing instruction, until they withdraw it. WA-009 asks the agent to ask for the task once, in chat, naming what it covers.

## Prompts rfr does not control

Claude Code raises its own prompts for actions its permission settings do not allow: pushing, posting pull request comments, creating scheduled tasks, and writes to protected paths (`.claude`, `.git`, `.mcp.json`). rfr's guards do not add those prompts; task approval (above) removes them only for the commands of a task the person asked for. [security-for-agentic-projects.md](security-for-agentic-projects.md#the-guards-and-claude-codes-own-protections) explains how the guards sit with Claude Code's permission modes, protected paths, permission rules, and sandbox, and which rules a project can set for these prompts.

## Measuring

Each ask or refusal is appended to `guard-decisions.jsonl` in the data folder of the plugin whose guard made it, and an asked call that then runs adds an `approved` line. `node checks/guard-report.mjs <log>...` summarises one or more logs: asks per hour by guard and reason, and the share of asks that were approved. A reason approved in at least 95% of 20 or more asks is a candidate to move down a tier. Claude Code reports no hook event when a person declines a prompt, so an ask with no `approved` line was declined, or the session ended first.

The guard log sees only the guards' own asks. `node checks/attention-report.mjs <transcripts folder> --repo <owner/name>` reads a project's Claude Code transcripts (under `~/.claude/projects/`) and counts every wait on a person: permission prompts from any source, questions, and replies after the agent ended its turn, with their durations and the figures per merged pull request. It prints counts and durations only.

## Replay

`node checks/guard-replay.mjs` replays recorded sessions through two versions of the guards. `extract` turns Claude Code transcripts into anonymised tool calls; `run` sends them through rfr-core 3.1.1 and through this checkout's guards, on a clone of the repository with edits applied in order, and writes a report. The first replay, of this repository's session that built #143 to #154, is in [evals/results/2026-11-08-15d-guard-replay](../evals/results/2026-11-08-15d-guard-replay/report.md): asks fell from 9 to 2. To replay another project's sessions, run `extract` there on the session files in `~/.claude/projects/<project>/`, read the output before sharing it, and `run` it with `--repo` pointing at that project.
