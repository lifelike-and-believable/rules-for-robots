# Agent and skill smoke tests

Model: claude-sonnet-5-5 (main session; agents use their own model settings). Claude Code: 2.1.293 (Claude Code).

| Case | Result | Cost (USD) | Cost by model (USD) |
|---|---|---|---|
| check-runner: failing test and missing scanner | pass | 0.065 | haiku-5-5 0.002, sonnet-5-5 0.063 |
| check-runner: passing verify | pass | 0.062 | sonnet-5-5 0.060, haiku-5-5 0.001 |
| ci-watcher: green pull request | pass | 0.060 | sonnet-5-5 0.059, haiku-5-5 0.001 |
| ci-watcher: red pull request | pass | 0.061 | sonnet-5-5 0.059, haiku-5-5 0.002 |
| citation-checker: one good and one wrong citation | pass | 0.061 | sonnet-5-5 0.059, haiku-5-5 0.001 |
| skill a11y-audit: component | pass | 0.071 | sonnet-5-5 0.071 |
| skill a11y-audit: static page | pass | 0.082 | sonnet-5-5 0.082 |
| skill merge-when-green: checks still running | pass | 0.102 | sonnet-5-5 0.101, haiku-5-5 0.001 |
| skill merge-when-green: green pull request | pass | 0.083 | sonnet-5-5 0.083 |
| skill merge-when-green: red head commit | pass | 0.107 | sonnet-5-5 0.107 |
| skill package-unreal-plugin: no engine | pass | 0.162 | sonnet-5-5 0.160, haiku-5-5 0.002 |
| skill perf-audit: bundle question | pass | 0.065 | sonnet-5-5 0.065 |
| skill perf-audit: no deployment | pass | 0.072 | sonnet-5-5 0.072 |
| skill review-pr: planted bug | pass | 0.191 | sonnet-5-5 0.117, opus-5-5 0.074 |
| skill review-pr: security change | pass | 0.291 | sonnet-5-5 0.138, opus-5-5 0.154 |
| skill security-audit: secret and injection | pass | 0.083 | sonnet-5-5 0.083 |
