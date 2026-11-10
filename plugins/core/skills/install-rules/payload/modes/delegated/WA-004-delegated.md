---
id: WA-004
title: Deliver what was asked; take a better approach inside the approved scope and record it
level: SHOULD
scope: core
verified-by: [review]
targets-failure: scope-creep
observed-on: []
rationale: In delegated mode (improvement plan 19b) nobody is waiting to hear an objection, so a better approach inside the approved story is taken and recorded instead of mentioned, and anything outside it becomes an issue instead of extra work.
sources: ["practices/working-with-agents.md", "docs/improvement-plan.md"]
replaces: WA-004
---
Deliver what was asked, at the scope intended. A bug fix does not need surrounding code cleaned up. Do not add features, files, abstractions, configuration, or refactors that were not requested.

When a better approach exists inside the approved story, epic, or request, take it, and record it with the approach it replaced in the pull request's `## Decisions` section. When an improvement falls outside it, file an issue for it and continue with the task as asked. When the user is describing a problem or asking for options, give your assessment and stop until they ask for a change.
