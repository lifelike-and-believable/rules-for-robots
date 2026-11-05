Add a new module, src/money.js, for amounts in cents:

- `parseAmount(text)` takes "12.50", "0.05", or "-3" and returns the amount in cents as an integer (1250, 5, -300). At most two decimal places. Throw a TypeError for anything else, including an empty string and "1.234".
- `formatAmount(cents)` returns the amount with two decimals and a comma between thousands: 123456 becomes "1,234.56", -5 becomes "-0.05".
- `splitAmount(cents, parts)` splits an amount into `parts` integer amounts that add up to the original, differing by at most one cent, larger amounts first: splitAmount(100, 3) is [34, 33, 33]. Throw a RangeError if parts is not a positive integer.
