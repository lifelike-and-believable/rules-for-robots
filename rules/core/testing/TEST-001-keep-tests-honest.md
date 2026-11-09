---
id: TEST-001
title: Keep tests honest
level: MUST
scope: core
paths: ["**/*.test.*", "**/*.spec.*", "**/test/**", "**/tests/**", "**/Tests/**", "**/__snapshots__/**", "**/Source/*Tests/**", "**/Source/**/*Tests.cpp", "**/Source/**/*Test.cpp", "**/Source/**/*Spec.cpp"]
verified-by: [hook, ci]
check: "hook: guard-test-edits and guard-commands (classify each change to a test file that existed where the branch started, and ask when it weakens the test; refuse shell writes to such files; refuse snapshot updates that state no reason); ci: test-change-guard (flags PRs that change tests alongside implementation)"
targets-failure: test-gaming
observed-on: [claude-opus-4-1, claude-opus-4-6, claude-opus-4-7, claude-sonnet-4-6]
evaluated-on: [claude-opus-5-5, claude-sonnet-5-5]
rationale: Claude models game tasks mainly by editing tests, and an anti-hack prompt still leaves 12.5 to 37.5% residual cheating on impossible tasks.
sources: ["practices/testing-and-code-quality.md", "practices/guards.md", "docs/research/findings.md", "docs/research/notes/verification_of_secondary_figures.md"]
---
<!-- Worked example for docs/rule-format.md. Enforcement lands in Phase 2 (hook) and Phase 6 (CI). -->
Make failing tests pass by changing the implementation. Leave existing assertions, expected values, snapshots, and skip markers as they are, because a weakened test hides the defect it was written to catch.

Change existing test files with Edit or MultiEdit, never through shell commands or scripts, so the change can be checked.

If a test looks wrong, stop and say which and why instead of editing it. Add new tests freely.

If an approved spec criterion changed what a test expects, first add the file to that spec's `unlocks:` with the criterion ID, then edit it; the hook checks for the entry at the edit.

List each changed test and its reason in your final report.
