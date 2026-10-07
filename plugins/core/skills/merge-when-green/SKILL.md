---
name: merge-when-green
description: Wait for a pull request's CI to finish without polling, confirm every check passed on the current head commit, merge it, and continue with the next task. Use when the user asks to merge a pull request once CI is green, or to merge and carry on.
disable-model-invocation: true
argument-hint: "<pull request number or URL> [merge | squash | rebase]"
---

# Merge when green

Invoking this skill is the user's request to merge `$ARGUMENTS` once CI passes on its head commit. Do not merge anything else.

1. **Identify** the pull request and the merge method, in this order: the argument; the only method the repository allows (`gh repo view --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed`); the method recent merges used; otherwise a merge commit. Say which you used and why. Do not stop to ask about the method.
2. **Wait without polling.**
   - If this session receives pull request events (a cloud session subscribed to the pull request), end the turn and continue when the CI event arrives.
   - Otherwise run `gh pr checks <pr>` once. If every check has finished, go on to step 3. If any is still pending, hand the wait to the `ci-watcher` agent with the pull request number. It makes the one blocking call (`gh pr checks <pr> --watch --fail-fast`), never loops with `sleep`, and returns the check results and the first error from each failed job's log. If you cannot use an agent, make that blocking call yourself, with a timeout longer than the slowest workflow.
   - A CI status comment (from `rfr-ci-status.yml`) or a bot saying CI passed is a signal to look, not proof: it may describe an older commit.
3. **Confirm on the head commit,** yourself, whatever `ci-watcher` reported. Run `gh pr view <pr> --json headRefOid,mergeStateStatus,reviewDecision,statusCheckRollup`. Every check must be `SUCCESS`, `SKIPPED`, or `NEUTRAL` on `headRefOid`; `mergeStateStatus` must be `CLEAN` (or `HAS_HOOKS`); no required review may be missing. If the head moved since you started waiting, go back to step 2.
4. **If anything failed or is pending,** do not merge. Read the failing job's log now, before reporting (`ci-watcher` returns the first error; for anything it did not capture, `gh run view <run> --log-failed`, where the run ID is in the check's link), and report the check, the commit, and the cause from the log. If the fix belongs to the change you are working on, fix it, push, and return to step 2. Never re-run a job to get a green result without a reason, skip or weaken a test, or merge with `--admin`.
5. **Merge** with `gh pr merge <pr> --<method> --match-head-commit <headRefOid>`, so a push that lands in the meantime stops the merge.
6. **Continue.** Switch to the base branch and bring it up to date (`git switch <base> && git pull --ff-only origin <base>`), so the next change starts from the merged result. Report the merge, then go on with the next task on a new branch from there. If the project's plan, roadmap, or handoff file tracks this work and its entry does not name this pull request, add it in your next change and say so in the report.
