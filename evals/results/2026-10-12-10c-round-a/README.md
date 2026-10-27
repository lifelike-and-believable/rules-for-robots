# 10c round A: software-architect and tech-lead

Cases `arch-money-storage`, `arch-reuse-event-bus`, `lead-plan-order`, `lead-check-claim`. Arms `rules` (the main session alone) and `rules+agents` (the main session told to use the case's agent). Main-session models `claude-sonnet-5-5` and `claude-opus-5-5`, 3 runs per cell, 48 runs. Claude Code 2.1.296. Raw runs: `../2026-10-12-10c-round-a-baseline/` and `../2026-10-12-10c-round-a-agents/` (transcripts are not committed). Scores below come from `node evals/regrade.mjs <dir>` with the graders as committed.

## Results

| Case | Agent | `rules` | `rules+agents` |
|---|---|---|---|
| `arch-money-storage` | software-architect (Fable 5.1) | 4/6 | 6/6 |
| `arch-reuse-event-bus` | software-architect | 6/6 | 6/6 |
| `lead-plan-order` | tech-lead (Opus) | 6/6 | 6/6 |
| `lead-check-claim` | tech-lead | 6/6 | 6/6 |

The two baseline failures on `arch-money-storage` (one per model) were the `options` check: the ADR weighed no alternatives, or one in passing.

Time per run, mean: `arch-money-storage` 55 s against 388 s (7.1 times), `arch-reuse-event-bus` 31 s against 230 s (7.4 times), `lead-check-claim` 20 s against 52 s (2.6 times), `lead-plan-order` 42 s against 106 s (2.5 times). Total run time 15 minutes against 78. The subscription makes dollars moot; the delay is the cost.

## What the architect added, beyond the pass count

On `arch-money-storage`, six ADRs each (written files only):

| | `rules` | `rules+agents` |
|---|---|---|
| Mean ADR length | 5,843 characters | 14,866 characters |
| Names the SQLite version limit on dropping a column | 0 of 6 | 6 of 6 |
| JPY has no minor unit, stated | 4 of 6 | 6 of 6 |
| Raises the open question about existing rows' currency | 5 of 6 | 4 of 6 |
| Over-refund rule | 6 of 6 | 5 of 6 |

The architect probed the installed SQLite in a scratch file before writing, which is where the version limit came from. It did not do better on the open question the baseline already found.

## Caveats

- Three runs per cell, and one case separates the arms (4/6 against 6/6). That is weak evidence; two of the four cases are at ceiling for both arms and say nothing about the agents.
- The graders were corrected after the runs, once transcripts showed they were scoring formats and not substance. The fixes (the `options` words, reading "work package", task tables, `T1` and `S1` labels, ignoring decision lists, stretch-marked extras, `code` in a reviewers column) were applied to both arms by re-grading the saved transcripts. As first run, `lead-plan-order` scored 0 of 6 on the baseline and 3 of 6 with the agent, which was the parser, not the models. Graders tuned on the results they score deserve suspicion; read the transcripts before relying on any number here.
- The baseline arm has no plugin, so the main session cannot call `web-engineer` or `code-reviewer`; several baseline plans said so and named `general-purpose`. The `lead-plan-order` owner check accepts either.
- `tech-lead` shows no difference on these cases (12 of 12 against 12 of 12). The cases are too easy to say whether it helps; a harder case is needed before keeping or dropping it.

## Against the spec's keep rule

Keep an agent if it raises the pass rate on at least one of its two cases, lowers it on neither, and costs no more than twice the baseline's mean. The architect meets the first two (one case up, none down) and exceeds the third on time (about 7 times). The tech lead meets neither the first nor the third. The cost limit was written in dollars; on a subscription the question is whether the time is worth the thoroughness. That is the maintainer's call, not a result of this round.
