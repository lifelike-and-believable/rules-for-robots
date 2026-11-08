# rfr-core

Core plugin from [rules-for-robots](../../README.md).

## Agents

| Agent | Model, effort | Tools | Use for |
|---|---|---|---|
| `web-engineer` | Sonnet, medium | Read and write | Scoped implementation in TypeScript web repos |
| `unreal-engineer` | Opus, medium | Read and write | Scoped implementation in Unreal 5.6+ plugins |
| `code-reviewer` | Opus, high | Read-only | Correctness and requirement gaps in a diff |
| `security-reviewer` | Opus, high | Read-only | Secrets, injection, authorization, dependencies, CI, migrations |
| `accessibility-reviewer` | Sonnet, medium | Read-only | WCAG 2.2 AA for web; editor and in-game accessibility for Unreal |
| `performance-reviewer` | Sonnet, medium | Read-only | Web budgets and queries; per-frame cost for Unreal |
| `check-runner` | Haiku 5.5, medium | Read-only | Runs named scanners, audits, builds, and tests and returns exit codes and key output verbatim |
| `citation-checker` | Haiku 5.5, medium | Read-only | Checks that each review finding's file, line, identifiers, and rule ID exist |
| `software-architect` (experimental) | Fable 5.1, high | Read-only plus ADR files | Design choices before implementation; records significant decisions as ADRs |
| `ux-reviewer` (experimental) | Opus, medium | Read-only | Usability and interface design for Unreal Editor tools, general software (desktop, command-line, developer tools), and web pages and apps |
| `tech-lead` (experimental) | Opus, medium | Read-only | Sequenced slices with owners, acceptance criteria, and verification; checks delegated work against them |
| `test-change-reviewer` (experimental) | Opus, high | Read-only plus throwaway worktrees | Whether a pull request's changes to existing tests are justified: findings, approved reasons, and evidence from running the tests on old and new code; approves or refers each, from `review-pr` |

Reviewers report every finding in one format (severity, file and line, rule ID, failure scenario, fix) and leave filtering to a separate pass. Model and effort settings are starting points to be tuned by evals. `software-architect`, `tech-lead`, and `ux-reviewer` are experimental: they were added before any eval showed a benefit (recommendation R18) and will be kept or removed on the results.

The three Haiku agents gather or run things and return text copied from tools. They never judge: the calling session decides whether a check is green, a finding is true, or a change can merge. Skills call them (`merge-when-green`, `review-pr`, `security-audit`, `perf-audit`, `a11y-audit`, `package-unreal-plugin`); the implementation agents cannot, because subagents cannot start subagents. They are pinned to `claude-haiku-5-5`. The reasoning is in [the Haiku 5.5 research note](../../docs/research/notes/haiku_5_5_delegation.md).

## Skills

| Skill | Purpose | Invoked by |
|---|---|---|
| `/rfr-core:install-rules [profile \| pack ...]` | Copy rule packs into `.claude/rules/` (profiles: `web-app`, `static-site`, `unreal-plugin`) | User only |
| `/rfr-core:plan-feature` | Spec with user stories, acceptance criteria, scope, and verification plan | User or Claude |
| `/rfr-core:review-pr` | Parallel reviewer agents, then confirm or refute each finding, starting with the ones a reviewer inferred rather than observed | User or Claude |
| `/rfr-core:lookup-api` | Check an API against the installed version: an npm package's version, lock entry, declarations, and bundled docs, or each supported engine's headers | User or Claude |
| `/rfr-core:a11y-audit` | axe plus scripted checks for WCAG 2.2 criteria axe misses | User or Claude |
| `/rfr-core:perf-audit` | Lighthouse median of 3 against budgets, biggest wins | User or Claude |
| `/rfr-core:security-audit` | Scanners, entry points, agent tooling risks | User or Claude |
| `/rfr-core:write-adr` | One-page architecture decision record | User or Claude |
| `/rfr-core:release` | Version, changelog, verify, tag after confirmation | User only |
| `/rfr-core:merge-when-green <pr>` | Wait for CI without polling, confirm checks on the head commit, merge with a head-SHA guard, continue | User only |
| `/rfr-core:profile-unreal-plugin` | Unreal Insights capture and analysis | User or Claude |
| `/rfr-core:package-unreal-plugin` | Fab packages per engine version | User only |

## Hooks

| Event | Hook | What it does | Rule |
|---|---|---|---|
| PreToolUse (Bash, PowerShell) | `guard-commands` | Refuses a shell command that writes to an existing test file, with a reason that asks for the Edit tool so `guard-test-edits` can check the change; asks before a shell command that moves or deletes one (closing the gap where an agent edits a test through the shell instead of the Edit tool; includes PowerShell cmdlets, `\` paths, and Unreal test modules). It reads the command's write targets (redirections, `tee`, `sed -i`, `mv`, `cp`, `rm`, `git rm`, and paths a script passes to a file-writing call), so a test file that is only run, read, or named in text does not count, and a test file added on the current branch is new. Also asks before snapshot updates (`vitest -u`, `jest -u`, `playwright --update-snapshots`), and before `rm -rf` or `Remove-Item -Recurse -Force` (unless everything `rm -rf` deletes is untracked and ignored by git, such as `dist/`, not there, or at least two levels inside the temp directory and in no git repository, including through a variable set earlier in the same command), `git reset --hard`, `git clean -f`, or discarding all changes when there are uncommitted changes to lose (never inside an agent's own worktree under `.claude/worktrees/`; a `reset --hard` to another commit always asks), force-push, `git branch -D`, dropping stashes, history rewrites, `--no-verify`, `git config --global`/`--system`, `drizzle-kit push` or `--force`, `prisma migrate dev/reset`, and `prisma db push/migrate` | WA-003 |
| PreToolUse (Edit, Write) | `guard-test-edits` | Checks each edit to an existing test file (one that existed where the branch started) and lets additive and neutral edits through: new tests, assertions, cases, or fixture data; renames, import paths, types, formatting, comments. It asks when an edit weakens a test (a removed test or assertion, a skip, a looser matcher, a changed expected value, a mock of the code under test, and others) unless a spec lists the file under `unlocks` with a criterion ID, and when it cannot read the change. It judges the edit against the file as it was where the branch started, so changing lines the branch added does not ask, and a weakening approved earlier is not asked about again. New test files, and test files added on the current branch, are allowed | TEST-001 |
| PreToolUse (Edit, Write) | `guard-owned-paths` | When `AGENTS.md` has a `## Owned paths` list, asks before editing a file in the project that is not on it; does nothing otherwise | #47 |
| PreToolUse (Vercel MCP tools) | `guard-mcp` | Asks before Vercel MCP tools other than reads (deploy, environment variables, decrypt, delete, purchase, and so on) and before reads that return tokens or decrypted environment variables (`get_project_env`, `get_shared_env_var`, and any call with `decrypt` set) | NODE-002 |
| PostToolUse (Edit, Write), Stop, SubagentStop | `format-on-edit` | After each edit, notes the edited file in a per-session list in the OS temp directory and leaves the file alone. When the turn (or a subagent) ends, runs the project's Prettier (from `node_modules/.bin`) or `clang-format` (when a `.clang-format` file exists) once on each noted file, then clears the list; does nothing otherwise and never keeps Claude from stopping | |

The guards ask rather than block outright, so you can approve a command you intend. In headless runs (`claude -p`) a request for approval counts as a denial.

Each ask or refusal is appended to `guard-decisions.jsonl` in the plugin's data folder (`CLAUDE_PLUGIN_DATA`, or `rfr-core/` in the temp directory): the time, session, hook, tool, decision, and the first 200 characters of the reason, never the command or file contents. When an asked call then runs, `guard-outcome` (PostToolUse and PostToolUseFailure) adds an `approved` line; Claude Code reports nothing when a prompt is declined, so an ask without one was declined or never reached. `node checks/guard-report.mjs` in a rules-for-robots checkout summarises the log. Set `RFR_GUARD_LOG=0` to turn it off.

Every guard decision, its tier, and why it sits there are listed in [practices/guards.md](../../practices/guards.md).

Hooks run with Node. If `node` is not on the PATH, the hooks fail open with a warning and nothing is guarded.
