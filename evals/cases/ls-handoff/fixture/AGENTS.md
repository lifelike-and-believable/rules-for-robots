# ledger

A small command-line tool that reads our bank's CSV export and prints reports for the accountant.

## Commands

- Verify: `npm run verify`
- Run: `node src/cli.js data/sample.csv`

## Layout

- `src/parse.js`: CSV, date, and amount parsing. Amounts are integer cents everywhere.
- `src/summary.js`: totals by category.
- `src/cli.js`: entry point.
- `test/`: unit tests (`node --test`).
- Session notes: `docs/handoff.md`.
