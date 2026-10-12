---
name: review-pr
description: Review the current branch or a pull request with independent reviewer agents, then confirm or refute each finding before reporting. Use when the user asks for a code review of a change, branch, or PR.
argument-hint: "[PR number, branch, or base ref]"
---

# Review a change

1. **Collect the change.** Determine the diff from `$ARGUMENTS` (a PR number, a branch, or a base ref; default: the current branch against the default branch). Gather the stated requirements: PR description, linked issue, or spec.
2. **Choose reviewers.** Always use `code-reviewer`. Add `security-reviewer` for auth, input handling, data access, dependencies, CI, or migrations; `accessibility-reviewer` for UI; `performance-reviewer` for hot paths, page weight, queries, or per-frame work.
3. **Run them in parallel.** Give each the diff, the requirements, and nothing about how the change was written. Ask for all findings in their standard format.
4. **Check the citations.** With three or more findings, give them to the `citation-checker` agent; with fewer, check each cited place yourself. For each one that is reported as a `mismatch`, look at the cited place yourself first: the line may have moved, in which case correct the citation and keep the finding; if the file or code is not in the diff or the repository at all, mark it `refuted`. A citation that checks out says nothing about whether the finding is right.
5. **Confirm or refute.** For each finding, check it against the code yourself, or with a fresh subagent for complex ones: does the failure scenario actually happen? Mark each `confirmed`, `plausible`, or `refuted`, and drop refuted ones from the main list.
6. **Sabotage the traced tests.** Only when the change implements an approved or implemented spec in `docs/specs/`. Check that its tests can fail: make a throwaway worktree outside the project folder (`git worktree add <temp dir> HEAD`) and, for each criterion marked `test:`, break the behaviour it describes in a small way there (flip a condition, return a constant, drop a check). Run the project's test command (the `check-runner` agent can run it) and note every citing test that still passes. Remove the worktree afterwards (`git worktree remove --force <temp dir>`) and never change the project tree. Report such a test as not covering its criterion, with the break you made. If the tests need a service or an engine that a worktree does not have, say so and skip this step.
7. **Report.** Confirmed and plausible findings ordered by severity, then a one-line count of refuted findings. Do not fix anything unless the user asks.
