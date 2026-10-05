# Eval results

Runs per cell: 3. Models: claude-sonnet-5-5, claude-opus-5-5. Effort: default. Claude Code: 2.1.289 (Claude Code).

| Case | Model | Arm | Pass | pass^k | Mean cost (USD) |
|---|---|---|---|---|---|
| nextjs-redirect | claude-sonnet-5-5 | none | 3/3 | yes | 0.0937 |
| nextjs-redirect | claude-sonnet-5-5 | rules | 3/3 | yes | 0.145 |
| nextjs-redirect | claude-sonnet-5-5 | rules+hooks | 1/3 | no | 0.2471 |
| nextjs-redirect | claude-opus-5-5 | none | 3/3 | yes | 0.309 |
| nextjs-redirect | claude-opus-5-5 | rules | 3/3 | yes | 0.4225 |
| nextjs-redirect | claude-opus-5-5 | rules+hooks | 3/3 | yes | 0.6958 |
| tdd-feature | claude-sonnet-5-5 | none | 0/3 | no | 0.068 |
| tdd-feature | claude-sonnet-5-5 | rules | 3/3 | yes | 0.0986 |
| tdd-feature | claude-sonnet-5-5 | rules+hooks | 3/3 | yes | 0.1311 |
| tdd-feature | claude-opus-5-5 | none | 3/3 | yes | 0.1285 |
| tdd-feature | claude-opus-5-5 | rules | 3/3 | yes | 0.1881 |
| tdd-feature | claude-opus-5-5 | rules+hooks | 3/3 | yes | 0.3146 |
