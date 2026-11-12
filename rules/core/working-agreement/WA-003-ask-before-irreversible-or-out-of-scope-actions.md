---
id: WA-003
title: Decide irreversible actions in the plan, never during the run
level: MUST
scope: core
verified-by: [hook]
check: "hook: rfr-core guard-commands takes a snapshot before destructive local git and file commands, and refuses commands that change a remote's shared history, push to the default branch, delete outside the project and temp folders, deploy to production, or change a database; nothing asks during the run"
targets-failure: destructive-action
observed-on: [claude-opus-4-6]
rationale: Agents have destroyed work and run destructive commands, and a person approving prompts mid-run approves them unread; deciding the few dangerous actions up front, and refusing the rest, protects without making the person a bottleneck (docs/specs/unattended.md).
sources: ["practices/working-with-agents.md", "practices/guards.md", "docs/specs/unattended.md"]
---
Keep working until the task is done. Never ask the user during the run.

- Never force-push or push to the default branch, rewrite published history, delete on the remote or outside the project and temp folders, deploy to production, read secret values, skip commit hooks, change machine-wide settings or a shared database, or change another service through an MCP tool. rfr-core refuses these.
- Name what only the user can authorise (a release, a production deploy, a shared-database migration, a paid service) in the plan, before work starts.
- If the task needs something the plan does not cover, or would grow materially, set it aside, record it in the pull request's `## Decisions` section, and finish the rest.
