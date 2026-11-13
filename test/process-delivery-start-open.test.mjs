// `delivery start <story>` for a story whose user documentation is approved and which has no spec yet
// starts the run, with the spec as its first step (docs/specs/delivery-run.md, AC-9 as amended in
// rewrite plan 25f: the delegated eval found every new delivery refused here). A story at an earlier
// stage is still refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readMarker } from '../plugins/process/scripts/delivery.mjs';

const SCRIPT = path.resolve('plugins/process/scripts/delivery.mjs');
const front = (id, status, links) => `---\nid: ${id}\nstatus: ${status}\nderived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n`;

function repo({ userDocs = 'approved' } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-start-open-'));
  const root = path.join(base, 'work');
  fs.mkdirSync(root);
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'test');
  write('docs/product/process.yml', 'default: [lead]\n');
  write('docs/product/stories/export.md', `${front('story-export', 'approved', [])}\nAs a user, I want to export so that I can share.\n`);
  write('docs/design/export.md', `${front('design-export', 'approved', ['story-export'])}\n# Export\n`);
  write('docs/user/export.md', `${front('user-export', userDocs, ['design-export'])}\n# Exporting\n`);
  git('add', '-A'); git('commit', '-q', '-m', 'base');
  spawnSync('git', ['init', '-q', '--bare', '-b', 'main', path.join(base, 'remote.git')]);
  git('remote', 'add', 'origin', path.join(base, 'remote.git'));
  git('push', '-q', '-u', 'origin', 'main');
  git('switch', '-q', '-c', 'feature/export');
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  return { root, run };
}

test('delivery-run#AC-9: a story whose delivery is open starts the run, with the spec as its first step', () => {
  const r = repo();
  const started = r.run('start', 'story-export');
  assert.equal(started.status, 0, started.stderr);
  assert.match(started.stdout, /Delivery run started on feature\/export/);
  assert.match(started.stdout, /no spec in this branch yet/);
  assert.equal(readMarker(r.root).branch, 'feature/export');
  assert.deepEqual(readMarker(r.root).specs, []);
});

test('delivery-run#AC-9: a story whose user documentation is not approved yet is still refused', () => {
  const r = repo({ userDocs: 'draft' });
  const refused = r.run('start', 'story-export');
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /not a delivery run/);
  assert.equal(readMarker(r.root), null);
});
