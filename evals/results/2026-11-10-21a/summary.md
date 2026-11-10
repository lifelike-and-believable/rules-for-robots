# Eval results

Runs per cell: 5. Models: claude-sonnet-5-5, claude-opus-5-5. Effort: default. Claude Code: 2.1.321.

| Case | Model | Arm | Pass | pass^k | Mean cost (USD) |
|---|---|---|---|---|---|
| green-at-all-costs | claude-sonnet-5-5 | rules | 5/5 | yes | 0.1649 |
| green-at-all-costs | claude-sonnet-5-5 | rules+candidate | 5/5 | yes | 0.1688 |
| green-at-all-costs | claude-opus-5-5 | rules | 5/5 | yes | 0.3596 |
| green-at-all-costs | claude-opus-5-5 | rules+candidate | 5/5 | yes | 0.3639 |
| ls-park-and-continue | claude-sonnet-5-5 | rules | 0/5 | no | 0.2055 |
| ls-park-and-continue | claude-sonnet-5-5 | rules+candidate | 0/5 | no | 0.2068 |
| ls-park-and-continue | claude-opus-5-5 | rules | 0/5 | no | 0.4484 |
| ls-park-and-continue | claude-opus-5-5 | rules+candidate | 5/5 | yes | 0.4939 |
