Starting the monthly report today. It's four parts:

1. `parseDate` also accepts the bank's new `DD/MM/YYYY` dates (ISO still has to work).
2. `groupByMonth(transactions)` in a new `src/monthly.js`, returning `{ 'YYYY-MM': [transactions] }`.
3. `monthlyTotals(groups)` returning `{ 'YYYY-MM': cents }`, plus a formatter that prints one line per month, oldest first, like `2026-01   1852.05`.
4. A `--monthly` flag: `node src/cli.js --monthly data/sample.csv` prints that table.

Do 1 and 2 now, with tests.
