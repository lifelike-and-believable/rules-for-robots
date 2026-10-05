#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './args.js';
import { listCommand } from './list.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const opts = parseArgs(process.argv.slice(2));

if (opts.command === 'list') {
  const products = JSON.parse(fs.readFileSync(path.join(root, 'data/products.json'), 'utf8'));
  console.log(listCommand(products, opts));
} else {
  console.log('usage: shop list [--category <name>]');
}
