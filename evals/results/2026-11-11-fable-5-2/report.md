# Fable 5.2 round: architect model and advisor

Plan: `evals/README.md`, "Planned: Fable 5.2 round". Cases `arch-money-storage`, `arch-soft-delete`, `arch-multi-tenancy` (the three on which the architect raised the pass rate in October). Main session Sonnet 5.5, Claude Code 2.1.322. Scored with the case graders; failing runs re-read with the October ladder's lenient reading of "hard to reverse".

## Results

| Cell | Setup | Runs | Pass | Weighs alternatives | Mean cost | Mean time |
|---|---|---|---|---|---|---|
| E | Rules only, no architect, no advisor | 9 | 6/9 (7/9 lenient) | 8/9 | $0.22 | 33 s |
| A | Architect on Opus 5.5, `high` | 9 | 9/9 | 9/9 | $0.73 | 187 s |
| check-B | Architect on Fable 5.2, `high` | 1 | 1/1 | 1/1 | $2.08 | 357 s |
| check-D | Rules only, Fable 5.2 as advisor | 1 | 1/1 | 1/1 | $0.27 | 56 s |
| October | Architect on Fable 5.1, `high` | 18 | 18/18 | 18/18 | $1.10 to $2.40 | 200 to 300 s |

Cells B (8 more runs) and C (Fable at `medium`) were not run: once cell E passed most runs, three runs per cell could not separate Opus from Fable, and our decision rule needs only A against the Fable results above.

## What it shows

- **The architect still helps, less than in October.** Sonnet alone missed in 2 of 9 runs on the lenient reading: one ADR named nothing hard to reverse, one weighed no alternatives. In October the same arm left alternatives out in 6 of 18. With the architect, on either model, every run passed.
- **Opus 5.5 does the architect's job as well as Fable on these cases**, at about a third of the cost per run and half the time. Under the round's rule (Opus matching Fable within one run), the architect moves to Opus 5.5 at `high`.
- **The advisor is used only when the session chooses to.** In check-D Sonnet had Fable available and never consulted it; a separate probe that asked it to consult the advisor showed the advisor working (`server_tool_use` named `advisor`, Fable in `modelUsage`, $0.23 for one consultation). On these cases the advisor adds nothing.

## Limits

- Three runs per cell, and the October Fable figures come from Fable 5.1 on Claude Code of that time.
- These cases fit in a few short files and are graded on the ADR's form. They do not test the work Anthropic names as Fable's strength (long, many-source design). A harder new-project case modelled on a multi-component pipeline is the next step before concluding that Fable has no place in rfr.

## Cost

About $11 at API prices: cell A $6.60, cell E $1.94, check-B $2.08, check-D $0.27, the advisor probe $0.27.
