#!/usr/bin/env node
// Lints rule files against docs/rule-format.md.
// Usage: node checks/lint-rules.mjs [rules-dir] [--allow-waivers]
import path from 'node:path';
import { validateTree } from './lib/rules.mjs';

const args = process.argv.slice(2);
const allowWaivers = args.includes('--allow-waivers');
const root = path.resolve(args.find(a => !a.startsWith('--')) ?? 'rules');

const results = validateTree(root, { allowWaivers });
let failures = 0;
for (const { file, errors } of results) {
  for (const error of errors) {
    failures++;
    console.error(`${path.relative(process.cwd(), file)}: ${error}`);
  }
}

if (failures) {
  console.error(`\n${failures} problem(s) in ${results.length} rule file(s).`);
  process.exit(1);
}
console.log(`${results.length} rule file(s) OK.`);
