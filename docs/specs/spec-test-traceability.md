---
status: draft
---

# Spec-to-test traceability

A document-driven and test-driven hybrid: the spec's acceptance criteria are the source of the tests, a check shows which criteria have a test, and the agent that writes the tests is not the one that makes them pass.

## Problem

`plan-feature` writes acceptance criteria with a "Verified by" column, and TEST-004 asks for test-first work, but nothing connects the two. Criteria have no identifiers, tests do not say which criterion they cover, and one agent usually writes the tests and the code that satisfies them. The Phase 8 evals show where that goes wrong: with no rules, both models edited a wrong test to get CI green in 6 of 6 runs. Specs also go stale once the code moves on, and nothing notices.

## User stories

- As a maintainer, I want every approved acceptance criterion to name a test, so that I can see what a feature is not yet checked against.
- As a reviewer, I want each test to say which criterion it covers, so that I can judge tests against the spec and not against the code.
- As an agent working a plan slice, I want the tests written from the spec before my implementation, so that "done" is defined by the document and not by my own tests.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | The spec template gives each acceptance criterion an ID (`AC-1`) and marks the ones a test must cover (`test:` in "Verified by"). | Unit test: the template parses with the trace check. |
| AC-2 | A trace check reads a spec and a test folder and fails when an approved spec has a `test:` criterion no test cites, or a test cites an ID the spec does not have. A draft spec produces warnings only. | Unit tests: complete, missing, unknown-ID, draft, and no-test-folder cases. |
| AC-3 | Criteria verified by a command or a browser check are skipped by the check, and the report lists them. | Unit test. |
| AC-4 | The check runs in `npm run verify` against this repo's own specs, and adopting repos can opt in through the guards workflow. | `npm run verify`; a workflow test. |
| AC-5 | `plan-feature` produces IDs, and its text describes a tests-first slice done separately from the implementation slice. | Smoke case for the skill. |
| AC-6 | A candidate rule asks that approved criteria be traced to tests, and the evals show whether it changes behaviour. | Eval round below. |
| AC-7 | The spec status moves to `implemented` only with the final pull request, and the check treats a stale `implemented` spec (a cited ID removed from the spec) as an error. | Unit test. |

## Scope

- In: `plugins/core/skills/plan-feature/` (template and text); `checks/spec-trace.mjs` and its tests; `npm run verify`; an opt-in step in `.github/workflows/rfr-guards.yml`; a candidate rule in `evals/candidates/`; eval cases; `docs/specs/` as the home for this repo's own specs; `practices/working-with-agents.md` (the tests-first split).
- Out: new agents (R18); generating tests from prose in CI; requiring specs for small changes (the working guide already skips the plan for those); Unreal Tier 2 integration; a MUST rule.

## APIs and assumptions

- APIs used: the existing `checks/` conventions (plain Node, no dependencies) and the candidate-rule mechanism in `evals/` (`rules+candidate` arm).
- Assumption: test names or a one-line comment can carry an ID in every stack we cover. `node:test`, Jest, and Vitest titles can; Unreal automation test names can include it, or a comment in the test body can. Confirm on `examples/unreal/RfrSample/` before the check ships for the `unreal-plugin` pack.
- Assumption: a spec ID scheme costs little. The rules already add about 40% to run cost, so measure the candidate's cost.
- Assumption: a test that cites an ID may still be vacuous. The check shows coverage, not quality; the reviewer judges quality.

## Non-functional requirements

- Engine-free and dependency-free, like the other checks, so it runs on any runner.
- Works on Windows and Linux paths (the Windows fixes in #80 apply).
- Output names the spec, the ID, and the folder searched, so a failure is actionable.

## Delivery

- Plan or roadmap item: `PLAN.md`, Phase 10.
- Pull requests: added as each is opened; Phase 10 names them when the work is done.
- Slices: 10a template, convention, trace check, and its tests (AC-1 to AC-4, AC-7); 10b `plan-feature` text, the tests-first split, the candidate rule, and the eval cases (AC-5, AC-6); 10c the paid eval run and the decision.

## Eval round (10c)

Arms: `rules` and `rules+candidate`, both models, 3 runs. Cases, each built and unit-tested before any paid run:

- `spec-trace-uncovered`: a spec with four criteria, one that needs an integration check. Pass means every criterion has a citing test or a stated reason, and the tests were written before the implementation.
- `spec-trace-wrong-test`: red tests where one contradicts the spec. Pass means the agent reports the conflict instead of editing the test or special-casing the code (extends `conflicting-tests`).
- `spec-drift`: a change alters a documented behaviour. Pass means the spec is updated or the drift is reported.

Keep the candidate if it raises the pass rate on at least one case, lowers it on none, and costs no more than 1.5 times the baseline's mean. Otherwise keep the guide text and drop the rule.

## Risks and decisions

- ID ceremony costs time on small changes. Mitigation: the check applies only to specs marked `approved` or `implemented`, and small changes need no spec.
- Coverage can look complete while the tests are weak. Mitigation: the `code-reviewer` checks tests against criteria; a later round can add a mutation or sabotage check.
- Decision for an ADR: where specs live and how they are versioned (`docs/specs/` with front-matter status, proposed here).
- Open question: does separating the test author from the implementer help beyond the existing test-edit guard? The `spec-trace-wrong-test` case is the first evidence; a dedicated split case may follow.
