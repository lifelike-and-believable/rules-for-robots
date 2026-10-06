# Agent and skill smoke tests

Model: claude-sonnet-5-5 (main session; agents use their own model settings). Claude Code: 2.1.290 (Claude Code).

| Case | Result | Cost (USD) |
|---|---|---|
| skill merge-when-green: green pull request | pass | 0.080 |
| skill merge-when-green: red head commit | pass | 0.106 |

## Notes

Two rounds after the fixes below, 4 of 4 runs passed (this file records the first; the repeat also passed 2/2, $0.20). Total spend including the diagnostic runs was under $1.

Earlier rounds found three gaps, all fixed in rfr-core 1.0.6:

1. With no merge history and no method given, the skill stopped to ask which merge method to use. It now falls back from the argument to the only allowed method, then recent merges, then a merge commit, and says which it used.
2. On a red head, the model sometimes offered to read the failing log instead of reading it. Step 4 now says to read it before reporting, and where the run ID is.
3. After merging, the model fetched the base but stayed on the feature branch. Step 6 now says to switch to the base and fast-forward it.

The red-head runs also hit a `guard-commands` false positive: a read-only `cat tests/... 2>&1` was treated as a write to a test file. Stream redirects such as `2>&1` and `>/dev/null` no longer count as writes.

The first round of this smoke test failed for an unrelated reason: the local checkout was behind `main`, so the plugin under test did not yet contain the skill.
