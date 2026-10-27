# 10c first cells: arch-money-storage, one run each

Claude Code 2.1.296. Main session `claude-sonnet-5-5`. One run per arm, so these show that the harness works, not whether the agent helps.

| Arm | Directory | Grader result as run | Time | Notes |
|---|---|---|---|---|
| `rules+agents` | `2026-10-12-10c-cell/` | pass | about 5 minutes | The main session called `rfr-core:software-architect`. `modelUsage` shows `claude-fable-5-1` ran, so the pinned ID is accepted by the plugin. Sonnet (main session) used 1,790 output tokens, Fable 21,420. |
| `rules` | `2026-10-12-10c-cell-baseline/` | fail on `options` only | 48 seconds | The main session wrote the ADR itself. |

## The baseline failure was the grader

The `options` check wanted the words "option" or "alternative" at least twice. The baseline ADR (4,859 characters, written to `docs/adr/0002-store-money-as-integer-minor-units.md`) has an "Alternatives rejected" section with one rejected alternative, so the words appeared once. It passed every other check, including the JPY exponent, expand and contract migration, the refunds table, and an open question the business must answer (which currency the existing rows have). Read as a human, it weighed options.

The check now counts option, alternative, rejected, considered, "instead of", and "rather than" at least twice (`evals/cases/arch-money-storage/grade.mjs`, with a test). With that check the baseline run would have passed.

## What the cells show

- The harness, the `rules+agents` arm, the Fable pin, and the grader's agent-called check all work.
- On this case a single run of each arm gives the same pass result. The agent arm took about six times as long as the baseline. The case may be too easy to separate the arms; the three-run cells will show whether the pass rates differ, and the transcripts are the place to look for differences in the ADR's content (open questions found, hard-to-reverse steps named).
- Per-run cost in dollars is not relevant on a subscription; time and session limits are. The agent arm is slow because the architect works at high effort on Fable.
