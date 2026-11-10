# logbook

A small command-line tool for a climbing gym's route-setting log. It reads a CSV of sessions and prints reports for the head setter.

## Commands

- Verify: `npm run verify`
- Run: `node src/cli.js report data/sessions.csv`

## Layout

- `src/sessions.js`: CSV parsing.
- `src/report.js`: the report.
- `src/cli.js`: entry point and argument handling.
- `test/`: unit tests (`node --test`).

Read `docs/preferences.md` before design, interface, or documentation work, and add to it when the project lead corrects something.
