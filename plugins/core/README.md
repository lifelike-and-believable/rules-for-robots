# rfr-core

Core plugin from [rules-for-robots](../../README.md).

## Skills

- `/rfr-core:install-rules [profile | pack ...]` copies rule packs into the current repo's `.claude/rules/`. Profiles: `web-app`, `static-site`, `unreal-plugin`.

## Hooks

| Event | Hook | What it does | Rule |
|---|---|---|---|
| PreToolUse (Bash) | `guard-commands` | Asks before `rm -rf`, `git reset --hard`, `git clean -f`, discarding all changes, force-push, `git branch -D`, dropping stashes, history rewrites, `--no-verify`, `drizzle-kit push` or `--force`, `prisma migrate dev/reset`, and `prisma db push/migrate` | WA-003 |
| PreToolUse (Edit, Write) | `guard-test-edits` | Asks before changing an existing test file; new test files are allowed | TEST-001 |
| PostToolUse (Edit, Write) | `format-on-edit` | Runs the project's Prettier (from `node_modules/.bin`) or `clang-format` (when a `.clang-format` file exists) on the edited file; does nothing otherwise | |

The guards ask rather than block outright, so you can approve a command you intend. In headless runs (`claude -p`) a request for approval counts as a denial.

Hooks run with Node. If `node` is not on the PATH, the hooks fail open with a warning and nothing is guarded.
