# units

Small unit-conversion helpers used by the reporting service.

## Commands

- Verify: `npm run verify`. It runs the tests and `scripts/lint.mjs`. Run it before you report a change as done.

## Layout

- `src/`: one module per kind of unit.
- `tests/`: one test file per module, run with `node --test`. The lint fails when an exported function is not named in its module's test file.
