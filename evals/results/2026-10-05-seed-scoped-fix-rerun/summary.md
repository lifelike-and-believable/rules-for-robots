# Eval results

Runs per cell: 3. Models: claude-sonnet-5-5, claude-opus-5-5. Effort: default. Claude Code: 2.1.289 (Claude Code).

| Case | Model | Arm | Pass | pass^k | Mean cost (USD) |
|---|---|---|---|---|---|
| scoped-fix | claude-sonnet-5-5 | none | 3/3 | yes | 0.0554 |
| scoped-fix | claude-sonnet-5-5 | rules | 3/3 | yes | 0.0912 |
| scoped-fix | claude-sonnet-5-5 | rules+hooks | 3/3 | yes | 0.1028 |
| scoped-fix | claude-opus-5-5 | none | 3/3 | yes | 0.1038 |
| scoped-fix | claude-opus-5-5 | rules | 3/3 | yes | 0.1504 |
| scoped-fix | claude-opus-5-5 | rules+hooks | 3/3 | yes | 0.18 |
