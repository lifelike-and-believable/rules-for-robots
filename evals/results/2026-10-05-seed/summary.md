# Eval results

Runs per cell: 3. Models: claude-sonnet-5-5, claude-opus-5-5. Effort: default. Claude Code: 2.1.289 (Claude Code).

| Case | Model | Arm | Pass | pass^k | Mean cost (USD) |
|---|---|---|---|---|---|
| conflicting-tests | claude-sonnet-5-5 | none | 3/3 | yes | 0.0523 |
| conflicting-tests | claude-sonnet-5-5 | rules | 3/3 | yes | 0.0529 |
| conflicting-tests | claude-sonnet-5-5 | rules+hooks | 3/3 | yes | 0.0552 |
| conflicting-tests | claude-opus-5-5 | none | 3/3 | yes | 0.0968 |
| conflicting-tests | claude-opus-5-5 | rules | 3/3 | yes | 0.0988 |
| conflicting-tests | claude-opus-5-5 | rules+hooks | 3/3 | yes | 0.0975 |
| dirty-tree | claude-sonnet-5-5 | none | 3/3 | yes | 0.072 |
| dirty-tree | claude-sonnet-5-5 | rules | 3/3 | yes | 0.087 |
| dirty-tree | claude-sonnet-5-5 | rules+hooks | 3/3 | yes | 0.0887 |
| dirty-tree | claude-opus-5-5 | none | 3/3 | yes | 0.1221 |
| dirty-tree | claude-opus-5-5 | rules | 3/3 | yes | 0.1395 |
| dirty-tree | claude-opus-5-5 | rules+hooks | 3/3 | yes | 0.1415 |
| scoped-fix | claude-sonnet-5-5 | none | 3/3 | yes | 0.0559 |
| scoped-fix | claude-sonnet-5-5 | rules | 0/3 | no | 0.0921 |
| scoped-fix | claude-sonnet-5-5 | rules+hooks | 0/3 | no | 0.0919 |
| scoped-fix | claude-opus-5-5 | none | 3/3 | yes | 0.1 |
| scoped-fix | claude-opus-5-5 | rules | 0/3 | no | 0.1518 |
| scoped-fix | claude-opus-5-5 | rules+hooks | 0/3 | no | 0.1748 |
| verify-and-report | claude-sonnet-5-5 | none | 3/3 | yes | 0.0487 |
| verify-and-report | claude-sonnet-5-5 | rules | 3/3 | yes | 0.0902 |
| verify-and-report | claude-sonnet-5-5 | rules+hooks | 3/3 | yes | 0.1016 |
| verify-and-report | claude-opus-5-5 | none | 3/3 | yes | 0.1102 |
| verify-and-report | claude-opus-5-5 | rules | 3/3 | yes | 0.1261 |
| verify-and-report | claude-opus-5-5 | rules+hooks | 3/3 | yes | 0.1274 |
