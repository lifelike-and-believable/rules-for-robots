---
status: draft
tests-commit: 95f37f8ee1c68845f26a2699aa3144b61a6131ed
---

# The delivery run

Once a feature's user documentation is approved, an agent delivers it without the lead: the spec, the tests, the implementation, and the tutorial, on one branch, pushed. A stop check keeps the run going until that is done, a marker says which session is on a run, and at each gate the lead is told once, with the link to review and the line to approve. This is slice 25d of [the rewrite plan](../rewrite-plan.md). The `status` field stays `draft` until every `test:` criterion has a citing test.

## Problem

Most of the lead's waiting is the agent ending its turn, not a permission prompt: 135 of 168 waits in one project and 52 of 105 in another were replies after a turn ended (`evals/results/2026-11-10-attention-baseline/`). The rules tell the agent to carry on, and nothing holds it to that.

The trials of phase 25a showed a Stop hook can ([trials 2 to 4](../../evals/results/2026-11-12-25a-trials-2-4/README.md)): a session told to stop after the spec was sent back once and finished the delivery. They also showed what the check must not do. Its first version blocked a session that was only waiting for a packet to merge, and spent its limit before the run began. So the check has to know that a run is under way and which one, and its limit has to count lack of progress.

Under the GitHub gate the agent does not write the pull request's description, so the review packet, the questions the agent set aside, and the way to approve have to reach the lead some other way.

## User stories

- As a project lead, I want to approve a feature's user documentation and come back to an implementation I can test, so that I am not the one keeping the work moving.
- As a project lead, I want a session I am talking to on a feature branch to stop when I expect it to, so that the check that keeps a run going does not take over a conversation.
- As a project lead, I want to be told once when something needs my review, with the link and the way to approve, so that I do not go looking for it.
- As an agent, I want to know exactly what is still missing before I stop, so that I finish the run or record why I could not.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | A delivery run is under way only between `delivery start` and its end, on the branch it started on: `start` writes a marker inside the repository's git folder with the branch, and refuses on the default branch. Without a marker, or on another branch, the stop check allows every stop, whatever the branch holds. | test: start on a feature branch and on the default branch; an unfinished branch with no marker; a marker for another branch. |
| AC-2 | `deliveryMissing` lists what the run still lacks, for each process spec this branch adds or changes compared with the default branch: a spec at all; a spec that is still a draft; a test that cites the spec (`<name>#AC-`); a tutorial deriving from the user documentation the spec derives from; uncommitted changes; and commits or a branch not pushed. A spec that derives from a design marked `no-user-docs` needs no tutorial. | test: a branch at each point, a finished branch, and a spec for enabling work. |
| AC-3 | Something that cannot be done is set aside in `docs/decisions/<spec name>.md` with the token `[set aside: tests]` or `[set aside: tutorial]` and the reason; the check then stops listing it. Uncommitted and unpushed work cannot be set aside. | test: each token; a token that does not excuse the push. |
| AC-4 | While a run is under way and something is missing, the `Stop` hook blocks the stop with a reason that lists what is missing and says to carry on without asking the lead. It blocks at most three times in a row with no new commit in between, then allows the stop and leaves the marker; a new commit starts the count again. | test: a block and its reason; three blocks then an allow; a commit resetting the count. |
| AC-5 | When nothing is missing, the hook blocks once more, telling the agent to report to the lead once: what was built, anything set aside, the link to review the pull request, and the line the lead can run to approve it from the Claude Code prompt. The next stop is allowed and the marker is removed. | test: the report block, then the allow, and the marker gone. |
| AC-6 | `delivery gate` prints, for the current branch, the link to its pull request on GitHub and the approve line (`! gh pr review <branch> --approve`), from the origin remote, with no network call. | test: an https and an ssh remote. |
| AC-7 | `checks/ci/process-pr-body.mjs` writes a pull request description from the branch: the review packet for the process artifacts it changes; each changed design marked `no-user-docs`, with its reason, under a heading that says it lets a spec skip user documentation; the decision files it changes; and, when it touches a gated stage, the approve line. The workflow template has a step that runs it and edits the pull request, and that step cannot fail the workflow. | test: the sections for a packet with an open item, an enabling design, and a decision file; an ungated change has no approve line; the workflow step. |
| AC-8 | rfr-process has a `deliver` skill that states the run: start it with `delivery start`; write the spec, failing tests, implementation, and tutorial on one branch with a commit for each; never ask the lead and never end the turn to wait; set aside what cannot be done; push the branch and do not open, approve, or merge a pull request. The text every session is given names the skill for a feature whose delivery is open, and says to tell the lead once, with the review link, after pushing a branch they must review. | test: the skill's text; the session text; `hooks.json` registers the `Stop` hook. |

## Scope

- In: `plugins/process/scripts/delivery.mjs` (the commands and the `Stop` hook), the `deliver` skill, `hooks.json`, the session text in `checks/lib/process.mjs`, `checks/ci/process-pr-body.mjs`, the step in `templates/workflows/rfr-open-pr.yml`, the guide, tests.
- Out: letting a session subscribe to a pull request where rfr-core is loaded, which its default-allow hook refuses today (a separate change to rfr-core, with a release); running the project's tests inside the hook, which is CI's job and too slow for a hook; removing WA-003 and WA-009, which the skill's text replaces in 25e.

## APIs and assumptions

- A `Stop` hook that prints `{"decision": "block", "reason": ...}` sends the agent back to work with the reason. Seen in the 25a trials on Claude Code 2.1.322, in cloud sessions.
- `gh pr review` takes a branch name in place of a number, so the approve line needs no lookup.
- Feedback #132 (a stacked branch rebased after its base is squash-merged) does not arise with one branch for each feature; trial 5 settled that delivery pull requests merge with a merge commit.
- The check does not run the tests. A run that pushes failing tests fails CI on its pull request, and the lead sees that at validation. The 25f acceptance test shows whether that is enough.

## Delivery

- Plan item: `PLAN.md`, Phase 25, slice 25d.
- Pull requests: #224.
