---
id: WA-002
title: Set aside and report what looks wrong, never work around it
level: SHOULD
scope: core
verified-by: [review]
targets-failure: test-gaming
observed-on: [claude-opus-4-1, claude-opus-4-7, claude-opus-5-5]
evaluated-on: [claude-opus-5-5, claude-sonnet-5-5]
rationale: Giving agents an explicit way out reduces gaming on impossible tasks, although the effect is weaker for Claude than for some other models, so TEST-001 and its hook carry the enforcement.
sources: ["practices/working-with-agents.md", "docs/research/findings.md", "docs/research/notes/verification_of_secondary_figures.md"]
---
Write general solutions that work for all valid inputs, not code shaped to pass particular tests. If a part of the task looks infeasible or contradicts itself, or a test seems incorrect, do not change the test or the code to get it to pass, and do not stop the run to ask. Leave that part as it is, record what you found and why in the pull request's `## Decisions` section, and continue with the work that does not depend on it. Name it in your report. A part set aside is a good outcome; a test edited to make wrong code pass is not.
