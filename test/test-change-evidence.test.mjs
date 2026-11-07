// Tests for the test-change evidence script (docs/specs/test-change-review.md, slice 13b): it runs
// the test cases a change modifies on the head commit, and the head's version of them against the
// base commit's implementation. Each test title cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { changedTestCases } from '../checks/lib/test-diff.mjs';
import { collectEvidence, parseTap, parseJestJson, runnerFor } from '../checks/test-change-evidence.mjs';

function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-evidence-'));
  const git = (...args) => {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  const write = (map) => {
    for (const [file, text] of Object.entries(map)) {
      if (text === null) { fs.rmSync(path.join(root, file)); continue; }
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), text);
    }
    git('add', '-A');
  };
  git('init', '-q', '-b', 'main');
  write({ 'package.json': '{ "type": "module" }\n', ...files });
  git('commit', '-q', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  return { root, base, change: (map, message = 'head') => { write(map); git('commit', '-q', '-m', message); return git('rev-parse', 'HEAD'); } };
}

const SRC = 'export const add = (a, b) => a + b;\n';
const TEST = `import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { add } from '../src/add.mjs';

describe('add', () => {
  test('adds two numbers', () => {
    assert.equal(add(1, 2), 3);
  });

  test('adds zero', () => {
    assert.equal(add(5, 0), 5);
  });
});
`;

test('test-change-review#AC-7: the classifier lists the test cases a change modifies', () => {
  const after = TEST.replace('assert.equal(add(1, 2), 3);', 'assert.equal(add(1, 2), 4);');
  const cases = changedTestCases({ file: 'test/add.test.mjs', before: TEST, after });
  assert.deepEqual(cases.map(c => c.key), ['add > adds two numbers']);
  assert.equal(cases[0].title, 'adds two numbers');
  assert.equal(cases[0].line, 6);
  assert.ok(cases[0].kinds.includes('expected-literal-changed'));
  assert.deepEqual(changedTestCases({ file: 'test/add.test.mjs', before: TEST, after: TEST }), []);
});

test('test-change-review#AC-7: a changed expected value that fails on base and passes on head is reported so', async () => {
  const r = repo({ 'src/add.mjs': SRC, 'test/add.test.mjs': TEST });
  const head = r.change({
    'src/add.mjs': 'export const add = (a, b) => a + b + 1;\n',
    'test/add.test.mjs': TEST.replace('assert.equal(add(1, 2), 3);', 'assert.equal(add(1, 2), 4);').replace('assert.equal(add(5, 0), 5);', 'assert.equal(add(5, 0), 6);'),
  });
  const report = await collectEvidence({ root: r.root, base: r.base, head });
  const one = report.cases.find(c => c.key === 'add > adds two numbers');
  assert.equal(one.file, 'test/add.test.mjs');
  assert.equal(one.runner, 'node');
  assert.equal(one.head, 'pass');
  assert.equal(one.base, 'fail');
  assert.match(one.baseMessage, /3 !== 4|expected/i);
  assert.ok(one.kinds.includes('expected-literal-changed'));
  assert.equal(report.cases.length, 2);
  // The worktrees are removed afterwards.
  const worktrees = spawnSync('git', ['worktree', 'list'], { cwd: r.root, encoding: 'utf8' }).stdout.trim().split('\n');
  assert.equal(worktrees.length, 1);
});

test('test-change-review#AC-7: a changed test that also passes on base is reported so', async () => {
  const r = repo({ 'src/add.mjs': SRC, 'test/add.test.mjs': TEST });
  const head = r.change({ 'test/add.test.mjs': TEST.replace('    assert.equal(add(1, 2), 3);\n', '    assert.equal(add(1, 2), 3);\n    assert.equal(add(0, 0), 0);\n').replace("assert.equal(add(5, 0), 5)", "assert.equal(add(5, 0), 5, 'zero is neutral')") });
  const report = await collectEvidence({ root: r.root, base: r.base, head });
  const zero = report.cases.find(c => c.key === 'add > adds zero');
  assert.equal(zero.head, 'pass');
  assert.equal(zero.base, 'pass');
  // An additive change is still a change to the case: it is run, and has no findings.
  const added = report.cases.find(c => c.key === 'add > adds two numbers');
  assert.equal(added.head, 'pass');
  assert.deepEqual(added.kinds, []);
});

test('test-change-review#AC-7: tests for an unsupported runner are listed as not run, with the reason', async () => {
  const PY = 'from shop.cart import total\n\n\ndef test_total():\n    assert total([1, 2]) == 3\n';
  const AVA = "import test from 'ava';\n\ntest('adds', t => {\n  t.is(1 + 1, 2);\n});\n";
  const r = repo({ 'tests/test_cart.py': PY, 'test/ava.test.mjs': AVA });
  const head = r.change({ 'tests/test_cart.py': PY.replace('== 3', '== 4'), 'test/ava.test.mjs': AVA.replace('t.is(1 + 1, 2)', 't.is(1 + 1, 3)') });
  const report = await collectEvidence({ root: r.root, base: r.base, head });
  assert.equal(report.cases.length, 0);
  assert.deepEqual(report.notRun.map(n => n.file).sort(), ['test/ava.test.mjs', 'tests/test_cart.py']);
  for (const n of report.notRun) assert.match(n.reason, /runner/);
});

test('test-change-review#AC-7: runner detection and result parsing for node:test, Vitest, and Jest', () => {
  assert.equal(runnerFor("import { test } from 'node:test';", {}), 'node');
  assert.equal(runnerFor("import { test } from 'vitest';", {}), 'vitest');
  assert.equal(runnerFor("import { expect } from '@jest/globals';", {}), 'jest');
  assert.equal(runnerFor("test('x', () => expect(1).toBe(1));", { devDependencies: { vitest: '1' } }), 'vitest');
  assert.equal(runnerFor("test('x', () => expect(1).toBe(1));", { devDependencies: { jest: '29' } }), 'jest');
  assert.equal(runnerFor("import test from 'ava';", {}), null);

  const tap = 'TAP version 13\n# Subtest: add\n    # Subtest: adds two numbers\n    not ok 1 - adds two numbers\n      ---\n      error: |-\n        Expected values to be strictly equal:\n\n        3 !== 4\n      ...\n    1..1\nnot ok 1 - add\n# Subtest: top\nok 2 - top\n';
  assert.deepEqual(parseTap(tap), [
    { key: 'add > adds two numbers', status: 'fail', message: 'Expected values to be strictly equal: 3 !== 4' },
    { key: 'add', status: 'fail', message: '' },
    { key: 'top', status: 'pass', message: '' },
  ]);
  // TAP escapes "#" in names, as in this repository's own test titles.
  assert.equal(parseTap('# Subtest: spec\\#AC-1: works\nok 1 - spec\\#AC-1: works\n')[0].key, 'spec#AC-1: works');
  const json = { testResults: [{ assertionResults: [{ ancestorTitles: ['add'], title: 'adds', status: 'failed', failureMessages: ['expected 3 to be 4'] }, { ancestorTitles: [], title: 'top', status: 'passed', failureMessages: [] }] }] };
  assert.deepEqual(parseJestJson(json), [
    { key: 'add > adds', status: 'fail', message: 'expected 3 to be 4' },
    { key: 'top', status: 'pass', message: '' },
  ]);
});
