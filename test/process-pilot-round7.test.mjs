// Tests for the seventh round of fixes from the Kettlebird pilot (docs/specs/project-process.md,
// "Pilot findings: round 7"). Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

function git(root, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

test('project-process#AC-40: setting an approved artifact to draft names both choices, amend or withdraw', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-round7-'));
  const files = {
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\n## Audience\n\nFans.\n',
    'docs/product/personas/fan.md': '---\nid: persona-fan\nstatus: approved\nderived-from:\n  - concept#audience:\n---\n\n# Fan\n\n## Goals\n\nRead.\n',
  };
  for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); }
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
