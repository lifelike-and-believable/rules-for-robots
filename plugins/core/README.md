# rfr-core

Core plugin from [rules-for-robots](../../README.md): the guards, reviewers, and skills every project uses. Add a domain plugin for the rest:

- [`rfr-web`](../web/README.md) for websites and web apps: the `rfr-web:web-engineer` agent, accessibility and performance audits, and the Vercel MCP guard.
- [`rfr-unreal`](../unreal/README.md) for Unreal Engine plugins: the `rfr-unreal:unreal-engineer` agent, Fab packaging, Unreal Insights profiling, and an editor `-ExecCmds` check.

Nothing in `rfr-core` needs either; agents and skills that mention them say what to do when they are not installed.

## Agents

| Agent | Model, effort | Tools | Use for |
|---|---|---|---|
| `code-reviewer` | Opus, high | Read-only | Correctness and requirement gaps in a diff |
| `security-reviewer` | Opus, high | Read-only | Secrets, injection, authorization, dependencies, CI, migrations |
| `accessibility-reviewer` | Sonnet, medium | Read-only | WCAG 2.2 AA for web; editor and in-game accessibility for Unreal |
| `performance-reviewer` | Sonnet, medium | Read-only | Web budgets and queries; per-frame cost for Unreal |
| `check-runner` | Haiku 5.5, medium | Read-only | Runs named scanners, audits, builds, and tests and returns exit codes and key output verbatim |
| `citation-checker` | Haiku 5.5, medium | Read-only | Checks that each review finding's file, line, identifiers, and rule ID exist |
| `software-architect` | Opus 5.5, high | Read-only plus ADR files | Design choices before implementation; records significant decisions as ADRs |
| `ux-reviewer` (experimental) | Opus, medium | Read-only | Usability and interface design for Unreal Editor tools, general software (desktop, command-line, developer tools), and web pages and apps |
| `tech-lead` (experimental) | Opus, medium | Read-only | Sequenced slices with owners, acceptance criteria, and verification; checks delegated work against them |
| `test-change-reviewer` (experimental) | Opus, high | Read-only plus throwaway worktrees | Whether a pull request's changes to existing tests are justified: findings, approved reasons, and evidence from running the tests on old and new code; approves or refers each, from `review-pr` |

Reviewers report every finding in one format (severity, file and line, rule ID, failure scenario, fix) and leave filtering to a separate pass. Model and effort settings are starting points to be tuned by evals. `tech-lead` and `ux-reviewer` are experimental: they were added before any eval showed a benefit (recommendation R18) and will be kept or removed on the results. `software-architect` started the same way and is no longer experimental: in two rounds (October 2026, and the Fable 5.2 round of November 2026) design records written with it weighed alternatives and named what is hard to reverse more reliably than the main session alone, on both Opus and Sonnet main sessions. `tech-lead` showed no difference; see `PLAN.md`, Phase 8.

The three Haiku agents gather or run things and return text copied from tools. They never judge: the calling session decides whether a check is green, a finding is true, or a change can merge. Skills call them (`merge-when-green`, `review-pr`, and `security-audit` here, and the domain plugins' audit, profiling, and packaging skills); the implementation agents cannot, because subagents cannot start subagents. They are pinned to `claude-haiku-5-5`. The reasoning is in [the Haiku 5.5 research note](../../docs/research/notes/haiku_5_5_delegation.md).

## Skills

| Skill | Purpose | Invoked by |
|---|---|---|
| `/rfr-core:install-rules [profile \| pack ...]` | Copy rule packs into `.claude/rules/` (profiles: `web-app`, `static-site`, `unreal-plugin`, `general`) | User only |
| `/rfr-core:plan-feature` | Spec with user stories, acceptance criteria, scope, and verification plan | User or Claude |
| `/rfr-core:review-pr` | Parallel reviewer agents, then confirm or refute each finding, starting with the ones a reviewer inferred rather than observed | User or Claude |
| `/rfr-core:lookup-api` | Check an API against the installed version: an npm package's version, lock entry, declarations, and bundled docs, or each supported engine's headers | User or Claude |
| `/rfr-core:security-audit` | Scanners, entry points, agent tooling risks | User or Claude |
| `/rfr-core:write-adr` | One-page architecture decision record | User or Claude |
| `/rfr-core:release` | Version, changelog, verify, tag after confirmation | User only |
| `/rfr-core:merge-when-green <pr>` | Wait for CI without polling, confirm checks on the head commit, merge with a head-SHA guard, continue | User only |
| `/rfr-core:decisions [issue and answer]` | The decision queue: questions agents left for the project lead as `needs-lead` issues, each with options, a default, and the date it takes effect; apply answers and due defaults | User or Claude |

## Hooks

| Event | Hook | What it does | Rule |
|---|---|---|---|
| PreToolUse (Bash, PowerShell) | `guard-commands` | Refuses a shell command that writes to an existing test file, with a reason that asks for the Edit tool so `guard-test-edits` can check the change; asks before a shell command that moves or deletes one, or, when `testWeakening` is `defer`, lets it go ahead and tells the agent to name it in its report, for the pull request to decide (the rest of the command is still checked) (closing the gap where an agent edits a test through the shell instead of the Edit tool; includes PowerShell cmdlets, `\` paths, and Unreal test modules). It reads the command's write targets (redirections, `tee`, `sed -i`, `mv`, `cp`, `rm`, `git rm`, and paths a script passes to a file-writing call), so a test file that is only run, read, or named in text does not count, and a test file added on the current branch is new. Refuses snapshot updates (`vitest -u`, `jest -u`, `playwright --update-snapshots`) unless the command states its reason as `RFR_SNAPSHOT_REASON="..."`. Allows `rm -rf` of tracked files with no uncommitted changes, and tells the agent the `git checkout -- <path>` that restores them. Takes a snapshot of the working tree, then allows the command and tells the agent how to restore it, before a discard (`git checkout -- .`, `git restore .`, `git reset --hard`, `git clean -f`) or an `rm -rf` inside the repository that would lose uncommitted changes or untracked files (no snapshot is needed inside an agent's own worktree under `.claude/worktrees/`, or when nothing would be lost), and keeps the stash commits before `git stash drop` or `clear`; it asks if the snapshot fails (guard tiers AC-11, [practices/guards.md](../../practices/guards.md#snapshots)). These patterns match only what the command line runs, so a script that only mentions a command (in a Python or `cat` heredoc) does not ask. Asks before other `rm -rf` or `Remove-Item -Recurse -Force` (unless everything `rm -rf` deletes is untracked and ignored by git, such as `dist/`, not there, or at least two levels inside the temp directory and in no git repository, including through a variable set earlier in the same command; outside the repository, of a root-like path, a glob, or an unknown variable), force-push, `git branch -D`, history rewrites, `--no-verify`, `git config --global`/`--system`, `drizzle-kit push` or `--force`, `prisma migrate dev/reset`, and `prisma db push/migrate` | WA-003 |
| PreToolUse (Edit, Write) | `guard-test-edits` | Checks each edit to an existing test file (one that existed where the branch started) and lets additive and neutral edits through: new tests, assertions, cases, or fixture data; renames, import paths, types, formatting, comments. It asks when an edit weakens a test (a removed test or assertion, a skip, a looser matcher, a changed expected value, a mock of the code under test, and others) unless a spec lists the file under `unlocks` with a criterion ID, and when it cannot read the change; with `testWeakening` set to `defer`, it lets the edit go ahead without asking, tells the agent to name it in its report, and the pull request's test-change review decides. It judges the edit against the file as it was where the branch started, so changing lines the branch added does not ask, and a weakening approved earlier is not asked about again. New test files, and test files added on the current branch, are allowed | TEST-001 |
| PreToolUse (Edit, Write) | `guard-owned-paths` | When `AGENTS.md` has a `## Owned paths` list, refuses an edit to a file in the project that is not on it, with the next step (use the public interface, or report the missing one); does nothing otherwise | #47 |
| PostToolUse (Edit, Write), Stop, SubagentStop | `format-on-edit` | After each edit, notes the edited file in a per-session list in the OS temp directory and leaves the file alone. When the turn (or a subagent) ends, runs the project's Prettier (from `node_modules/.bin`) or `clang-format` (when a `.clang-format` file exists) once on each noted file, then clears the list; does nothing otherwise and never keeps Claude from stopping | |

A guard asks only about actions that cannot be undone or reach outside the project; each question names the action, why a person must decide, and what the agent does if not approved. Other problems are refused with a next step the agent can take itself. In headless runs (`claude -p`) a request for approval counts as a denial.

A project sets `testWeakening` in `.claude/rfr.json` to `ask` (the default) or `defer`; see [practices/guards.md](../../practices/guards.md#project-settings).

Each ask or refusal is appended to `guard-decisions.jsonl` in the data folder of the plugin whose guard made it (`CLAUDE_PLUGIN_DATA`, or `rfr-core/` in the temp directory): the time, session, hook, tool, decision, and the first 200 characters of the reason, never the command or file contents. When an asked call then runs, `guard-outcome` (PostToolUse and PostToolUseFailure) adds an `approved` line; Claude Code reports nothing when a prompt is declined, so an ask without one was declined or never reached. `node checks/guard-report.mjs <log>...` in a rules-for-robots checkout summarises one or more logs (one per plugin). Set `RFR_GUARD_LOG=0` to turn it off.

Every guard decision, its tier, and why it sits there are listed in [practices/guards.md](../../practices/guards.md).

Hooks run with Node. If `node` is not on the PATH, the hooks fail open with a warning and nothing is guarded.
