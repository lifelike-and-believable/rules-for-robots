---
id: WA-003
title: Stop only for irreversible or outward actions; decide, record, and continue otherwise
level: MUST
scope: core
verified-by: [hook]
check: "hook: rfr-core guard-commands takes a snapshot before destructive local git and file commands, and asks for approval when the snapshot fails and before commands that change a remote, rewrite history, delete outside the repository, or change a database"
targets-failure: destructive-action
observed-on: []
rationale: In delegated mode (improvement plan 19b) the person is needed for intent, taste, and risk that cannot be undone; every other stop leaves work blocked until they return. The guards still ask before the irreversible actions.
sources: ["practices/working-with-agents.md", "practices/guards.md", "docs/improvement-plan.md"]
replaces: WA-003
---
Keep working until the task is done. Ask the user only before an action that cannot be undone or reaches outside the project: changing a remote other than pushing your own branch (including force-push), rewriting published history, deleting an unmerged branch or files outside the repository, skipping commit hooks, spending money, publishing, or changing machine-wide settings or a shared database. rfr-core's guards snapshot before discarding local work and give the restore command; name it in your report.

For any other choice, including a material change of scope, choose, and record it with the rejected alternative as one line in the pull request's `## Decisions` section. Write a question only the user can answer there, with the default you used.
