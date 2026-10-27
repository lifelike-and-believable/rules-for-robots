---
name: merge-when-green
description: Wait for a pull request's CI to finish without polling, confirm every check passed on the current head commit, merge it, and continue with the next task. Use when the user asks to merge a pull request once CI is green, or to merge and carry on.
disable-model-invocation: true
argument-hint: "<pull request number or URL> [merge | squash | rebase]"
---

# Merge when green

Invoking this skill is the user's request to merge `$ARGUMENTS` once CI passes on its head commit. Do not merge anything else.

1. **Identify** the pull request and the merge method, in this order: the argument; the only method the repository allows (`gh repo view --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed`); the method recent merges used; otherwise a merge commit. Say which you used and why. Do not stop to ask about the method.
2. **Wait for an event; never poll.**
   - Run `gh pr checks <pr>` once. If every check has finished, go on to step 3.
   - If any is still running and this session receives the pull request's events, end the turn and continue when one arrives. A cloud session subscribed to the pull request gets CI results as events. In the Claude desktop app, bind the pull request to the session and turn its monitor on (auto-fix and comments): it relays CI failures and new comments, so a green run arrives as the CI status comment that `rfr-ci-status.yml` posts. A repository whose CI posts no comment never wakes the session on green; say so to the user.
   - If the session receives no events, say which checks are still running and end the turn; the user brings you back. Where the harness offers a scheduled wake-up, you may set one fallback about 30 minutes out, and cancel it once you have merged.
   - Never wait with `gh pr checks --watch`, `gh run watch`, a `sleep` loop, or repeated checks: they hold the session, and a long self-hosted run outlasts any timeout.
   - A CI status comment or a bot saying CI passed is a signal to look, not proof: it may describe an older commit.
3. **Confirm on the head commit,** yourself, whatever a comment or event said. Run `gh pr view <pr> --json headRefOid,mergeStateStatus,reviewDecision,statusCheckRollup`. Every check must be `SUCCESS`, `SKIPPED`, or `NEUTRAL` on `headRefOid`; `mergeStateStatus` must be `CLEAN` (or `HAS_HOOKS`); no required review may be missing. A check skipped only because the pull request was a draft when it ran is not a pass: mark the pull request ready (or convert it to a draft and back) to start a real run, and go back to step 2. If the head moved since you started waiting, go back to step 2.
4. **If anything failed or is pending,** do not merge. Read the failing job's log now, before reporting (`gh run view <run> --log-failed`, where the run ID is in the check's link; copy the first error with about ten lines of context), and report the check, the commit, and the cause from the log. If the fix belongs to the change you are working on, fix it, push, and return to step 2. Never re-run a job to get a green result without a reason, skip or weaken a test, or merge with `--admin`.
5. **Merge** with `gh pr merge <pr> --<method> --match-head-commit <headRefOid>`, so a push that lands in the meantime stops the merge.
6. **Continue.** Switch to the base branch and bring it up to date (`git switch <base> && git pull --ff-only origin <base>`), so the next change starts from the merged result. Report the merge, then go on with the next task on a new branch from there. If the project's plan, roadmap, or handoff file tracks this work and its entry does not name this pull request, add it in your next change and say so in the report.
