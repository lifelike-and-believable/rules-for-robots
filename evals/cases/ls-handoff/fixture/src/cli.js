#!/usr/bin/env node
import fs from 'node:fs';
import { parseCsv } from './parse.js';
import { summarize, formatSummary } from './summary.js';

const file = process.argv[2];
if (!file) {
  console.error('usage: ledger <export.csv>');
  process.exit(2);
}
console.log(formatSummary(summarize(parseCsv(fs.readFileSync(file, 'utf8')))));
