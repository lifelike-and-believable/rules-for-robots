#!/usr/bin/env node
// Lints rule files against docs/rule-format.md.
// Usage: node checks/lint-rules.mjs [rules-dir] [--adopting-repo | --allow-waivers] [--no-practice-links]
// --adopting-repo validates an adopting repo's .claude/rules/: waivers plus project rules
// (scope: project, in project/, with the project's own ID prefix).
import path from 'node:path';
import { checkPracticeLinks, validateTree } from './lib/rules.mjs';

const args = process.argv.slice(2);
const adoptingRepo = args.includes('--adopting-repo');
const allowWaivers = adoptingRepo || args.includes('--allow-waivers');
const root = path.resolve(args.find(a => !a.startsWith('--')) ?? 'rules');

const results = validateTree(root, { allowWaivers, adoptingRepo });
let failures = 0;
for (const { file, errors } of results) {
  for (const error of errors) {
    failures++;
    console.error(`${path.relative(process.cwd(), file)}: ${error}`);
  }
}

if (!args.includes('--no-practice-links')) {
  for (const { file, error } of checkPracticeLinks(results, path.resolve(path.dirname(root), 'practices'))) {
    failures++;
    console.error(`${path.relative(process.cwd(), file)}: ${error}`);
  }
}

if (failures) {
  console.error(`\n${failures} problem(s) in ${results.length} rule file(s).`);
  process.exit(1);
}
console.log(`${results.length} rule file(s) OK.`);
