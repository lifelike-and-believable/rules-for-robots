import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, isTestOrBaseline } from '../checks/ci/test-change-guard.mjs';

test('classifies tests and baselines', () => {
  for (const f of ['src/a.test.ts', 'tests/x.py', 'e2e/home.spec.ts', 'e2e/home.spec.ts-snapshots/home-chromium.png', 'src/__snapshots__/a.snap', 'Source/My/Private/Tests/Spec.cpp']) assert.ok(isTestOrBaseline(f), f);
  for (const f of ['src/a.ts', 'src/latest.ts', 'Source/My/Private/My.cpp']) assert.ok(!isTestOrBaseline(f), f);
});

test('flags modified tests together with implementation', () => {
  assert.equal(evaluate([{ status: 'M', file: 'src/a.ts' }, { status: 'M', file: 'src/a.test.ts' }]).flagged, true);
  assert.equal(evaluate([{ status: 'D', file: 'tests/old.test.js' }, { status: 'M', file: 'src/a.ts' }]).flagged, true);
});

test('allows new tests, test-only changes, and implementation-only changes', () => {
  assert.equal(evaluate([{ status: 'M', file: 'src/a.ts' }, { status: 'A', file: 'src/a.test.ts' }]).flagged, false);
  assert.equal(evaluate([{ status: 'M', file: 'src/a.test.ts' }]).flagged, false);
  assert.equal(evaluate([{ status: 'M', file: 'src/a.ts' }]).flagged, false);
  assert.equal(evaluate([{ status: 'M', file: 'src/a.test.ts' }, { status: 'M', file: 'README.md' }, { status: 'M', file: '.github/workflows/ci.yml' }]).flagged, false);
});
