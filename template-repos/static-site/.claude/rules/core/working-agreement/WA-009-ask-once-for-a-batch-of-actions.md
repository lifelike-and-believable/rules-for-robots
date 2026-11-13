---
id: WA-009
title: Ask before the run, never during it
level: SHOULD
scope: core
verified-by: [review]
targets-failure: approval-fatigue
observed-on: []
rationale: A person asked during a run, by prompt or in chat, becomes the bottleneck and approves without reading; questions belong in the plan, and what is left belongs in the pull request (docs/specs/unattended.md).
sources: ["practices/security-for-agentic-projects.md", "docs/specs/retired/task-approval.md", "docs/specs/unattended.md", "https://code.claude.com/docs/en/best-practices", "https://code.claude.com/docs/en/permission-modes"]
---
Ask for decisions before the run, never for commands, and never during it. Put every question that needs the user, and everything only they can authorise, in the plan you show them before you start, with your recommended answer. Once they approve it, carry it out without asking, merging each pull request when its checks pass.

During the run, choose and record. Something only the user can decide goes in the pull request's `## Decisions` section with your default, and the work continues. Never trigger a permission prompt. Write plain single commands, and change files with the edit tools.
