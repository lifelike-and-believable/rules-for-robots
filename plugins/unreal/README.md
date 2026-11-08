# rfr-unreal

Unreal Engine plugin from [rules-for-robots](../../README.md), for Unreal Engine 5.6+ code plugins (the `unreal-plugin` profile). It holds what only Unreal projects use: an implementation agent, Fab packaging and Unreal Insights profiling skills, and a check on editor command lines.

**Requires `rfr-core`.** The packaging skill uses `rfr-core:check-runner`, and reviews of Unreal changes run through `/rfr-core:review-pr`. Install both from this repository's marketplace.

## Agents

| Agent | Model, effort | Tools | Use for |
|---|---|---|---|
| `unreal-engineer` | Opus, medium | Read and write | Scoped implementation in Unreal 5.6+ plugins |

## Skills

| Skill | Purpose | Invoked by |
|---|---|---|
| `/rfr-unreal:profile-unreal-plugin` | Unreal Insights capture and analysis | User or Claude |
| `/rfr-unreal:package-unreal-plugin` | Fab packages per engine version | User only |

## Hooks

| Event | Hook | What it does | Rule |
|---|---|---|---|
| PreToolUse (Bash, PowerShell) | `guard-unreal` | Refuses an `UnrealEditor` command whose `-ExecCmds` list does not end with `Quit`, and tells the agent to add `;Quit`, which would leave the editor running after its commands finish (#56) | Unreal practice guide |
| PostToolUse, PostToolUseFailure (Bash, PowerShell) | `guard-outcome` | Logs `approved` when a command the guard asked about then runs | |

The guard refuses with the fix rather than asking a person, so headless runs (`claude -p`) can carry on. Its decisions go to `guard-decisions.jsonl` in this plugin's data folder, separate from rfr-core's; `node checks/guard-report.mjs` in a rules-for-robots checkout reports several logs together. The guard's tier is listed in [practices/guards.md](../../practices/guards.md).

`scripts/lib.mjs` and `scripts/guard-outcome.mjs` are copied from `plugins/core/scripts/` by `npm run build`; edit them there.
