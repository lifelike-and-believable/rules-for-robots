#!/usr/bin/env node
// shelf: a reading list on the command line.
//   node src/cli.mjs list [--books <file>]
import { loadBooks, listLines } from './shelf.mjs';

const args = process.argv.slice(2);
const command = args[0];
const option = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const booksFile = option('--books') ?? 'data/books.json';

if (command === 'list') {
  for (const line of listLines(loadBooks(booksFile))) console.log(line);
} else {
  console.error('usage: node src/cli.mjs list [--books <file>]');
  process.exit(2);
}
