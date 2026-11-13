// Tests for what the process check tells the reader (docs/specs/project-process.md): the
// rules-for-robots commit it ran from (AC-31), and the two choices when an approved artifact is set
// back to draft (AC-40). Moved unchanged from the pilot-round files (rewrite plan 25e). Each test
// title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-messages-'));
  for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); }
  return root;
}

function git(root, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

test('project-process#AC-31: the process check prints the rules-for-robots commit it ran from', () => {
  const head = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const root = project({ 'README.md': '# x\n' });
  const out = spawnSync(process.execPath, [path.resolve('checks/process-trace.mjs'), root], { encoding: 'utf8' });
  assert.equal(out.status, 0);
  assert.match(out.stdout, new RegExp(`rules-for-robots ${head}`));
});

test('project-process#AC-40: setting an approved artifact to draft names both choices, amend or withdraw', () => {
  const root = project({
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\n## Audience\n\nFans.\n',
    'docs/product/personas/fan.md': '---\nid: persona-fan\nstatus: approved\nderived-from:\n  - concept#audience:\n---\n\n# Fan\n\n## Goals\n\nRead.\n',
  });
  relink(root, ['persona-fan']);
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  const persona = path.join(root, 'docs/product/personas/fan.md');
  fs.writeFileSync(persona, fs.readFileSync(persona, 'utf8').replace('status: approved', 'status: draft').replace('Read.', 'Read comics.'));
  const message = runProcessTrace(root, { base: 'main' }).errors.join('\n');
  assert.match(message, /persona-fan: was approved at main and is now draft/);
  assert.match(message, /amend\w*.*keep.*approved/i);
  assert.match(message, /withdraw.*reason.*issue/i);
});
