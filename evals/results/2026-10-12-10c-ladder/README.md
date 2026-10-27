# 10c architect complexity ladder

Cases `arch-soft-delete` (small: four constraints in the repo) and `arch-multi-tenancy` (large: six), on one codebase. Arms `rules` and `rules+agents`, models `claude-sonnet-5-5` and `claude-opus-5-5`, 3 runs per cell, 24 runs. Raw runs: `../2026-10-12-10c-ladder-baseline/` and `../2026-10-12-10c-ladder-agents/`. Scored with `node evals/regrade.mjs <dir>`.

## Results

| | `rules` | `rules+agents` |
|---|---|---|
| Constraints found, small (of 4) | 4 in all 6 runs | 4 in all 6 runs |
| Constraints found, large (of 6) | 6 in all 6 runs | 6 in all 6 runs |
| Cases passed, small | 4/6 | 6/6 |
| Cases passed, large | 4/6 | 6/6 |
| Mean time, small | 39 s | 204 s |
| Mean time, large | 53 s | 292 s |

Read with the earlier `arch-money-storage` cell (round A, 4/6 against 6/6), the architect's effect across three cases is the same each time.

## What the architect changes

- **Discovery: nothing.** Both arms found every constraint planted in the repo, at both sizes. A main session that reads five small files finds a global unique index, an unscoped cache key, a report that sums every row, a nightly job, and a global counter. The constraints were too easy to find to separate the arms.
- **Weighing alternatives: it makes it reliable.** Strict and lenient scoring agree on this. Without the agent, a third of the ADRs (6 of 18 across the three cases) record a decision with no alternatives; the simplest rung produced two such ADRs ("Not decided here" and open questions, but no options). With the agent, 18 of 18 weigh alternatives.
- **Naming what is hard to reverse: no difference once the wording is read generously.** The pass checks used the architect prompt's own phrases ("hard to reverse"), which favoured it. Counting backups, rollback, restore, destructive, and one-way as naming the risk, both arms name it in 6 of 6 large-rung runs (the strict count was 4 of 6 without the agent).
- **Complexity: no signal.** The gap in alternatives is the same at the small and large rung (2 failures of 6 each), so these cases give no evidence that the architect's value grows with size. Discovery was at ceiling at both.
- **Time:** about five times longer at both sizes.

## Caveats

- Three runs per cell, and every difference here is small. The alternatives effect is consistent over three cases and both models, which is better than one case but still 12 runs of evidence on 18.
- The ladder varied the request's scope but not the repository's size. Everything fit in five short files. A repo where the constraints are spread across many files, hidden in history or configuration, or only visible by running something would test discovery and might separate the arms; this one could not.
- The pass checks measure the form of the ADR (alternatives, reversibility, both isolation options). They do not judge whether the chosen design is good. Reading the transcripts for design quality is still a human job.
