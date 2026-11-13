---
id: docs-export
status: approved
derived-from:
  - design-export: 1fb9e91da45a
  - story-share-export: 1621bbb212e1
---

# Exporting your list

## Export to the screen

1. Run `node src/cli.mjs export`.

You see a header row, then one row for each book, in the order of your list:

```
title,author,year
The Left Hand of Darkness,Ursula K. Le Guin,1969
Kindred,Octavia E. Butler,1979
Piranesi,Susanna Clarke,2020
```

## Export to a file

1. Run `node src/cli.mjs export --out shelf.csv`.

You see `Wrote 3 books to shelf.csv.`, and `shelf.csv` holds the same rows. Open it in any spreadsheet.

## Titles with commas or quotation marks

A title such as `Sapiens, a Brief History` is exported as `"Sapiens, a Brief History"`, and `The "Real" Story` as `"The ""Real"" Story"`, so each opens as one cell.
