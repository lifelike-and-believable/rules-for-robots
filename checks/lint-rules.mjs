#!/usr/bin/env node
// Lints rule files against docs/rule-format.md.
// Usage: node checks/lint-rules.mjs [rules-dir] [--adopting-repo | --allow-waivers] [--no-practice-links]
// --adopting-repo validates an adopting repo's .claude/rules/: waivers plus project rules
// (scope: project, in project/, with the project's own ID prefix).
// When evals/ledger.json sits beside the rules folder (this repository), each rule's
// evaluated-on field is compared with the ledger's effective verdicts; a mismatch is a
// warning, not a failure (docs/specs/model-adaptation.md, AC-6).
import fs from 'node:fs';
import path from 'node:path';
import { evaluatedOnWarnings, readLedger } from './lib/ledger.mjs';
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

const ledgerFile = path.resolve(path.dirname(root), 'evals', 'ledger.json');
if (fs.existsSync(ledgerFile)) {
  for (const { file, warning } of evaluatedOnWarnings(results, readLedger(ledgerFile))) {
    console.error(`warning: ${path.relative(process.cwd(), file)}: ${warning}`);
  }
}

if (failures) {
  console.error(`\n${failures} problem(s) in ${results.length} rule file(s).`);
  process.exit(1);
}
console.log(`${results.length} rule file(s) OK.`);
