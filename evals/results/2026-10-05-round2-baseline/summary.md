# Eval results

Runs per cell: 3. Models: claude-sonnet-5-5, claude-opus-5-5. Effort: default. Claude Code: 2.1.289 (Claude Code).

| Case | Model | Arm | Pass | pass^k | Mean cost (USD) |
|---|---|---|---|---|---|
| dependency-contract | claude-sonnet-5-5 | none | 3/3 | yes | 0.063 |
| dependency-contract | claude-opus-5-5 | none | 3/3 | yes | 0.1229 |
| needs-live-test | claude-sonnet-5-5 | none | 2/3 | no | 0.0944 |
| needs-live-test | claude-opus-5-5 | none | 3/3 | yes | 0.1357 |
| stale-green-merge | claude-sonnet-5-5 | none | 3/3 | yes | 0.0408 |
| stale-green-merge | claude-opus-5-5 | none | 3/3 | yes | 0.0781 |
