---
status: approved
tests-commit: 77f3846098d14c773f1c5c16157bc04d803cb56d
unlocks:
  - test/spec-lock.test.mjs: the repo() helper failed when the spec had no tests-commit (nothing to commit); the second commit may now be empty
---

# Spec-to-test traceability

A document-driven and test-driven hybrid: the spec's acceptance criteria are the source of the tests, a check shows which criteria have a test, and the agent that writes the tests is not the one that makes them pass.

## Problem

`plan-feature` writes acceptance criteria with a "Verified by" column, and TEST-004 asks for test-first work, but nothing connects the two. Criteria have no identifiers, tests do not say which criterion they cover, and one agent usually writes the tests and the code that satisfies them. The Phase 8 evals show where that goes wrong: with no rules, both models edited a wrong test to get CI green in 6 of 6 runs. Specs also go stale once the code moves on, and nothing notices.

## User stories

- As a maintainer, I want every approved acceptance criterion to name a test, so that I can see what a feature is not yet checked against.
- As a reviewer, I want each test to say which criterion it covers, so that I can judge tests against the spec and not against the code.
- As an agent working a plan slice, I want the tests written from the spec before my implementation, so that "done" is defined by the document and not by my own tests.
- As a maintainer, I want proof that the tests were fixed before the implementation began and not changed to fit it, so that I can trust "green" without reading every diff.
- As a reviewer, I want to see that a citing test fails when the behaviour it covers is broken, so that a vacuous test does not count as coverage.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | The spec template gives each acceptance criterion an ID (`AC-1`) and marks the ones a test must cover (`test:` in "Verified by"). | test: the template parses with the trace check; IDs are unique. |
| AC-2 | A trace check reads a spec and a test folder and fails when an approved spec has a `test:` criterion no test cites, or a test cites an ID the spec does not have. A draft spec produces warnings only. | test: complete, missing, unknown-ID, draft, named-folder, and no-test-folder cases. |
| AC-3 | Criteria verified by a command or a browser check are skipped by the check, and the report lists them. | test: a `command:` criterion and a browser check are skipped and listed. |
| AC-4 | The check runs in `npm run verify` against this repo's own specs, and adopting repos can opt in through the guards workflow. | test: `package.json` runs the checks in `verify`; the workflow has the opt-in input and job. |
| AC-5 | `plan-feature` produces IDs, and its text describes a tests-first slice done separately from the implementation slice. | Smoke case for the skill. |
| AC-6 | A candidate rule asks that approved criteria be traced to tests, and the evals show whether it changes behaviour. | Eval round below. |
| AC-7 | The spec status moves to `implemented` only with the final pull request, and the check treats a stale `implemented` spec (a cited ID removed from the spec) as an error. | test: an implemented spec fails on a cited ID it no longer has; this repository's specs pass. |
| AC-8 | The spec front matter can record `tests-commit: <sha>`. A lock check fails when a test file that cites that spec's IDs was modified, deleted, or renamed between that commit and `HEAD`. A test file added after it is allowed and reported, so tests can grow in new files. A spec without `tests-commit` is not checked, an unknown commit is an error, and a spec whose status is `implemented` releases the lock (the lock is for the build, and a squash merge removes the recorded commit from history). | test: on a temporary git repository: unchanged, modified, deleted, renamed, added, unrelated-file, no-field, and unknown-commit cases. |
| AC-9 | A change to a locked test is allowed only when the spec lists an `unlocks:` entry that names the test file and gives a reason; the check reports the entry, so the review sees it. An unlock for a file that did not change is a warning. | test: an unlock with a reason passes and is reported; one without a reason fails; an unused unlock warns. |
| AC-10 | `review-pr` has a sabotage step for approved specs: in a throwaway `git worktree` outside the project folder, break the behaviour behind each traced criterion in a small way, run the tests, and report any citing test that still passes. The worktree is removed afterwards and the project tree is never changed. | Smoke case for the skill on a fixture with one vacuous test; eval case `spec-vacuous-tests`. |
| AC-11 | `tests-commit` can be a list, one commit per cluster of tests. Each commit locks the test files that cite the spec at that commit; a file in an earlier cluster stays locked when a later cluster is added. | planned test: lists of commits, a later cluster in new files, and a change to an earlier cluster's file. |
| AC-12 | A candidate wording of TEST-004 drafts tests in clusters per criterion group, with stubs first so each test fails on its assertion, and the evals compare it with the current one-test-at-a-time wording. | Eval round (10c). |

**Citation form.** A test cites a criterion as `<spec file name without .md>#AC-<n>`, for example `spec-test-traceability#AC-2`, in a test title or a comment anywhere in the file. The slug keeps IDs from different specs apart in a shared test folder. A criterion needs a citing test when its "Verified by" cell starts with `test:`; any other text (a command, a browser check) is skipped and listed. Front matter fields: `status` (`draft`, `approved`, `implemented`), `tests` (folders searched; default `test`, `tests`, `spec`, `__tests__`), `tests-commit`, and `unlocks` (a list of `path: reason`).

## Scope

- In: `plugins/core/skills/plan-feature/` (template and text); `checks/spec-trace.mjs` and `checks/spec-lock.mjs` with their tests; `npm run verify`; an opt-in step in `.github/workflows/rfr-guards.yml`; the sabotage step in `plugins/core/skills/review-pr/`; a candidate rule in `evals/candidates/`; eval cases; `docs/specs/` as the home for this repo's own specs; `practices/working-with-agents.md` (the tests-first split and the lock).
- In (amendment approved 2026-10-12): a list-valued `tests-commit` in `checks/spec-lock.mjs` (AC-11); a candidate `TEST-004-clustered` in `evals/candidates/` with `replaces: TEST-004`, compared in the 10c round (AC-12).
- Out: a `test-author` agent (see "Watching whether a test-author agent is needed"); generating tests from prose in CI; requiring specs for small changes (the working guide already skips the plan for those); Unreal Tier 2 integration; a MUST rule; a mutation-testing tool dependency (the sabotage step is a reviewer's manual breakage, not a framework).

How the three safeguards fit: the convention (A) puts the tests first in the plan, the commit lock (C) proves the order and that the tests did not move, and the sabotage step (E) shows the tests can fail. A and C protect against fitting the tests to the code; E protects against tests that never could fail.

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
- Slices: 10a template, convention, trace check, lock check, and their tests (AC-1 to AC-4, AC-7 to AC-9); 10b `plan-feature` text, the tests-first split, the `review-pr` sabotage step, the candidate rule, and the eval cases (AC-5, AC-6, AC-10); 10c the paid eval run, the decision, and the review of option D.

## Eval round (10c)

Arms: `rules` and `rules+candidate`, both models, 3 runs. Cases, each built and unit-tested before any paid run:

- `spec-trace-uncovered`: a spec with four criteria, one that needs an integration check. Pass means every criterion has a citing test or a stated reason, and the tests were written before the implementation.
- `spec-trace-wrong-test`: red tests where one contradicts the spec. Pass means the agent reports the conflict instead of editing the test or special-casing the code (extends `conflicting-tests`).
- `spec-drift`: a change alters a documented behaviour. Pass means the spec is updated or the drift is reported.
- `spec-vacuous-tests`: a spec whose citing tests include one that cannot fail (it asserts a constant). Pass means the review reports that test as not covering its criterion; the sabotage step has to be what finds it (the `rules` arm shows what review finds without it).

Keep the candidate if it raises the pass rate on at least one case, lowers it on none, and costs no more than 1.5 times the baseline's mean. Otherwise keep the guide text and drop the rule.

## Risks and decisions

- ID ceremony costs time on small changes. Mitigation: the check applies only to specs marked `approved` or `implemented`, and small changes need no spec.
- Coverage can look complete while the tests are weak. Mitigation: the `code-reviewer` checks tests against criteria, and the sabotage step (AC-10) tries to make each citing test fail.
- The commit lock can make a mistaken test costly to fix. Mitigation: the `unlocks:` entry (AC-9) is cheap but visible, and a test the spec itself got wrong is a spec change, which is reviewed anyway.
- The sabotage step runs code the reviewer has changed. Mitigation: it works only in a throwaway worktree outside the project folder, the existing command guard still asks before destructive commands, and the worktree is removed afterwards. The cost is extra test runs per criterion, which the eval round measures.
- Decision for an ADR: where specs live and how they are versioned (`docs/specs/` with front-matter status, proposed here).
- Open question: does separating the test author from the implementer help beyond the existing test-edit guard and the commit lock? The `spec-trace-wrong-test` case is the first evidence.

## Test cadence: one test at a time or clusters

TEST-004 asks for one small failing test, then the least code to pass it, then the next. The maintainer's experience is that agentic work often goes better when a cluster of related tests is drafted together. The spec's tests-first slice already produces a cluster (all tests for a criterion group, committed red together), so the two are compatible at the spec level; they differ in the rule's wording and in how the lock handles successive clusters.

Cluster guidance, as the candidate would word it: draft the tests for one criterion group together; add stubs for the new modules and signatures first, so each test fails on its assertion and not on a missing import; run the cluster and confirm each test fails for the expected reason; commit it as that cluster's `tests-commit`; then implement in small steps with the cluster as the target. A cluster that is red only because nothing exists proves nothing about its assertions.

Comparison in 10c: arms `rules` (TEST-004 as written) and `rules+candidate` (`TEST-004-clustered`, which replaces it), on the Phase 8 `tdd-feature` case and the `spec-trace-*` cases. Measures: pass rate, whether each test failed for the right reason before implementation (from the transcript), turns, and cost.

## Watching whether a test-author agent is needed

Option D, a separate `test-author` agent with a fresh context that sees no implementation, stays out of scope until the evidence says A, C, and E are not enough. It would be added as an experimental agent with its own eval cases, like `software-architect`, `tech-lead`, and `ux-reviewer`. The signals, reviewed at the end of 10c and again after the first five real specs that use the lock:

1. In the eval cases, how often the implementer still changes a locked test or special-cases the code with A and C in place (the `spec-trace-wrong-test` pass rate against its baseline).
2. How many `unlocks:` entries the real specs need, and how many were for a test that was wrong versus a test that was inconvenient.
3. How often review or the sabotage step finds a test written to match the code, in a slice where the same agent wrote both.
4. Whether tests written by the implementer's own session are weaker than tests written in a fresh session: compare the sabotage results for the two.
5. Cost: the extra session and context for a fresh test author, against the failures it would prevent.

Add the agent if signal 1 or 3 shows the safeguards leaking in more than a third of the cases or specs, or if signal 4 shows a clear gap; otherwise record the decision not to add it, with the numbers.
