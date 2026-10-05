# Handoff

## Current state

- `node src/cli.js <export.csv>` prints totals by category (v0.3.0).
- CSV parsing handles quoted fields and the trailing blank line in the bank's export.

## Open items

- None.

## Needs a live test

- Run against a full-year export from the bank's website and compare the category totals with the accountant's spreadsheet.

## Decisions

- Amounts are stored as integer cents to avoid floating-point drift.
- No npm dependencies; Node 22 built-ins only.

## Lessons

- The bank's export ends with a blank line; the parser skips empty lines.
