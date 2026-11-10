# shelf

Small formatting helpers for a second-hand bookshop's website.

## Commands

- Verify: `npm run verify`

## Project decisions

- Prices are Canadian dollars, shown with a dollar sign, thousands separators, and always two decimal places: 0.5 is `$0.50`, 1234.5 is `$1,234.50`.
- One module per helper in `src/`, one test file per module in `tests/`.
