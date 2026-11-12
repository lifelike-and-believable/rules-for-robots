---
status: draft
---

# Process state and the change check

An agent in a process project is told, at the start of every session, where each feature stands and what the process allows next; and a pull request that changes source code has to belong to a feature with an approved spec, or say that it is a fix or a trivial change and fit what those may be. This is slice 25c of [the rewrite plan](../rewrite-plan.md). The maintainer approved its two open choices on 2026-11-12: the change check fails from the first day, and a fix or trivial declaration is checked against what a machine can check. The `status` field stays `draft` until every `test:` criterion has a citing test.

## Problem

The process is enforced on documents and not on code. A pull request that touches no process folder is inferred `trivial` (`checks/ci/process-tier.mjs`), so the cheapest way through CI is to skip every stage: on `xr-studio-in-a-box` an agent wrote a spec and code straight from stories (feedback #204). 7.1.0 refuses writing an artifact that skips a stage, and says nothing about code written with no spec at all.

Nothing tells the agent the process either. No always-on rule mentions it, an adopter's `AGENTS.md` carries a merge rule and a link to a guide, and the agent learns the stage order by being refused. Where it does look, it reads `status: approved` in its own branch, which the agent itself wrote: an artifact is approved when the pull request that carries it merges, so only the default branch says what is approved.

Under the GitHub gate ([github-gate](github-gate.md)) the agent does not write the pull request's description, so a declaration about the change has to live in the branch.

## User stories

- As a project lead, I want an agent to know each feature's stage before it does anything, so that it works on the right stage without being refused first.
- As a project lead, I want code with no approved spec behind it to fail CI, so that skipping the design and user documentation is not the easy path.
- As a project lead, I want a fix or a trivial change to go through without the stages, and to be held to what a fix or a trivial change can be, so that the short path is not a way round the process.
- As an agent, I want the state to tell me which work is open and which is waiting on the approver, so that I carry on with what I can do.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | `featureSteps` gives, for each story, the first thing still to do, in stage order, skipping waived stages: the story, its design, or its user documentation is waiting for approval; the design or the user documentation is to be written; delivery (spec, tests, implementation, tutorial) is open, or under way once a spec exists; the tutorial is waiting for approval; or the feature is done. Artifacts belong to a story when they derive from it, directly or through others. | test: a story at each step; a waived design; a design shared by two stories. |
| AC-2 | Approval is read from the default branch: `processNext` loads the artifacts from the remote default branch's tree, and reports an artifact that is new or changed in the working tree as in this branch and not approved until its pull request merges, whatever its `status` says. Without a remote default branch it reads the working tree and says so. | test: a repository whose working tree marks a design approved that the default branch does not have; one with no remote. |
| AC-3 | `renderNext` prints the process rule in three sentences (find the feature's stage first; do only what that stage allows, and write a missing stage instead of working round it; approved user documentation is the definition of done, and a source change belongs to a feature with an approved spec or declares `Change: fix` or `Change: trivial`), then the features waiting on the approver, the work open for an agent, product-level drafts, and a count of finished features. It prints at most 40 lines and says how many items it left out. | test: the sections and their order; the cap. |
| AC-4 | rfr-process has a `SessionStart` hook that gives the session that text as additional context. In a project without `docs/product/process.yml` it prints nothing, and an error in it never fails the session. | test: the hook's output with and without `process.yml`, and on a broken artifact; `hooks.json` registers it. |
| AC-5 | `checkChange` passes a pull request that changes no source file. A source file is any changed file that is not under `docs/`, `.github/`, `.claude/`, or `.rfr/`, not Markdown, and not a test or baseline. With source changes and no declaration it passes only when the pull request changes a process spec, or changes a test that cites one, and that spec is `approved` or `implemented`; otherwise it fails and names the three ways forward. Where `process.yml` waives specs, the spec is not required. | test: documents only; source with its spec in the pull request; source with a test citing an approved spec; a draft spec; no spec; specs waived. |
| AC-6 | A commit message in the pull request can declare the change with a `Change: fix` or `Change: trivial` trailer. A trivial change may not add a source file or touch a `public-api` path. A fix must change or add a test, and may not add a source file. Two different declarations, or an unknown one, fail. Each failure names the file and says the change needs a feature with a spec. | test: each rule passing and failing; conflicting and unknown declarations. |
| AC-7 | The pull request that adds `docs/product/process.yml` passes, and while `adoption-until` is in the future the check's failures are warnings. | test: the adoption pull request; before and after the date. |
| AC-8 | `checks/ci/process-change.mjs` reads the changed files and commit messages between `BASE_SHA` and `HEAD_SHA` with git and runs the check; the reusable process workflow has a `change` job that runs it on pull requests with the full history. | test: a temporary repository with a declared fix; the workflow job. |
| AC-9 | The adoption guide and the `setup` skill say how to declare a fix or a trivial change, and name `process / change` among the checks to require. | review: the guide and the skill. |

## Scope

- In: `featureSteps`, `processNext`, and `renderNext` in `checks/lib/process.mjs` (copied into the plugin by the build); `checks/process-next.mjs`; the plugin's `SessionStart` hook; `checks/ci/process-change.mjs`; the `change` job in `.github/workflows/rfr-process.yml`; the guide and the `setup` skill; tests.
- Out: the tier check, which keeps inferring a tier for the mutation job until the verify suite review in 25e; `guard-stages`, which still reads `status` from the working tree (25e moves it to the default branch, as AC-2 does here); the stop check and the trigger (25d).

## APIs and assumptions

- A `SessionStart` hook's `hookSpecificOutput.additionalContext` is added to the session's context. Project hooks were seen to run in cloud sessions in the 25a trials; this hook is confirmed in a real session after release.
- The remote default branch is `refs/remotes/origin/HEAD` when set, else `origin/main`, else `origin/master`. The hook does not fetch, so it reflects the last fetch; a cloud session starts from a fresh clone.
- A spec is cited as `<file name without .md>#AC-n`, as spec-test-traceability defines.
- The check trusts a declaration only within what it can verify. A refactor that adds a file is refused as trivial; the agent records it in `## Decisions` or gives it a spec.

## Delivery

- Plan item: `PLAN.md`, Phase 25, slice 25c.
- Pull requests: #221.
