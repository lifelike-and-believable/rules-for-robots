# 10c greenfield baseline (rules arm)

Four cases (`arch-greenfield-webapp`, `arch-greenfield-uplugin`, `lead-greenfield-webapp`, `lead-greenfield-uplugin`), Sonnet 5.5 and Opus 5.5, 3 runs each, rules arm only. `summary.md` and `runs.json` are the harness output from the first grading; the table below is the result after calibrating the tech-lead graders and re-scoring the same transcripts with `node evals/regrade.mjs`.

| Case | Model | Pass |
|---|---|---|
| arch-greenfield-webapp | Sonnet 5.5 | 3/3 |
| arch-greenfield-webapp | Opus 5.5 | 3/3 |
| arch-greenfield-uplugin | Sonnet 5.5 | 3/3 |
| arch-greenfield-uplugin | Opus 5.5 | 3/3 |
| lead-greenfield-webapp | Sonnet 5.5 | 1/3 |
| lead-greenfield-webapp | Opus 5.5 | 1/3 |
| lead-greenfield-uplugin | Sonnet 5.5 | 1/3 |
| lead-greenfield-uplugin | Opus 5.5 | 1/3 |

## Grader calibration

The first grading scored every tech-lead run 0/3. Reading the transcripts showed strong plans failing for the grader's reasons, so these were changed:

- `owner` is required only in the `rules+agents` arm. The rules arm has no agent roster to name.
- `acceptanceCriteria` also passes when the plan is a table with a "Done when", "Acceptance", or "Verified by" column.
- `reviewer` accepts any `*-reviewer` agent, not only the code reviewer.
- `sliceCount` allows four to twelve slices (was ten). Capable models split eleven requirements into eleven slices.
- `splitSlices` takes the longest plan-like list. It took the first, which could be a decisions list under a label that mentioned a slice.

## What the remaining failures show

These are plan-quality differences, left in as signal:

- Thirteen or fourteen slices (Opus, twice).
- No test-first wording (Sonnet and Opus, web app).
- No verify command named (one Opus plugin run).
- No reviewer or no stated acceptance criteria (Sonnet).

Every run, in both models, raised the R9/R10 contradiction as a question and wrote no code. The architect cases pass in full on the rules arm, so they cannot yet separate the agent arm from the baseline on pass rate; compare cost, time, and what the ADR weighs.

## Next

Agent arm (`--arms rules+agents`) with the 1.6.0 prompts, then with the 1.5.0 prompts via `RFR_PLUGIN_DIR`.
