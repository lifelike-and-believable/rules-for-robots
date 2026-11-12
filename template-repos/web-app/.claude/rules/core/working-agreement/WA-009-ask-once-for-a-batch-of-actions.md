---
id: WA-009
title: Ask once for a batch of actions
level: SHOULD
scope: core
verified-by: [review]
targets-failure: approval-fatigue
observed-on: []
rationale: A permission prompt on every file or command teaches people to approve without reading, so the prompts that matter lose their force.
sources: ["practices/security-for-agentic-projects.md", "docs/specs/task-approval.md", "docs/specs/default-allow.md", "https://code.claude.com/docs/en/best-practices", "https://code.claude.com/docs/en/permission-modes"]
---
Ask for decisions and tasks, never for commands. Once the person has agreed the plan or design, carry it out, merging each pull request when its checks pass.

Ask in chat only for a decision or an action WA-003 lists, once, naming what it covers: "release 5.8.2: tag, push the tag, publish". Their reply approves those commands.

When work reaches something only the person can review, report it in chat and carry on. Never trigger a permission prompt to get a review.

Write plain single commands, and change files with the edit tools. If the project sets `"permissions": "ask"`, name the one change that covers a batch of prompts: accept-edits mode, `/add-dir`, or allow rules in `.claude/settings.local.json`.
