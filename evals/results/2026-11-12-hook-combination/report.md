# How Claude Code combines several hooks' decisions (2026-11-12)

The check for default-allow AC-3. Default allow relies on one rfr-core hook returning `allow` while rfr's guards return `ask` or `deny` on the same call, so the question was which one wins. Claude Code's documentation does not say.

**Result: the more restrictive decision wins, whatever the order. Default allow can rely on the guards.**

## Method

`evals/hook-combination/run.mjs` makes a scratch project for each pair of decisions. Its `.claude/settings.json` registers two PreToolUse hooks on Bash, each `evals/hook-combination/decide.mjs <decision>`. The script runs `claude -p` once on Haiku, asking for one harmless command that writes a marker file. "Ran" means the marker file exists. In a headless run, a call that would prompt is denied, so a denial stands for "the person would have been asked", and the denial message says which.

- Claude Code 2.1.322, Windows 11.
- Cost: $0.11 for 9 runs.

## Results

| Hooks | Mode | Ran | What Claude Code reported |
|---|---|---|---|
| allow, none | default | yes | ran |
| none, none | default | no | "This command requires approval" (would prompt) |
| allow, ask | default | no | the ask hook's reason ("test hook: ask"): asked |
| ask, allow | default | no | the ask hook's reason: asked |
| allow, deny | default | no | blocked by the deny hook's reason |
| ask, none | default | no | the ask hook's reason: asked |
| allow, none | auto | yes | ran |
| allow, ask | auto | no | the ask hook's reason: asked |
| allow, deny | auto | no | blocked by the deny hook |

The raw results are in `default-mode.json` and `auto-mode.json` (temp paths replaced with `<tmp>`).

## What it means

- A hook's `allow` skips the prompt (allow, none ran in both modes).
- Another hook's `ask` on the same call wins over the `allow`, in either order: the person is asked. Headless, that is a denial.
- Another hook's `deny` wins over the `allow`.

So rfr-core's default-allow hook can allow the agent's working tools, and `guard-commands`, `guard-test-edits`, `guard-owned-paths`, rfr-process's merge guard, and rfr-web's Vercel guard still ask or refuse where they must. Rerun this check when Claude Code changes its hook handling: `CLAUDE_BIN=<path to claude> node evals/hook-combination/run.mjs <out.json>`, with `MODE=auto` for the auto-mode cases.
