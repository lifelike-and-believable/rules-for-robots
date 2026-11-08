#!/usr/bin/env node
// Release checks (Phase 9): CHANGELOG.md has an Unreleased section, its releases are in
// descending order without duplicates, and the newest release matches the rfr-core
// plugin version. Each release after 4.0.0 has an "Evaluated on:" line naming the models of
// the newest ledger run, each of which has entries in evals/ledger.json
// (docs/specs/model-adaptation.md, AC-10).
// Usage: node checks/release.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const RELEASE = /^## \[(\d+)\.(\d+)\.(\d+)\]/gm;

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
// The last release before the "Evaluated on:" line was required.
export const EVALUATED_ON_SINCE = [4, 0, 0];

// The models a release names on its "Evaluated on:" line, or null when it has none.
export function evaluatedOn(section) {
  const line = /^Evaluated on: *(.*)$/m.exec(section)?.[1];
  if (line === undefined) return null;
  return line.replace(/[`.]+$/, '').split(/[,;]|\band\b/).map(m => m.replace(/`/g, '').trim()).filter(Boolean);
}

export function checkEvaluatedOn(text, ledgerModels) {
  const errors = [];
  const sections = text.split(/^(?=## \[)/m);
  for (const section of sections) {
    const m = /^## \[(\d+)\.(\d+)\.(\d+)\]/.exec(section);
    if (!m) continue;
    const version = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (compare(version, EVALUATED_ON_SINCE) <= 0) continue;
    const name = version.join('.');
    const models = evaluatedOn(section);
    if (!models?.length) { errors.push(`release ${name} has no "Evaluated on:" line naming the models of the newest ledger run`); continue; }
    for (const model of models) {
      if (!ledgerModels.has(model)) errors.push(`release ${name} says it was evaluated on ${model}, but evals/ledger.json has no entries for it`);
    }
  }
  return errors;
}

export function checkChangelog(text, pluginVersion) {
  const errors = [];
  if (!/^## \[Unreleased\]/m.test(text)) errors.push('CHANGELOG.md needs an "## [Unreleased]" section');
  const releases = [...text.matchAll(RELEASE)].map(m => [Number(m[1]), Number(m[2]), Number(m[3])]);
  const names = releases.map(r => r.join('.'));
  if (!releases.length) errors.push('CHANGELOG.md has no releases');
  for (let i = 1; i < releases.length; i++) {
    const order = compare(releases[i - 1], releases[i]);
    if (order === 0) errors.push(`duplicate release ${names[i]}`);
    else if (order < 0) errors.push(`releases out of order: ${names[i - 1]} is listed before ${names[i]}`);
  }
  if (releases.length && names[0] !== pluginVersion) {
    errors.push(`plugin version ${pluginVersion} has no changelog entry (newest release is ${names[0]})`);
  }
  return errors;
}

function main() {
  const plugin = JSON.parse(fs.readFileSync('plugins/core/.claude-plugin/plugin.json', 'utf8'));
  const text = fs.readFileSync('CHANGELOG.md', 'utf8');
  const ledger = fs.existsSync('evals/ledger.json') ? JSON.parse(fs.readFileSync('evals/ledger.json', 'utf8')) : { entries: [] };
  const errors = [...checkChangelog(text, plugin.version), ...checkEvaluatedOn(text, new Set(ledger.entries.map(e => e.model)))];
  for (const e of errors) console.error(e);
  if (errors.length) process.exit(1);
  console.log(`CHANGELOG.md matches rfr-core ${plugin.version}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
