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

Reviewers report every finding in one format (severity, file and line, rule ID, failure scenario, fix) and leave filtering to a separate pass. Model and effort settings are starting points to be tuned by evals.

## Skills

| Skill | Purpose | Invoked by |
|---|---|---|
| `/rfr-core:install-rules [profile \| pack ...]` | Copy rule packs into `.claude/rules/` (profiles: `web-app`, `static-site`, `unreal-plugin`) | User only |
| `/rfr-core:plan-feature` | Spec with user stories, acceptance criteria, scope, and verification plan | User or Claude |
| `/rfr-core:review-pr` | Parallel reviewer agents, then confirm or refute each finding | User or Claude |
| `/rfr-core:a11y-audit` | axe plus scripted checks for WCAG 2.2 criteria axe misses | User or Claude |
| `/rfr-core:perf-audit` | Lighthouse median of 3 against budgets, biggest wins | User or Claude |
| `/rfr-core:security-audit` | Scanners, entry points, agent tooling risks | User or Claude |
| `/rfr-core:write-adr` | One-page architecture decision record | User or Claude |
| `/rfr-core:release` | Version, changelog, verify, tag after confirmation | User only |
| `/rfr-core:profile-unreal-plugin` | Unreal Insights capture and analysis | User or Claude |
| `/rfr-core:package-unreal-plugin` | Fab packages per engine version | User only |

## Hooks

| Event | Hook | What it does | Rule |
|---|---|---|---|
| PreToolUse (Bash, PowerShell) | `guard-commands` | Asks before shell commands that write to, move, or delete test files (closing the gap where an agent edits a test through the shell instead of the Edit tool; includes PowerShell cmdlets, `\` paths, and Unreal test modules), and before `rm -rf` or `Remove-Item -Recurse -Force`, `git reset --hard`, `git clean -f`, discarding all changes, force-push, `git branch -D`, dropping stashes, history rewrites, `--no-verify`, `git config --global`/`--system`, `drizzle-kit push` or `--force`, `prisma migrate dev/reset`, and `prisma db push/migrate` | WA-003 |
| PreToolUse (Edit, Write) | `guard-test-edits` | Asks before changing an existing test file; new test files are allowed | TEST-001 |
| PreToolUse (Vercel MCP tools) | `guard-mcp` | Asks before Vercel MCP tools other than reads (deploy, environment variables, decrypt, delete, purchase, and so on) and before reads that return tokens | NODE-002 |
| PostToolUse (Edit, Write) | `format-on-edit` | Runs the project's Prettier (from `node_modules/.bin`) or `clang-format` (when a `.clang-format` file exists) on the edited file; does nothing otherwise | |

The guards ask rather than block outright, so you can approve a command you intend. In headless runs (`claude -p`) a request for approval counts as a denial.

Hooks run with Node. If `node` is not on the PATH, the hooks fail open with a warning and nothing is guarded.
