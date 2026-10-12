// Tests for the spec lock check: tests that cite a spec are fixed at the commit the spec records.
// Each test title cites the criterion it covers (spec-test-traceability#AC-n).
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

// A repository whose first commit holds the spec and a citing test, then a commit recording that
// first commit in the spec. Returns the root and the recorded SHA.
function repo(front = (sha) => `tests-commit: ${sha}\n`) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-spec-lock-'));
  git(root, 'init', '-q', '-b', 'main');
  fs.mkdirSync(path.join(root, 'docs/specs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'test'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/specs/feature.md'), SPEC());
  fs.writeFileSync(path.join(root, 'test/a.test.js'), "test('feature#AC-1: one', () => { assert.ok(true); });\n");
  fs.writeFileSync(path.join(root, 'test/unrelated.test.js'), "test('something else', () => {});\n");
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'tests');
  const sha = git(root, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(root, 'docs/specs/feature.md'), SPEC(front(sha)));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'record tests-commit');
  return { root, sha };
}

const commit = (root, message = 'change') => { git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', message); };

test('spec-test-traceability#AC-8: unchanged tests pass the lock', () => {
  const { root } = repo();
  assert.deepEqual(runLock(root).errors, []);
});

test('spec-test-traceability#AC-8: modifying, deleting, or renaming a locked test fails', () => {
  const modified = repo();
  fs.writeFileSync(path.join(modified.root, 'test/a.test.js'), "test('feature#AC-1: one', () => {});\n");
  commit(modified.root);
  const m = runLock(modified.root);
  assert.equal(m.errors.length, 1);
  assert.match(m.errors[0], /test\/a\.test\.js.*changed since/);

  const deleted = repo();
  fs.rmSync(path.join(deleted.root, 'test/a.test.js'));
  commit(deleted.root);
  assert.match(runLock(deleted.root).errors.join('\n'), /test\/a\.test\.js/);

  const renamed = repo();
  git(renamed.root, 'mv', 'test/a.test.js', 'test/b.test.js');
  commit(renamed.root);
  assert.match(runLock(renamed.root).errors.join('\n'), /test\/a\.test\.js/);
});

test('spec-test-traceability#AC-8: a file that does not cite the spec is free to change, and a new test file is only reported', () => {
  const { root } = repo();
  fs.writeFileSync(path.join(root, 'test/unrelated.test.js'), "test('changed', () => {});\n");
  fs.writeFileSync(path.join(root, 'test/more.test.js'), "test('feature#AC-1: more', () => {});\n");
  commit(root);
  const r = runLock(root);
  assert.deepEqual(r.errors, []);
  assert.match(r.notices.join('\n'), /test\/more\.test\.js.*added/);
});

test('spec-test-traceability#AC-8: a spec without tests-commit is not checked, and an unknown commit is an error', () => {
  const none = repo(() => '');
  fs.writeFileSync(path.join(none.root, 'test/a.test.js'), '// changed\n');
  commit(none.root);
  assert.deepEqual(runLock(none.root).errors, []);

  const bad = repo(() => 'tests-commit: 0123456789abcdef0123456789abcdef01234567\n');
  assert.match(runLock(bad.root).errors.join('\n'), /0123456789ab.*not found/);
});

test('spec-test-traceability#AC-9: an unlock with a reason allows the change and is reported', () => {
  const { root } = repo(sha => `tests-commit: ${sha}\nunlocks:\n  - test/a.test.js: AC-1 was reworded in the spec; the test followed\n`);
  fs.writeFileSync(path.join(root, 'test/a.test.js'), "test('feature#AC-1: one, reworded', () => {});\n");
  commit(root);
  const r = runLock(root);
  assert.deepEqual(r.errors, []);
  assert.match(r.notices.join('\n'), /test\/a\.test\.js unlocked: AC-1 was reworded/);
});

test('spec-test-traceability#AC-9: an unlock without a reason fails, and an unlock for an unchanged file is a warning', () => {
  const noReason = repo(sha => `tests-commit: ${sha}\nunlocks:\n  - test/a.test.js:\n`);
  fs.writeFileSync(path.join(noReason.root, 'test/a.test.js'), '// changed\n');
  commit(noReason.root);
  assert.match(runLock(noReason.root).errors.join('\n'), /test\/a\.test\.js.*reason/);

  const unused = repo(sha => `tests-commit: ${sha}\nunlocks:\n  - test/a.test.js: no longer needed\n`);
  const r = runLock(unused.root);
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings.join('\n'), /test\/a\.test\.js.*did not change/);
});
