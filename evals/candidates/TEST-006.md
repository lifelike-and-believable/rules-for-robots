---
id: TEST-006
title: Find the existing tests before saying there are none
level: SHOULD
scope: core
verified-by: [review]
targets-failure: unverified-claim
observed-on: []
rationale: Agents said no test harness existed when one sat one directory over, or created a new test module the reviewer had not approved (rules-for-robots#52).
sources: ["practices/testing-and-code-quality.md"]
---
Before you say code has no tests, search for the tests that cover it: the verify and test scripts, and folders such as `test`, `tests`, `spec`, and `__tests__` across the repository. Add tests where the existing ones live and follow their naming and runner. If none exist, ask before creating a new test module or adding a test framework.
