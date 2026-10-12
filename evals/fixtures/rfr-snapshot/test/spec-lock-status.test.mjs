// The lock applies while a spec is being built. Once the spec is implemented the lock is released,
// so a squash merge that drops the recorded commit from history does not break the check.
// This is a new file because test/spec-lock.test.mjs is locked by the spec (tests added later are allowed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runLock } from '../checks/spec-lock.mjs';

function git(root, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'core.autocrlf=false', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

function repo(status, sha) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-spec-lock-status-'));
  git(root, 'init', '-q', '-b', 'main');
  fs.mkdirSync(path.join(root, 'docs/specs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'test'), { recursive: true });
  fs.writeFileSync(path.join(root, 'test/a.test.js'), "test('feature#AC-1: one', () => {});\n");
  fs.writeFileSync(path.join(root, 'docs/specs/feature.md'), `---\nstatus: ${status}\ntests-commit: ${sha}\n---\n\n# Feature\n\n## Acceptance criteria\n| # | Criterion | Verified by |\n|---|---|---|\n| AC-1 | one | test: first |\n`);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'start');
  return root;
}

test('spec-test-traceability#AC-8: an implemented spec releases the lock, even when its tests-commit is gone from history', () => {
  const root = repo('implemented', '0123456789abcdef0123456789abcdef01234567');
  const r = runLock(root);
  assert.deepEqual(r.errors, []);
  assert.match(r.notices.join('\n'), /feature.*lock released.*implemented/);
});

test('spec-test-traceability#AC-8: an approved spec with a missing tests-commit is still an error', () => {
  const root = repo('approved', '0123456789abcdef0123456789abcdef01234567');
  assert.match(runLock(root).errors.join('\n'), /0123456789ab.*not found/);
});
