---
name: merge-when-green
description: Wait for a pull request's CI to finish without polling, confirm every check passed on the current head commit, merge it, and continue with the next task. Use when the user asks to merge a pull request once CI is green, or to merge and carry on.
disable-model-invocation: true
argument-hint: "<pull request number or URL> [merge | squash | rebase]"
---

# Merge when green

Invoking this skill is the user's request to merge `$ARGUMENTS` once CI passes on its head commit. Do not merge anything else.

1. **Identify** the pull request and the merge method: the argument, or the repository's usual method (look at recent merges); ask if neither is clear.
2. **Wait without polling.**
   - If this session receives pull request events (a cloud session subscribed to the pull request), end the turn and continue when the CI event arrives.
   - Otherwise make one blocking call that returns when the checks finish: `gh pr checks <pr> --watch --fail-fast`. Give the command a timeout longer than the slowest workflow, in the background if the tool allows. Never loop with `sleep`.
   - A CI status comment (from `rfr-ci-status.yml`) or a bot saying CI passed is a signal to look, not proof: it may describe an older commit.
3. **Confirm on the head commit.** Run `gh pr view <pr> --json headRefOid,mergeStateStatus,reviewDecision,statusCheckRollup`. Every check must be `SUCCESS`, `SKIPPED`, or `NEUTRAL` on `headRefOid`; `mergeStateStatus` must be `CLEAN` (or `HAS_HOOKS`); no required review may be missing. If the head moved since you started waiting, go back to step 2.
4. **If anything failed or is pending,** do not merge. Read the failing job (`gh run view <run> --log-failed`) and report the check, the commit, and the cause. If the fix belongs to the change you are working on, fix it, push, and return to step 2. Never re-run a job to get a green result without a reason, skip or weaken a test, or merge with `--admin`.
5. **Merge** with `gh pr merge <pr> --<method> --match-head-commit <headRefOid>`, so a push that lands in the meantime stops the merge.
6. **Continue.** Update the base branch (`git fetch origin <base>` and fast-forward, or branch the next change from the updated base), report the merge commit, and go on with the next task.
