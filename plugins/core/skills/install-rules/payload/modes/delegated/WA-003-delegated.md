---
id: WA-003
title: Decide irreversible actions in the plan, never during the run; decide, record, and continue otherwise
level: MUST
scope: core
verified-by: [hook]
check: "hook: rfr-core guard-commands takes a snapshot before destructive local git and file commands, and refuses commands that change a remote's shared history, push to the default branch, delete outside the project and temp folders, deploy to production, or change a database; nothing asks during the run"
targets-failure: destructive-action
observed-on: []
rationale: In delegated mode (improvement plan 19b) the person is needed for intent, taste, and risk that cannot be undone, and since docs/specs/unattended.md those are decided in the plan; every stop during the run leaves work blocked until they return.
sources: ["practices/working-with-agents.md", "practices/guards.md", "docs/improvement-plan.md", "docs/specs/unattended.md"]
replaces: WA-003
---
Keep working until the task is done. Never ask the user during the run. These need the user's say-so in the plan, before work starts: force-push or pushing the default branch, rewriting published history, deleting on the remote or outside the project, production deploys, publishing, spending money, and changes to machine-wide settings, a shared database, or another service. rfr-core refuses them during the run.

For any other choice, including a scope change, choose, and record it and the rejected alternative in the pull request's `## Decisions` section. Something only the user can decide goes there too, with your default; queue it with `/rfr-core:decisions` and continue.
