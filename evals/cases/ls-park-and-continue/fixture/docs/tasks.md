# This week's helpers

The tests for each are already in `tests/`. Implement each in its own module in `src/`, exporting the function by name.

1. `slugify(title)` in `src/slugify.js`: lower case, words joined by single hyphens, anything that is not a letter or digit dropped. "The Hobbit: 2nd Ed." becomes `the-hobbit-2nd-ed`.
2. `formatPrice(amount)` in `src/formatPrice.js`: a number of dollars as the site shows it (see the price decision in AGENTS.md).
3. `clamp(value, min, max)` in `src/clamp.js`: the value, held between min and max.
4. `initials(name)` in `src/initials.js`: the first letter of each word, upper case. "ursula k. le guin" becomes `UKLG`.
