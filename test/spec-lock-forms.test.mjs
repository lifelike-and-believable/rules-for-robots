// spec-test-traceability#AC-14 and AC-15: block-list tests-commit, and unlocks for new files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runLock } from '../checks/spec-lock.mjs';

const SPEC = (front = '') => `---\nstatus: approved\n${front}---\n\n# Feature\n\n## Acceptance criteria\n| # | Criterion | Verified by |\n|---|---|---|\n| AC-1 | one | test: first |\n`;

function git(root, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'core.autocrlf=false', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

function repo(front) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-spec-forms-'));
  git(root, 'init', '-q', '-b', 'main');
  fs.mkdirSync(path.join(root, 'docs/specs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'test'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/specs/feature.md'), SPEC());
  fs.writeFileSync(path.join(root, 'test/a.test.js'), "test('feature#AC-1: one', () => { assert.ok(true); });\n");
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'tests');
  const sha = git(root, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(root, 'docs/specs/feature.md'), SPEC(front(sha)));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'record tests-commit');
  return { root, sha };
}
const commit = root => { git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'change'); };

test('spec-test-traceability#AC-14: a block-list tests-commit locks its tests', () => {
  const { root } = repo(sha => `tests-commit:\n  - ${sha}\n`);
  assert.deepEqual(runLock(root).errors, []);
  fs.writeFileSync(path.join(root, 'test/a.test.js'), "test('feature#AC-1: one', () => { assert.ok(false); });\n");
  commit(root);
  assert.match(runLock(root).errors.join('\n'), /test\/a\.test\.js changed since tests-commit/);
});

test('spec-test-traceability#AC-14: a tests-commit with no readable commit is an error naming the spec', () => {
  const { root } = repo(() => 'tests-commit:\n');
  assert.match(runLock(root).errors.join('\n'), /feature: .*tests-commit/);
});

test('spec-test-traceability#AC-15: an unlocks entry marked (new) for a new test file draws no error or warning', () => {
  const { root } = repo(sha => `tests-commit: ${sha}\nunlocks:\n  - test/b.test.js (new): covers AC-1 at the page level\n`);
  fs.writeFileSync(path.join(root, 'test/b.test.js'), "test('feature#AC-1: page level', () => {});\n");
  commit(root);
  const r = runLock(root);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings.filter(w => /b\.test\.js/.test(w)), [], r.warnings.join('\n'));
});
