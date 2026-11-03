#!/usr/bin/env node
// Runs Stryker on an eval case's fixture and lists the mutants its tests let survive, for the Phase 10
// comparison of mutation testing with the review-pr sabotage step (docs/specs/project-process.md,
// research finding 1). Free and deterministic: no model is called.
//
//   node evals/stryker-compare.mjs [case]      (default: spec-vacuous-tests)
//
// Writes nothing in the repository: the fixture is copied to a temporary folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2] ?? 'spec-vacuous-tests';
const fixture = path.join(ROOT, 'evals', 'cases', name, 'fixture');
if (!fs.existsSync(fixture)) { console.error(`No fixture for case ${name}`); process.exit(2); }

const dir = fs.mkdtempSync(path.join(os.tmpdir(), `rfr-stryker-${name}-`));
fs.cpSync(fixture, dir, { recursive: true });
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'), 'junction');
fs.writeFileSync(path.join(dir, 'stryker.config.mjs'), `export default {
  testRunner: 'command', commandRunner: { command: 'node --test' },
  mutate: ['src/**/*.js'], reporters: ['json'], jsonReporter: { fileName: 'mutation.json' },
  tempDirName: '.stryker-tmp', plugins: [],
};
`);
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const r = spawnSync(process.execPath, [path.join(ROOT, 'node_modules', '@stryker-mutator', 'core', 'bin', 'stryker.js'), 'run'],
  { cwd: dir, encoding: 'utf8', env });
const report = path.join(dir, 'mutation.json');
if (r.status !== 0 || !fs.existsSync(report)) { console.error(r.stdout + r.stderr); process.exit(1); }

const { files } = JSON.parse(fs.readFileSync(report, 'utf8'));
let killed = 0;
const survived = [];
for (const [file, { source, mutants }] of Object.entries(files)) {
  const lines = source.split('\n');
  for (const m of mutants) {
    if (m.status === 'Killed' || m.status === 'Timeout') killed++;
    else survived.push({ file, line: m.location.start.line, mutator: m.mutatorName, status: m.status, code: lines[m.location.start.line - 1].trim() });
  }
}
const total = killed + survived.length;
console.log(`${name}: ${killed} of ${total} mutants killed (score ${total ? (100 * killed / total).toFixed(1) : '0'}%).`);
for (const s of survived) console.log(`  ${s.status} ${s.mutator} at ${s.file}:${s.line}  ${s.code}`);
fs.rmSync(dir, { recursive: true, force: true });
