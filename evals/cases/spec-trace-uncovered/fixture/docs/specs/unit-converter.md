---
status: approved
---

# Unit converter

## Acceptance criteria
| # | Criterion | Verified by |
|---|---|---|
| AC-1 | `convert(10, 'km', 'mi')` returns 6.21: results are rounded to two decimals. | test: converts km to miles |
| AC-2 | `convert` throws a `RangeError` that names the unit when a unit is unknown. | test: rejects unknown units |
| AC-3 | `convert(0, 'km', 'mi')` returns 0 and a negative value keeps its sign. | test: zero and negative values |
| AC-4 | The command `node bin/convert.js <value> <from> <to>` prints the result and exits with code 2 when a unit is unknown. | test: runs the command and checks its output and exit code |

## Scope
- In: `src/convert.js` and `bin/convert.js`.
- Out: other units than m, km, mi, and ft.
