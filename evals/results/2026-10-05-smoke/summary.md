# Agent and skill smoke tests

Model: claude-sonnet-5-5 (main session; agents use their own model settings). Claude Code: 2.1.289 (Claude Code).

| Case | Result | Cost (USD) |
|---|---|---|
| accessibility-reviewer: div button | pass | 0.106 |
| accessibility-reviewer: unlabelled input | pass | 0.091 |
| code-reviewer: clean change | pass | 0.153 |
| code-reviewer: off-by-one | pass | 0.138 |
| performance-reviewer: N+1 queries | pass | 0.091 |
| performance-reviewer: Unreal tick | pass | 0.097 |
| security-reviewer: committed secret | pass | 0.148 |
| security-reviewer: SQL injection | pass | 0.143 |
| skill a11y-audit: component | pass | 0.065 |
| skill a11y-audit: static page | pass | 0.070 |
| skill package-unreal-plugin: no engine | pass | 0.075 |
| skill perf-audit: bundle question | pass | 0.064 |
| skill perf-audit: no deployment | pass | 0.067 |
| skill plan-feature: CSV export | pass | 0.080 |
| skill plan-feature: median caching | pass | 0.098 |
| skill profile-unreal-plugin: no engine | pass | 0.076 |
| skill release: waits for confirmation | pass | 0.058 |
| skill review-pr: planted bug | pass | 0.214 |
| skill review-pr: security change | pass | 0.269 |
| skill security-audit: secret and injection | pass | 0.095 |
| skill write-adr: database choice | pass | 0.063 |
| skill write-adr: test runner | pass | 0.061 |
| unreal-engineer: add Blueprint function | pass | 0.268 |
| unreal-engineer: new source file | pass | 0.228 |
| web-engineer: add function | pass | 0.107 |
| web-engineer: bug fix with test | pass | 0.115 |
