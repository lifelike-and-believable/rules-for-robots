---
id: TEST-004c
title: Develop new behaviour test first, in clusters
level: SHOULD
scope: core
verified-by: [review]
targets-failure: unverified-claim
observed-on: []
rationale: Drafting a cluster of related tests together, with stubs so each fails on its assertion, is often more effective with agents than one test at a time; the evals compare it with TEST-004 (Phase 10, docs/specs/spec-test-traceability.md).
sources: ["practices/testing-and-code-quality.md", "docs/specs/spec-test-traceability.md"]
replaces: TEST-004
---
Work test-driven when adding or changing behaviour that a test can express. Draft the tests for one group of related behaviours together. Add stubs for new modules and signatures first, so each test fails on its assertion and not on a missing import. Run the cluster and confirm each test fails for the expected reason, then write the least code that makes the cluster pass, in small steps, and refactor with the tests green. Include the red and green runs in your report.

Skip test-first for exploratory spikes, purely visual or layout changes, and configuration; say so in your report when you do.
