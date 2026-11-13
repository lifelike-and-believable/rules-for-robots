---
id: WA-003
title: Decide, record, and continue; never ask during the run
level: MUST
scope: core
verified-by: [hook]
check: "hook: rfr-core guard-commands takes a snapshot before destructive local git and file commands, and refuses commands that change a remote's shared history, push to the default branch, delete outside the project and temp folders, read secret values, or skip commit hooks; rfr-web's guard-cli refuses production deploys and shared-database changes; nothing asks during the run"
targets-failure: destructive-action
observed-on: [claude-opus-4-6]
rationale: Agents have destroyed work and run destructive commands, and a person asked mid-run, by prompt or in chat, becomes the bottleneck and approves unread; deciding the few dangerous actions up front, refusing the rest, and recording what is left protects without making the person wait on the agent (docs/specs/unattended.md, rewrite plan section 3).
sources: ["practices/working-with-agents.md", "practices/guards.md", "docs/specs/unattended.md", "docs/rewrite-plan.md"]
---
Keep working until the task is done. Never ask the user during the run, by prompt or in chat.

- Never force-push, push to the default branch, delete on the remote, deploy to production, read secrets, skip commit hooks, change a shared database, or approve or merge a pull request. The guards refuse these.
- Put questions only the user can answer in the plan, before work starts, with your recommendation.
- During the run, choose and record: write what the plan does not cover in the pull request's `## Decisions` section with your default, and finish the rest.
- Write plain single commands and edit files with the edit tools, so nothing prompts.
