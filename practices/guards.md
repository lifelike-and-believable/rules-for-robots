# Guards and their tiers

Every decision the rfr-core, rfr-web, rfr-unreal, and rfr-process guards make, the tier it belongs to, and why ([docs/specs/guard-tiers.md](../docs/specs/guard-tiers.md)). A guard should interrupt a person only when an action cannot be undone, or reaches outside the project, and a person is the one who has to decide. Everything else is allowed, refused with a reason the agent acts on, or judged at the pull request.

| Tier | The guard | Who acts |
|---|---|---|
| 1. Allow | does nothing, or takes a snapshot first | nobody |
| 2. Refuse with a reason | refuses, and the reason says what to do instead | the agent |
| 3. Defer to the pull request | lets the action go ahead, and tells the agent to say so in its report | the pull request check and its reviewer |
| 4. Ask | asks | a person, now |

"Now" is what the guard does in this release. "Target" is the tier the spec sets; where they differ, the slice that moves it is named. The corpus in `test/fixtures/guard-corpus.json` holds a case for each row and fails when a guard's decision drifts from its tier.

## Unattended runs

A session runs without the person ([docs/specs/unattended.md](../docs/specs/unattended.md)). Nothing during the run asks them anything, by prompt or in chat.

- **Allowed.** Whatever the guards do not refuse. Whether Claude Code prompts for it is the session's permission mode: run sessions in auto mode, which a project cannot set ([adoption guide](../docs/adoption-guide.md)).
- **Never.** The actions in the table below are refused, with a reason that names what to do instead. If the task cannot be done without one, the agent sets that part aside, records it in the pull request's `## Decisions` section, and finishes the rest; the person decides it at review. A "yes" in chat does not unlock one.
- **Approved in GitHub.** What only the person can authorise is a review in GitHub, not something they say in chat. An agent pushes a branch; a workflow opens the pull request, and branch protection holds a gated one until the approver reviews it ([github-gate](../docs/specs/github-gate.md)). Approving a pull request is refused (github-gate AC-9).

Claude Code's own prompts (protected paths such as `.claude`, `.git`, and `.mcp.json`, and auto mode's classifier) are outside rfr's control; a hook's refusal blocks in every mode. Until rewrite plan 25e, rfr-core allowed the agent's working tools itself (default allow), approved commands the person asked for in chat (task approval), and could prompt instead of refusing (`"permissions": "ask"`); all three were removed with the GitHub gate.

### Named asks: the never list

| Action | Guard | Corpus cases |
|---|---|---|
| Force-push | `guard-commands` | `force-push` |
| Push to the default branch | `guard-commands` | `push-default-branch`, `push-head-to-default` |
| Delete a branch, tag, release, or repository on the remote, by git, `gh`, the API, or the Vercel CLI | `guard-commands`; the Vercel CLI, `guard-cli` | `remote-branch-delete`, `remote-branch-delete-colon`, `repo-delete`, `api-delete`, `vercel-remove` |
| Rewrite history, or move a ref on the remote through the API; force-delete a local branch the guard cannot resolve (one it can is allowed, with the command that restores it) | `guard-commands` | `filter-repo`, `api-ref-patch`, `branch-force-delete-unknown` |
| Skip hooks (`--no-verify`, `git commit -n`, `core.hooksPath`, `HUSKY=0`, `SKIP=`) | `guard-commands` | `no-verify`, `commit-no-verify-short`, `hooks-path`, `husky-off` |
| Change machine-wide git configuration | `guard-commands` | `config-global` |
| Delete files outside the repository, root-like paths, or what no snapshot covers | `guard-commands` | `rm-outside`, `rm-root-like` |
| Destructive database commands | `guard-cli` | `drizzle-push`, `prisma-reset` |
| Production deploy, promotion, alias, or domain change; a redeploy not marked preview; changing environment variables | `guard-cli`, `guard-mcp` | `vercel-prod-cli`, `vercel-deploy-prod`, `vercel-redeploy`, `vercel-env-rm` |
| Read a secret value: a `.env` or key file read by a shell command, an unfiltered listing of the environment, a secret-named variable printed, `vercel env pull`, or a Vercel MCP read that decrypts | `guard-commands`, `guard-cli`, `guard-mcp` | `vercel-token`, `vercel-decrypted-env`, `read-env-file`, `env-dump`, `vercel-env-pull` |

An agent approving a pull request is refused as well (`guard-commands` and `guard-pr-approval`, [github-gate AC-9](../docs/specs/github-gate.md)), with the next step of giving the approver the review link; `test/refuse-pr-approval.test.mjs` covers it in place of corpus cases. **What the patterns cannot see.** The guard reads command lines, so it catches the usual forms of each action: wrappers (`bash -c`, `$(…)`, `command`, `env`), Windows names (`git.exe`), package runners (`npx -y vercel@latest`), global flags, and the API routes. It does not read what a program does once it runs. A script or one-liner in another language (`node -e`, `python -c`) that reads `.env` or calls the API, a git alias, `GIT_CONFIG_PARAMETERS`, `git update-ref -d`, `gh api` writes to `contents/` or `merges`, and `vercel api` go through. What contains them is the environment: credentials with no production reach, branch protection on the default branch, and a cloud container or sandbox (rewrite plan, section 3).

Publishing a release or pushing a tag is not on the list. A merge is not either: under the GitHub gate a workflow turns on auto-merge, and branch protection holds a pull request until its checks pass and, for gated process files, until the approver reviews it. Through MCP, `guard-mcp-tools` refuses a tool that changes something in another service, and a GitHub tool that deletes, changes settings or access, or publishes a release; reads, the GitHub tools for the agent's own work, and subscribing to a pull request go ahead (`test/guard-never-list.test.mjs`). `guard-commands` also refuses bypassing or changing branch protection (`gh pr merge --admin`, or a `gh api` change to protection or rulesets) and replacing a published release's assets (`gh release upload --clobber`).

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
| `rm -rf` of a folder the same command line made inside a temp folder (`/tmp`, `/var/tmp`, or the system temp folder) with `cp -r`, `mkdir`, `git clone`, or `git worktree add`, or of relative paths inside it | WA-003 | none | 1 | 1 | The folder did not exist before the line, so everything in it is the line's own throwaway copy (found in a cloud session, 2026-11-12) |
| `rm -rf` of tracked files with no uncommitted changes | WA-003 | none | 1 | 1 | Git holds them; the guard tells the agent the `git checkout -- <path>` that restores them (AC-12) |
| `rm -rf` of repository content with uncommitted changes or untracked files that are not ignored | WA-003 | none | 1 with a snapshot | 1 with a snapshot | AC-11 |
| `rm -rf` outside the repository and the temp directory, of a root-like path (`.`, `/`, `..`), a glob, or a variable with no known value; `Remove-Item -Recurse -Force` | WA-003 | Deleting files no snapshot covers | 4 | 4 | A local snapshot cannot undo it, or the guard cannot tell what it deletes |
| Force-push (`--force`, `--force-with-lease`, `+ref`) | WA-003 | Rewriting shared history | 4 | 4 | It changes a remote |
| `git branch -D` of a branch the guard can resolve | WA-003 | none | 1 | 1 | The commits stay in the repository, and the guard tells the agent the `git branch <name> <sha>` that restores it (rewrite plan 25e). One it cannot resolve is tier 4 |
| `git commit -n`, `core.hooksPath` set for a command or in the configuration, `HUSKY=0` or `SKIP=` before a commit | WA-003 | Skipping the project's own checks | 4 | 4 | The same as `--no-verify` (rewrite plan 25e) |
| A shell read of a `.env` or key file, an unfiltered `env` or `printenv`, or a secret-named variable printed | SEC-001 | Secrets entering the session | 4 | 4 | Once read, a secret cannot be un-read. An example file, and a listing piped into a filter (`env \| grep PXR`), are allowed |
| `gh api -X DELETE`, a `gh api` change to `git/refs` | WA-003 | Deleting or changing what is on the remote | 4 | 4 | The same actions as the named commands above, by another route (rewrite plan 25e) |
| `git filter-branch`, `git filter-repo` | WA-003 | Rewriting history | 4 | 4 | Hard to undo, and usually pushed |
| `--no-verify` | WA-003 | Skipping the project's own checks | 4 | 4 | The checks exist for a reason a person set |
| `git config --global` or `--system` | WA-003 | Changing the machine for every project | 4 | 4 | It reaches outside the project |

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

## `guard-cli` (rfr-web; shell commands)

Moved from `guard-commands` in rewrite plan 25e (verify inventory slice f2), so a project without rfr-web does not carry the web stack's checks. It reads a command line the way `guard-commands` does, with a copy of the same parser (`command-words.mjs` and `shell-writes.mjs`, copied by `npm run build`), so the routes listed under "What the patterns cannot see" above apply to it too.

| Decision | Rule | Failure it prevents | Now | Target | Why |
|---|---|---|---|---|---|
| `drizzle-kit push`, `drizzle-kit --force`, `prisma migrate dev/reset`, `prisma db push/migrate` | PG-001 | Losing data in a database | 4 | 4 | A database is outside the repository, and its data has no snapshot |
| `vercel --prod` (or `--prod=<value>`, `--target production`), `promote`, `alias`, `domains`, `rollback`, a `redeploy` without `--target preview`, `vercel env add/rm` | NODE-002 | Changing what users of the live site see | 4 | 4 | A preview deployment is the way to show the change |
| `vercel remove`, `vercel project rm`, `vercel dns rm`, `vercel certs rm` | WA-003 | Deleting what the live site depends on | 4 | 4 | It is outside the project folder, and no snapshot covers it |
| `vercel env pull`, `vercel pull --environment production` | SEC-001 | Secrets entering the session | 4 | 4 | Once read, a secret cannot be un-read |
| `vercel`, `vercel deploy` (a preview), `vercel env ls`, `vercel logs` | NODE-002 | none | 1 | 1 | Nothing live changes, and no secret is read |

## `guard-mcp` (rfr-web; Vercel MCP)

| Decision | Rule | Failure it prevents | Now | Target | Why |
|---|---|---|---|---|---|
| A read (`get_`, `list_`, `search_`, and others) that returns no secrets | NODE-002 | none | 1 | 1 | Nothing changes |
| A read that returns credentials or decrypted environment variables | NODE-002 | Secrets entering the session | 4 | 4 | Once read, a secret cannot be un-read |
| A deployment whose target is not production | NODE-002 | none | 1 | 1 | A preview is what NODE-002 asks for instead of a production deploy |
| Anything else: production deploy, promote, roll back, settings, environment variables, delete, purchase | NODE-002 | Acting on the account beyond intent | 4 | 4 | It changes a service outside the project |

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

## Prompts rfr does not control

Claude Code still prompts for writes to protected paths (`.claude`, `.git`, `.mcp.json`) and for whatever the session's permission mode does not allow. Run sessions in auto mode, which a project cannot set for itself. [security-for-agentic-projects.md](security-for-agentic-projects.md#the-guards-and-claude-codes-own-protections) explains how the guards sit with Claude Code's permission modes, protected paths, permission rules, and sandbox.

## Measuring

Each refusal is appended to `guard-decisions.jsonl` in the data folder of the plugin whose guard made it. `node checks/guard-report.mjs <log>...` summarises one or more logs by guard and reason; it still reads the `ask` and `approved` lines that logs from before rewrite plan 25e hold.

The guard log sees only the guards' own asks. `node checks/attention-report.mjs <transcripts folder> --repo <owner/name>` reads a project's Claude Code transcripts (under `~/.claude/projects/`) and counts every wait on a person: permission prompts from any source, questions, and replies after the agent ended its turn, with their durations and the figures per merged pull request. It prints counts and durations only.

## Replay

`node checks/guard-replay.mjs` replays recorded sessions through two versions of the guards. `extract` turns Claude Code transcripts into anonymised tool calls; `run` sends them through rfr-core 3.1.1 and through this checkout's guards, on a clone of the repository with edits applied in order, and writes a report. The first replay, of this repository's session that built #143 to #154, is in [evals/results/2026-11-08-15d-guard-replay](../evals/results/2026-11-08-15d-guard-replay/report.md): asks fell from 9 to 2. To replay another project's sessions, run `extract` there on the session files in `~/.claude/projects/<project>/`, read the output before sharing it, and `run` it with `--repo` pointing at that project.
