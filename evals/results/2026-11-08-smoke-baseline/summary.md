# Agent and skill smoke tests

Model: claude-sonnet-5-5 (main session; agents use their own model settings). Claude Code: 2.1.319 (Claude Code).

| Case | Result | Cost (USD) | Cost by model (USD) |
|---|---|---|---|
| accessibility-reviewer: div button | pass | 0.106 | sonnet-5-5 0.106 |
| accessibility-reviewer: unlabelled input | pass | 0.096 | sonnet-5-5 0.096 |
| check-runner: failing test and missing scanner | pass | 0.065 | sonnet-5-5 0.063, haiku-5-5 0.002 |
| check-runner: passing verify | pass | 0.060 | sonnet-5-5 0.059, haiku-5-5 0.001 |
| citation-checker: one good and one wrong citation | pass | 0.066 | sonnet-5-5 0.065, haiku-5-5 0.001 |
| code-reviewer: clean change | pass | 0.173 | sonnet-5-5 0.072, opus-5-5 0.101 |
| code-reviewer: off-by-one | pass | 0.164 | sonnet-5-5 0.074, opus-5-5 0.091 |
| performance-reviewer: N+1 queries | pass | 0.095 | sonnet-5-5 0.095 |
| performance-reviewer: Unreal tick | pass | 0.101 | sonnet-5-5 0.101 |
| security-reviewer: committed secret | pass | 0.157 | sonnet-5-5 0.073, opus-5-5 0.084 |
| security-reviewer: SQL injection | pass | 0.142 | sonnet-5-5 0.074, opus-5-5 0.069 |
| skill a11y-audit: component | pass | 0.071 | sonnet-5-5 0.071 |
| skill a11y-audit: static page | pass | 0.107 | sonnet-5-5 0.107 |
| skill merge-when-green: checks still running | pass | 0.069 | sonnet-5-5 0.069 |
| skill merge-when-green: green pull request | pass | 0.077 | sonnet-5-5 0.077 |
| skill merge-when-green: red head commit | pass | 0.071 | sonnet-5-5 0.071 |
| skill package-unreal-plugin: no engine | pass | 0.089 | sonnet-5-5 0.089 |
| skill perf-audit: bundle question | pass | 0.066 | sonnet-5-5 0.066 |
| skill perf-audit: no deployment | pass | 0.110 | sonnet-5-5 0.105, haiku-5-5 0.006 |
| skill plan-feature: criterion IDs and tests first | pass | 0.091 | sonnet-5-5 0.091 |
| skill plan-feature: CSV export | pass | 0.111 | sonnet-5-5 0.111 |
| skill plan-feature: median caching | pass | 0.094 | sonnet-5-5 0.094 |
| skill profile-unreal-plugin: no engine | pass | 0.066 | sonnet-5-5 0.066 |
| skill release: waits for confirmation | pass | 0.062 | sonnet-5-5 0.062 |
| skill review-pr: planted bug | pass | 0.183 | sonnet-5-5 0.103, opus-5-5 0.080 |
| skill review-pr: security change | pass | 0.323 | sonnet-5-5 0.142, opus-5-5 0.181 |
| skill review-pr: vacuous tests behind an approved spec | pass | 0.102 | sonnet-5-5 0.102 |
| skill security-audit: secret and injection | pass | 0.088 | sonnet-5-5 0.088 |
| skill write-adr: database choice | pass | 0.078 | sonnet-5-5 0.078 |
| skill write-adr: test runner | pass | 0.068 | sonnet-5-5 0.068 |
| unreal-engineer: add Blueprint function | pass | 0.313 | sonnet-5-5 0.082, opus-5-5 0.231 |
| unreal-engineer: new source file | pass | 0.210 | sonnet-5-5 0.083, opus-5-5 0.127 |
| web-engineer: add function | pass | 0.135 | sonnet-5-5 0.135 |
| web-engineer: bug fix with test | pass | 0.118 | sonnet-5-5 0.118 |
