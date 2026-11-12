#!/usr/bin/env node
// CI guard for TEST-001 (R26): fail when a change modifies existing tests, snapshots, or
// visual baselines together with implementation code, unless a reviewer has approved it
// (the workflow passes --approved when the PR carries the tests-reviewed label).
// Adding new test files is always allowed. The label approves the code it was added for: on a
// run started by a push (event action `synchronize`, passed as --event synchronize) a label that was
// already there does not count, so the new commits are reviewed and the label added again
// (test-change-review AC-10).
// Usage: node test-change-guard.mjs <base-ref> [--approved] [--event <pull_request action>]
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isTestOrBaseline } from '../lib/test-paths.mjs';

const IGNORED = /^(\.github\/|docs\/|README|CHANGELOG|AGENTS\.md|CLAUDE\.md|\.claude\/)/;

export { isTestOrBaseline };

// changes: [{ status: 'A'|'M'|'D'|'R', file }]
export function evaluate(changes) {
  const modifiedTests = changes.filter(c => c.status !== 'A' && isTestOrBaseline(c.file)).map(c => c.file);
  const implementation = changes.filter(c => !isTestOrBaseline(c.file) && !IGNORED.test(c.file)).map(c => c.file);
  return { flagged: modifiedTests.length > 0 && implementation.length > 0, modifiedTests, implementation };
}

// Whether the tests-reviewed label approves this run's code: not when the run was started by a push,
// because the label was added for the commits before it.
export function labelApproves({ labelled, event }) {
  return Boolean(labelled) && event !== 'synchronize';
}

function main() {
  const [base] = process.argv.slice(2);
  const eventAt = process.argv.indexOf('--event');
  const event = eventAt > 0 ? process.argv[eventAt + 1] : null;
  const labelled = process.argv.includes('--approved');
  const approved = labelApproves({ labelled, event });
  const diff = spawnSync('git', ['diff', '--name-status', '--no-renames', `${base}...HEAD`], { encoding: 'utf8' });
  if (diff.status !== 0) { console.error(diff.stderr); process.exit(2); }
  const changes = diff.stdout.split('\n').filter(Boolean).map(l => { const [status, file] = l.split('\t'); return { status: status[0], file }; });
  const { flagged, modifiedTests } = evaluate(changes);
  if (!flagged) { console.log('test-change-guard: OK'); return; }
  const list = modifiedTests.map(f => `  ${f}`).join('\n');
  if (approved) { console.log(`test-change-guard: existing tests changed with implementation, approved by label:\n${list}`); return; }
  const next = labelled
    ? 'The "tests-reviewed" label was added before the latest push, so it does not cover the new commits. Review them (/rfr-core:review-pr runs the test-change reviewer), then remove the label and add it again.'
    : 'A reviewer should confirm the test changes are intended, then add the "tests-reviewed" label.';
  console.error(`test-change-guard: this change modifies existing tests or baselines together with implementation code (TEST-001):\n${list}\n${next}`);
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
