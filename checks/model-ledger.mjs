#!/usr/bin/env node
// Model evidence ledger (docs/specs/model-adaptation.md, AC-4 and AC-5).
//
//   node checks/model-ledger.mjs add <results folder> [--date YYYY-MM-DD]
//     Adds entries from an eval run (runs-corrected.json or runs.json) or a smoke run
//     (smoke.json), replacing earlier entries for the same subject and model.
//   node checks/model-ledger.mjs report <model> [--since <model>] [--json]
//     Lists each rule's verdict and evidence on the model, the rules with no entry, the
//     agents and skills, and the saturated cases. --since compares with an earlier model.
//
// Options: --ledger <file> (default evals/ledger.json), --rules <dir> (default rules),
// --cases <dir> (default evals/cases). The report never fails: it exits 0 whatever it
// finds. Usage errors exit 2.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compare, entriesFromRuns, entriesFromSmoke, mergeLedger, readLedger, readResults, report, writeLedger } from './lib/ledger.mjs';
import { listRuleFiles, parseRuleFile } from './lib/rules.mjs';

function option(args, name, fallback = null) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}

function positional(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) { if (args[i] !== '--json') i++; continue; }
    out.push(args[i]);
  }
  return out;
}

function caseRules(casesDir) {
  const map = {};
  if (!fs.existsSync(casesDir)) return map;
  for (const name of fs.readdirSync(casesDir)) {
    const file = path.join(casesDir, name, 'case.json');
    if (fs.existsSync(file)) map[name] = JSON.parse(fs.readFileSync(file, 'utf8')).rules ?? [];
  }
  return map;
}

function ruleList(rulesDir) {
  return listRuleFiles(rulesDir)
    .map(parseRuleFile)
    .filter(r => r.meta?.id && !r.meta.waiver)
    .map(r => ({ id: r.meta.id, level: r.meta.level }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function addResults(folder, { ledgerFile, casesDir, date, root = process.cwd() }) {
  const found = readResults(folder);
  if (!found) return { error: `no runs-corrected.json, runs.json, or smoke.json in ${folder}` };
  const results = path.relative(root, path.resolve(folder)).split(path.sep).join('/');
  const day = date ?? /^\d{4}-\d{2}-\d{2}/.exec(path.basename(path.resolve(folder)))?.[0] ?? new Date().toISOString().slice(0, 10);
  const added = found.kind === 'smoke'
    ? entriesFromSmoke(found.records, { results, date: day })
    : entriesFromRuns(found.records, caseRules(casesDir), { results, date: day });
  writeLedger(ledgerFile, mergeLedger(readLedger(ledgerFile), added));
  return { added, file: found.file };
}

export function formatReport(r, changes, since) {
  const lines = [`Model: ${r.model}`, ''];
  lines.push(`Rules with evidence (${r.rules.length}):`);
  for (const x of r.rules) {
    const ev = x.evidence.map(e => `${e.case} none ${e.none ?? '-'} rules ${e.rules ?? '-'}`).join('; ');
    lines.push(`  ${x.id} (${x.level}): ${x.verdict} [${ev}] ${x.results}`);
  }
  lines.push('', `Rules with no entry (${r.untested.length}): ${r.untested.map(x => x.id).join(', ') || 'none'}`);
  lines.push('', `Agents and skills (${r.others.length}):`);
  for (const x of r.others) lines.push(`  ${x.subject}: ${x.verdict} ${x.results}`);
  lines.push('', `Saturated cases (${r.saturated.length}): ${r.saturated.map(c => `${c.case} (none ${c.none})`).join(', ') || 'none'}`);
  if (since) {
    lines.push('', `Changed since ${since} (${changes.length}):`);
    for (const c of changes) lines.push(`  ${c.subject}: ${c[since]} -> ${c[r.model]}`);
  }
  return lines.join('\n') + '\n';
}

function main() {
  const args = process.argv.slice(2);
  const [command, target] = positional(args);
  const ledgerFile = option(args, '--ledger', 'evals/ledger.json');
  if (command === 'add' && target) {
    const out = addResults(target, { ledgerFile, casesDir: option(args, '--cases', 'evals/cases'), date: option(args, '--date') });
    if (out.error) { console.error(out.error); process.exit(2); }
    console.log(`${ledgerFile}: ${out.added.entries.length} entr${out.added.entries.length === 1 ? 'y' : 'ies'} and ${out.added.cases.length} case record(s) from ${target}/${out.file}`);
    for (const e of out.added.entries) console.log(`  ${e.subject} on ${e.model}: ${e.verdict}`);
    return;
  }
  if (command === 'report' && target) {
    const ledger = readLedger(ledgerFile);
    const r = report(ledger, ruleList(option(args, '--rules', 'rules')), target);
    const since = option(args, '--since');
    const changes = since ? compare(ledger, since, target) : [];
    if (args.includes('--json')) console.log(JSON.stringify(since ? { ...r, since, changes } : r, null, 2));
    else process.stdout.write(formatReport(r, changes, since));
    return;
  }
  console.error('usage: model-ledger.mjs add <results folder> [--date YYYY-MM-DD] | report <model> [--since <model>] [--json]');
  process.exit(2);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
