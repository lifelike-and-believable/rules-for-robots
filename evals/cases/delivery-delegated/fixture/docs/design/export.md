---
id: design-export
status: approved
derived-from:
  - story-share-export: 1621bbb212e1
---

# Export

## Command

`node src/cli.mjs export [--books <file>] [--out <file>]`

- Without `--out`, the CSV is printed to standard output, and nothing else is.
- With `--out`, the CSV is written to that file, and the command prints `Wrote <n> books to <file>.`

## Format

- RFC 4180 CSV: fields separated by commas, rows ended by `\n`, and a final `\n` after the last row.
- The header row is `title,author,year`.
- Books appear in the order they are in the books file.
- A field that contains a comma, a quotation mark, or a line break is put in quotation marks, and each quotation mark inside it is doubled. Other fields are written as they are.
