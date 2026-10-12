#!/usr/bin/env node
// CI guard for TEST-001 (R26): fail when a change modifies existing tests, snapshots, or
// visual baselines together with implementation code, unless a reviewer has approved it
// (the workflow passes --approved when the PR carries the tests-reviewed label).
// Adding new test files is always allowed.
// Usage: node test-change-guard.mjs <base-ref> [--approved]
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TEST_FILE = /\.(test|spec)\.[^/]+$/;
const TEST_DIR = /(^|\/)(test|tests|Tests|__tests__|__snapshots__|e2e)\//;
// Unreal test modules (Source/<Name>Tests/) and test files (*Tests.cpp, *Test.cpp, *Spec.cpp).
const UNREAL_TEST = /(^|\/)Source\/(\w+Tests\/|.*\w(Tests?|Spec)\.(cpp|h)$)/;
const BASELINE = /(-snapshots\/|\.snap$|__screenshots__\/|\.png$)/;
const IGNORED = /^(\.github\/|docs\/|README|CHANGELOG|AGENTS\.md|CLAUDE\.md|\.claude\/)/;

export function isTestOrBaseline(file) {
  return TEST_FILE.test(file) || TEST_DIR.test(file) || UNREAL_TEST.test(file) || BASELINE.test(file);
}

// changes: [{ status: 'A'|'M'|'D'|'R', file }]
export function evaluate(changes) {
  const modifiedTests = changes.filter(c => c.status !== 'A' && isTestOrBaseline(c.file)).map(c => c.file);
  const implementation = changes.filter(c => !isTestOrBaseline(c.file) && !IGNORED.test(c.file)).map(c => c.file);
  return { flagged: modifiedTests.length > 0 && implementation.length > 0, modifiedTests, implementation };
}

function main() {
  const [base] = process.argv.slice(2);
  const approved = process.argv.includes('--approved');
  const diff = spawnSync('git', ['diff', '--name-status', '--no-renames', `${base}...HEAD`], { encoding: 'utf8' });
  if (diff.status !== 0) { console.error(diff.stderr); process.exit(2); }
  const changes = diff.stdout.split('\n').filter(Boolean).map(l => { const [status, file] = l.split('\t'); return { status: status[0], file }; });
  const { flagged, modifiedTests } = evaluate(changes);
  if (!flagged) { console.log('test-change-guard: OK'); return; }
  const list = modifiedTests.map(f => `  ${f}`).join('\n');
  if (approved) { console.log(`test-change-guard: existing tests changed with implementation, approved by label:\n${list}`); return; }
  console.error(`test-change-guard: this change modifies existing tests or baselines together with implementation code (TEST-001):\n${list}\nA reviewer should confirm the test changes are intended, then add the "tests-reviewed" label.`);
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
