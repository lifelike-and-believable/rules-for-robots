---
name: review-pr
description: Review the current branch or a pull request with independent reviewer agents, then confirm or refute each finding before reporting. Use when the user asks for a code review of a change, branch, or PR.
argument-hint: "[PR number, branch, or base ref]"
---

# Review a change

1. **Collect the change.** Determine the diff from `$ARGUMENTS` (a PR number, a branch, or a base ref; default: the current branch against the default branch). Gather the stated requirements: PR description, linked issue, or spec.
2. **Choose reviewers.** Always use `code-reviewer`. Add `security-reviewer` for auth, input handling, data access, dependencies, CI, or migrations; `accessibility-reviewer` for UI; `performance-reviewer` for hot paths, page weight, queries, or per-frame work.
3. **Run them in parallel.** Give each the diff, the requirements, and nothing about how the change was written. Ask for all findings in their standard format.
4. **Confirm or refute.** For each finding, check it against the code yourself, or with a fresh subagent for complex ones: does the failure scenario actually happen? Mark each `confirmed`, `plausible`, or `refuted`, and drop refuted ones from the main list.
5. **Report.** Confirmed and plausible findings ordered by severity, then a one-line count of refuted findings. Do not fix anything unless the user asks.
