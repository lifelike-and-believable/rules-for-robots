// `delivery open` lists the features whose delivery is open on the default branch and not already
// under way on another branch (docs/specs/delivery-run.md, AC-13; rewrite plan 25f: the default branch
// still showed slice 4's delivery as open while its run was building it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT = path.resolve('plugins/process/scripts/delivery.mjs');
const front = (id, status, links) => `---\nid: ${id}\nstatus: ${status}\nderived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n`;

// A repository on main, pushed to a bare remote, with the feature "export" (two stories sharing one
// design and user documentation) at the stage given, and "import" with only a story.
function repo({ exportDocs = 'approved' } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-open-'));
  const root = path.join(base, 'work');
  fs.mkdirSync(root);
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'test');
  write('docs/product/process.yml', 'default: [lead]\n');
  write('docs/product/stories/export.md', `${front('story-export', 'approved', [])}\nAs a user, I want to export so that I can share.\n`);
  write('docs/product/stories/export-all.md', `${front('story-export-all', 'approved', [])}\nAs a user, I want to export everything so that I can move.\n`);
  write('docs/product/stories/import.md', `${front('story-import', 'approved', [])}\nAs a user, I want to import so that I can start.\n`);
  write('docs/design/export.md', `${front('design-export', 'approved', ['story-export', 'story-export-all'])}\n# Export\n`);
  write('docs/user/export.md', `${front('user-export', exportDocs, ['design-export'])}\n# Exporting\n`);
  git('add', '-A'); git('commit', '-q', '-m', 'base');
  spawnSync('git', ['init', '-q', '--bare', '-b', 'main', path.join(base, 'remote.git')]);
  git('remote', 'add', 'origin', path.join(base, 'remote.git'));
  git('push', '-q', '-u', 'origin', 'main');
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  // Push a delivery branch carrying a spec for export, as a run under way in another session does.
  const deliveryElsewhere = () => {
    git('switch', '-q', '-c', 'claude/deliver-export');
    write('docs/specs/export.md', `${front('spec-export', 'draft', ['user-export'])}\n# Export\n`);
    git('add', '-A'); git('commit', '-q', '-m', 'spec');
    git('push', '-q', '-u', 'origin', 'claude/deliver-export');
    git('switch', '-q', 'main');
    git('branch', '-q', '-D', 'claude/deliver-export');
  };
  return { root, run, deliveryElsewhere };
}

test('delivery-run#AC-13: a feature whose delivery is open is listed once, with its stories and user documentation', () => {
  const r = repo();
  const out = r.run('open');
  assert.equal(out.status, 0, out.stderr);
  const lines = out.stdout.trim().split('\n');
  assert.equal(lines.length, 1, out.stdout);
  assert.match(lines[0], /story-export\b/);
  assert.match(lines[0], /story-export-all/);
  assert.match(lines[0], /user-export/);
  assert.doesNotMatch(out.stdout, /story-import/);
});

test('delivery-run#AC-13: a feature whose spec is on another branch of the remote is under way, not open', () => {
  const r = repo();
  r.deliveryElsewhere();
  const out = r.run('open');
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stdout.trim(), 'No delivery is open.');
});

test('delivery-run#AC-13: a feature at an earlier stage is not open, and none open says so', () => {
  const r = repo({ exportDocs: 'draft' });
  const out = r.run('open');
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stdout.trim(), 'No delivery is open.');
});
