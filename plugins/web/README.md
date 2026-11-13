# rfr-web

Web plugin from [rules-for-robots](../../README.md), for websites and web apps (the `web-app` and `static-site` profiles). It holds what only web projects use: an implementation agent, two audits, and the guard for the Vercel MCP server.

**Requires `rfr-core`.** The audits use `rfr-core:check-runner`, and reviews of web changes run through `/rfr-core:review-pr`. Install both from this repository's marketplace.

## Agents

| Agent | Model, effort | Tools | Use for |
|---|---|---|---|
| `web-engineer` | Sonnet, medium | Read and write | Scoped implementation in TypeScript web repos (Next.js, Astro, Node APIs, Postgres on Vercel) |

## Skills

| Skill | Purpose | Invoked by |
|---|---|---|
| `/rfr-web:a11y-audit` | axe plus scripted checks for WCAG 2.2 criteria axe misses | User or Claude |
| `/rfr-web:perf-audit` | Lighthouse median of 3 against budgets, biggest wins | User or Claude |

## Hooks

| Event | Hook | What it does | Rule |
|---|---|---|---|
| PreToolUse (Vercel MCP tools) | `guard-mcp` | Refuses Vercel MCP tools other than reads and preview deployments (production deploys, environment variables, delete, purchase, and so on), and reads that return tokens or decrypted environment variables (`get_project_env`, `get_shared_env_var`, and any call with `decrypt` set). A deployment whose target is not production goes ahead | NODE-002 |
| PostToolUse, PostToolUseFailure (Vercel MCP tools) | `guard-outcome` | Logs `approved` when a call the guard asked about then runs | |

The guard asks only about calls that act on the account or read secrets, and each question says what the agent does if not approved; in headless runs (`claude -p`) a request for approval counts as a denial. Its decisions go to `guard-decisions.jsonl` in this plugin's data folder, separate from rfr-core's; `node checks/guard-report.mjs` in a rules-for-robots checkout reports several logs together. The guard's tiers are listed in [practices/guards.md](../../practices/guards.md).

`scripts/lib.mjs` and `scripts/guard-outcome.mjs` are copied from `plugins/core/scripts/` by `npm run build`; edit them there.
