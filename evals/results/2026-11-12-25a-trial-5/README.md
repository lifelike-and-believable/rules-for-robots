# Trial 5: squash merging and the spec lock (2026-11-12)

The fifth trial of phase 25a in [the rewrite plan](../../../docs/rewrite-plan.md). The plan puts a feature's spec, tests, and implementation on one branch. The spec lock records the commit that holds the tests (`tests-commit`), and a squash merge removes that commit from the default branch's history.

**Result: passed with a condition.** A squash merge is safe only when the branch's last commit sets the spec's status to `implemented`. A merge commit is safe with no condition.

## Method

A scratch repository with a bare remote. On a feature branch: a commit with an approved spec, a commit with a test citing its criterion, then a commit that records that test commit as `tests-commit` and adds the implementation. `checks/spec-lock.mjs` was run on the branch, the branch was squash-merged to `main` and pushed, and the check was run again on a fresh clone of `main`, which is what CI sees.

## Results

| Spec status in the branch's last commit | On the branch | Fresh clone of `main` after the squash |
|---|---|---|
| `implemented` | passes, 1 spec checked | passes: "lock released (status implemented)" |
| `approved` | passes, 1 spec checked | fails: "tests-commit ... not found (is the full history fetched?)" |

This matches spec-test-traceability AC-8, which releases the lock for an `implemented` spec because a squash removes the recorded commit.

## What it means for the plan

- The delivery pull request merges with a merge commit, as the trial 1 workflow already does (`gh pr merge --auto --merge`). The recorded commit stays in history and the lock holds whatever the spec's status.
- A project that squashes must have the delivery run set the spec to `implemented` in its last commit; otherwise the default branch fails the lock check after the merge. 25d states this in the run's end point.
- Feedback #132 (a stacked branch rebased after its base is squash-merged) does not arise with one branch for each feature.
