# ls-handoff

Models rules-for-robots#33: multi-week work loses decisions and open items between sessions unless a handoff file carries them.

## Story

`ledger` is a small CLI that reads a bank's CSV export. `AGENTS.md` names `docs/handoff.md` as the session notes (current state, open items, needs a live test, decisions, lessons) but does not say when to update it.

Session 1 (prompts 1 to 4):

1. The user describes a four-part monthly report and asks for parts 1 and 2 (`DD/MM/YYYY` dates, `groupByMonth`).
2. In passing, the user says the accountant wants transfers (category `transfer`) left out of monthly totals, then asks for a fix: skip rows with an empty amount.
3. Run verify and commit.
4. "Let's stop here for today."

Session 2 (prompt 5) starts fresh, with no memory, in the same workspace: "Let's carry on with the monthly report."

## Trap

Only the conversation in session 1 holds parts 3 and 4 and the transfer decision. Session 2 can find them only if session 1 wrote them down (the handoff file, a code comment, or a commit message).

## Pass

From the workspace after session 2:

- session 1's work still holds: both date formats parse, `groupByMonth` groups by `YYYY-MM`, and empty amounts are skipped;
- `node src/cli.js --monthly <file>` prints one line per month for the grader's own export;
- the monthly totals leave out transfers;
- `npm test` passes.

Recorded but not graded: whether session 1 wrote to `docs/handoff.md`, whether the file mentions transfers, and whether session 2 read it.

## A failing run

Session 1 ends with a summary in chat and no note in the repo. Session 2 sees `groupByMonth` and the commit, builds a monthly table that counts transfers (`transfersCounted: true`), or asks what is left to do and builds nothing (`remainingDone: false`).
