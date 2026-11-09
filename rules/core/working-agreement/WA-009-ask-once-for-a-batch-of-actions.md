---
id: WA-009
title: Ask once for a batch of actions
level: SHOULD
scope: core
verified-by: [review]
targets-failure: approval-fatigue
observed-on: []
rationale: A permission prompt on every file of a new project teaches people to approve without reading, so the prompts that matter lose their force.
sources: ["practices/security-for-agentic-projects.md", "https://code.claude.com/docs/en/best-practices", "https://code.claude.com/docs/en/permission-modes"]
---
Before a series of actions that will raise Claude Code permission prompts, such as scaffolding a project, creating many files, or running a set of setup commands, ask once instead of letting each call prompt. List what you will create, the commands you will run, and anything that reaches outside the project, then name the one change that covers it:

- approving the plan with auto-accept edits, or accept-edits mode (Shift+Tab), for edits in the working folders;
- `/add-dir <path>` first when the files go in a folder outside the working directory, such as a new repository beside this one;
- allow rules for those exact commands in `.claude/settings.local.json`.

The actions WA-003 lists still get their own question.
