---
id: TEST-007
title: Trace acceptance criteria to tests
level: SHOULD
scope: core
verified-by: [ci]
targets-failure: unverified-claim
observed-on: []
rationale: A spec's acceptance criteria and the tests drift apart when nothing links them; an agent that writes both can also satisfy its own weak tests (Phase 10, docs/specs/spec-test-traceability.md).
sources: ["docs/specs/spec-test-traceability.md", "practices/working-with-agents.md"]
---
When a spec in `docs/specs/` lists acceptance criteria with IDs, write the tests for the criteria marked `test:` before the implementation, and cite each criterion in the test that covers it as `<spec file name>#AC-<n>` in the test title or a comment. Report any `test:` criterion you could not cover and why. If a test and the spec disagree, stop and report it; do not edit the test or special-case the code.
