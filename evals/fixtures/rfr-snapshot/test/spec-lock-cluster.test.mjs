// Tests for a list-valued tests-commit: one commit per cluster of tests, each cluster locked at
// its own commit. This is a new file because test/spec-lock.test.mjs is locked by the spec.
// Each test title cites the criterion it covers (spec-test-traceability#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseSpec } from '../checks/lib/spec.mjs';
import { runLock } from '../checks/spec-lock.mjs';

const SPEC = (front = '') => `---\nstatus: approved\n${front}---\n\n# Feature\n\n## Acceptance criteria\n| # | Criterion | Verified by |\n|---|---|---|\n| AC-1 | one | test: first |\n| AC-2 | two | test: second |\n`;

function git(root, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'core.autocrlf=false', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const commit = (root, message) => { git(root, 'add', '-A'); git(root, 'commit', '-q', '--allow-empty', '-m', message); return git(root, 'rev-parse', 'HEAD'); };

// Cluster one (a.test.js) and cluster two (b.test.js) on one branch, then the spec recording both.
function repo({ sibling = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-spec-cluster-'));
  git(root, 'init', '-q', '-b', 'main');
  write(root, 'docs/specs/feature.md', SPEC());
  const base = commit(root, 'spec');
  write(root, 'test/a.test.js', "test('feature#AC-1: one', () => {});\n");
  const first = commit(root, 'cluster one');
  let second;
  if (sibling) {
    git(root, 'checkout', '-q', '-b', 'other', base);
    write(root, 'test/b.test.js', "test('feature#AC-2: two', () => {});\n");
    second = commit(root, 'cluster two on a sibling branch');
    git(root, 'checkout', '-q', 'main');
    git(root, '-c', 'user.email=t@example.com', '-c', 'user.name=t', 'merge', '-q', '--no-edit', 'other');
  } else {
    write(root, 'test/b.test.js', "test('feature#AC-2: two', () => {});\n");
    second = commit(root, 'cluster two');
  }
  write(root, 'docs/specs/feature.md', SPEC(`tests-commit: [${first}, ${second}]\n`));
  commit(root, 'record tests-commits');
  return { root, first, second };
}

test('spec-test-traceability#AC-11: tests-commit parses as one commit or as a list', () => {
  const sha = 'a'.repeat(40);
  const other = 'b'.repeat(40);
  assert.deepEqual(parseSpec(SPEC(`tests-commit: ${sha}\n`), 'feature').testsCommits, [sha]);
  assert.deepEqual(parseSpec(SPEC(`tests-commit: [${sha}, ${other}]\n`), 'feature').testsCommits, [sha, other]);
  assert.deepEqual(parseSpec(SPEC(), 'feature').testsCommits, []);
});

test('spec-test-traceability#AC-11: two clusters with unchanged tests pass', () => {
  const { root } = repo();
  assert.deepEqual(runLock(root).errors, []);
});

test('spec-test-traceability#AC-11: an earlier cluster stays locked after a later one is added', () => {
  const { root, first } = repo();
  write(root, 'test/a.test.js', "test('feature#AC-1: one, weakened', () => {});\n");
  commit(root, 'edit cluster one');
  const r = runLock(root);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], new RegExp(`test/a\\.test\\.js changed since tests-commit ${first.slice(0, 12)}`));
});

test('spec-test-traceability#AC-11: a later cluster is locked at its own commit', () => {
  const { root, second } = repo();
  write(root, 'test/b.test.js', '// emptied\n');
  commit(root, 'edit cluster two');
  const r = runLock(root);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], new RegExp(`test/b\\.test\\.js changed since tests-commit ${second.slice(0, 12)}`));
});

test('spec-test-traceability#AC-11: a later cluster\'s files are not reported as added, and a new file is', () => {
  const { root } = repo();
  write(root, 'test/c.test.js', "test('feature#AC-1: more', () => {});\n");
  commit(root, 'a third file');
  const r = runLock(root);
  assert.deepEqual(r.errors, []);
  const notices = r.notices.join('\n');
  assert.match(notices, /test\/c\.test\.js.*added/);
  assert.doesNotMatch(notices, /test\/b\.test\.js.*added/);
});

test('spec-test-traceability#AC-11: a commit that is not a descendant of the one before it is an error', () => {
  const { root } = repo({ sibling: true });
  assert.match(runLock(root).errors.join('\n'), /not a descendant/);
});
