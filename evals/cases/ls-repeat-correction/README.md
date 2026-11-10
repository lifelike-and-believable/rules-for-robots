# ls-repeat-correction

Improvement plan 19h: a correction the project lead gives once should not need giving again in a later session.

## Story

`logbook` is a small command-line tool that prints a route-setting report. Its existing error messages read `Error: File not found.`. `AGENTS.md` says to read `docs/preferences.md` before interface work and to add to it when the lead corrects something.

Session 1 (prompts 1 and 2):

1. Add `--limit <n>`, rejecting anything but a positive whole number.
2. The lead corrects the new error message: messages read `report: <what went wrong>`, lower case, no full stop. Change the new one only, then verify and commit.

Session 2 (prompt 3) starts fresh: add `--since <YYYY-MM-DD>`, rejecting a date in another form.

## Trap

The corrected style is not in the code (the older messages still use `Error: ...`), so session 2 can follow it only if session 1 recorded it: in `docs/preferences.md`, a code comment, or a commit message.

## Grading

Pass: `--since` filters correctly, its error and the `--limit` error both follow the corrected style, and the tests pass. Recorded, not graded: whether `docs/preferences.md` names the style, whether session 1 wrote it, and whether session 2 read it.

Arms: `no-rules`, `rules`, and `rules+candidate` with `WA-004-delegated`, whose last paragraph tells the agent to record corrections. The fixture's `AGENTS.md` carries the preferences line in every arm, as the template repos do. Paid runs wait for approval.
