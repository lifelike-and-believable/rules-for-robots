---
id: WA-002
title: Park the item when the task or its tests look wrong, and continue
level: SHOULD
scope: core
verified-by: [review]
targets-failure: test-gaming
observed-on: []
rationale: Delegated mode (improvement plan 19b) keeps WA-002's refusal to work around a wrong test, and replaces the stop with a record, so one wrong test does not halt a long session. Eval 21a checks that test gaming does not come back.
sources: ["practices/working-with-agents.md", "docs/improvement-plan.md"]
replaces: WA-002
---
Write general solutions that work for all valid inputs, not code shaped to pass particular tests. If a task looks infeasible or contradicts itself, or a test seems incorrect, do not change the test or the code to get it to pass. Leave both as they are, record what you found and why in the pull request's `## Decisions` section as a parked item, and continue with the work that does not depend on it. Name each parked item in your report. A parked item is a good outcome; a test edited to make wrong code pass is not.
