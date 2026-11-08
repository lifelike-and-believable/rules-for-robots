# Guards and their tiers

Every decision the rfr-core, rfr-web, rfr-unreal, and rfr-process guards make, the tier it belongs to, and why ([docs/specs/guard-tiers.md](../docs/specs/guard-tiers.md)). A guard should interrupt a person only when an action cannot be undone, or reaches outside the project, and a person is the one who has to decide. Everything else is allowed, refused with a reason the agent acts on, or judged at the pull request.

| Tier | The guard | Who acts |
|---|---|---|
| 1. Allow | does nothing, or takes a snapshot first | nobody |
| 2. Refuse with a reason | refuses, and the reason says what to do instead | the agent |
| 3. Defer to the pull request | refuses with "say so in your report" | the pull request check and its reviewer |
| 4. Ask | asks | a person, now |

"Now" is what the guard does in this release. "Target" is the tier the spec sets; where they differ, the slice that moves it is named. The corpus in `test/fixtures/guard-corpus.json` holds a case for each row and fails when a guard's decision drifts from its tier.

## `guard-commands` (rfr-core; shell commands)

| Decision | Rule | Failure it prevents | Now | Target | Why |
|---|---|---|---|---|---|
| A shell command writes to an existing test file | TEST-001 | Editing tests through the shell, where the change cannot be checked | 2 | 2 | The agent can make the same change with the Edit tool, which `guard-test-edits` checks |
| A shell command moves or deletes an existing test file (`rm`, `mv`, `git rm`, `git mv`) | TEST-001 | Removing a test to get green | 4, or 3 with `testWeakening: defer` | 4, then 3 | Removing a test is the strongest weakening; the `testWeakening` setting moves it to the pull request (AC-5) |
| A command only runs, reads, or mentions a test file | TEST-001 | none | 1 | 1 | Nothing changes |
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
| `git branch -D` | WA-003 | Losing unmerged commits | 4 | 4 | The commits survive only in the reflog, which an agent rarely checks; under review in the replay (15d) |
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
| A weakening edit to an existing test, with no `unlocks` entry, or one the classifier cannot read | TEST-001 | Editing a test to make it pass | 4, or 3 with `testWeakening: defer` | 4, then 3 | The default moves to the pull request when the test-change reviewer's eval passes (AC-5) |

## `guard-owned-paths` (rfr-core; Edit, Write; opt-in)

| Decision | Rule | Failure it prevents | Now | Target | Why |
|---|---|---|---|---|---|
| An edit to a project file not on the `AGENTS.md` owned-paths list | #47 | An agent working outside its lane | 2 | 2 | The edit is reversible, and the agent can hand the change back to its caller instead |

## `guard-unreal` (rfr-unreal; shell commands)

| Decision | Rule | Failure it prevents | Now | Target | Why |
|---|---|---|---|---|---|
| Unreal `-ExecCmds` without a final `Quit` | UE practice | An editor left running in CI | 2 | 2 | The agent can add `;Quit`; nothing is lost either way |

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
{ "testWeakening": "ask" }
```

`testWeakening` is `ask` (the default: weakening, moving, or deleting an existing test asks a person now) or `defer` (the guard refuses with "say so in your report", and the pull request's test-change review decides). The default becomes `defer` in the release that records the test-change reviewer's eval (test-change-review AC-11) as passed; a project that wants to keep being asked sets `ask`.

## Prompts rfr does not control

Claude Code raises its own prompts for actions its permission settings do not allow: pushing, posting pull request comments, creating scheduled tasks, and writes to protected paths (`.claude`, `.git`, `.mcp.json`). rfr's guards neither add nor remove those. The practice guide for security (AC-9, slice 15d) will say which permission rules a project can set for them.

## Measuring

Each ask or refusal is appended to `guard-decisions.jsonl` in the data folder of the plugin whose guard made it, and an asked call that then runs adds an `approved` line. `node checks/guard-report.mjs <log>...` summarises one or more logs: asks per hour by guard and reason, and the share of asks that were approved. A reason approved in at least 95% of 20 or more asks is a candidate to move down a tier. Claude Code reports no hook event when a person declines a prompt, so an ask with no `approved` line was declined, or the session ended first.
