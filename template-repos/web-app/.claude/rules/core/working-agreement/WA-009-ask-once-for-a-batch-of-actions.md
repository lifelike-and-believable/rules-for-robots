---
id: WA-009
title: Ask once for a batch of actions
level: SHOULD
scope: core
verified-by: [review]
targets-failure: approval-fatigue
observed-on: []
rationale: A permission prompt on every file or command teaches people to approve without reading, so the prompts that matter lose their force.
sources: ["practices/security-for-agentic-projects.md", "docs/specs/task-approval.md", "https://code.claude.com/docs/en/best-practices", "https://code.claude.com/docs/en/permission-modes"]
---
Ask for tasks, not commands. When a task needs the person's decision, ask once in chat and name what it covers, for example "release 5.8.2: tag, push the tag, publish". Their reply naming the task approves its release, push, merge, or preview-deploy commands; do not ask again per command.

Before a series of edits or setup commands that will prompt, list them and name the one change that covers them:

- auto-accept edits, or accept-edits mode (Shift+Tab), for edits in the working folders;
- `/add-dir <path>` first for files outside the working directory;
- allow rules for those exact commands in `.claude/settings.local.json`.

Write plain single commands so rules can match them. The actions WA-003 lists still get their own question.
