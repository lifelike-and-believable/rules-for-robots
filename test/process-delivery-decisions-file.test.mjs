// The delivery run's decisions file is named after its branch (docs/specs/delivery-run.md, AC-3 as
// amended in rewrite plan 25e), so two runs on different branches never write the same file. A
// decisions file named after the spec, where earlier runs wrote, is still read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decisionsFile, deliveryMissing } from '../plugins/process/scripts/delivery.mjs';

const SCRIPT = path.resolve('plugins/process/scripts/delivery.mjs');
const front = (id, status, links, extra = '') => `---\nid: ${id}\nstatus: ${status}\n${extra}derived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n`;
const SPEC = `${front('spec-export', 'approved', ['user-export'])}\n# Export\n\n## Acceptance criteria\n\n| # | Criterion | Verified by | Source |\n|---|---|---|---|\n| AC-1 | It exports. | test: exports | user-export |\n`;
const ASIDE = '# Decisions\n\n- [set aside: tutorial] The preview needs a key this session does not have.\n- [set aside: tests] The runner for this package is not installed.\n';

// A project with a bare remote; main holds an approved story, design, and user documentation.
function repo(branch) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-decisions-'));
  const root = path.join(base, 'work');
  fs.mkdirSync(root);
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  const commit = message => { git('add', '-A'); git('commit', '-q', '-m', message); };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'test'); git('config', 'core.autocrlf', 'false');
  write('docs/product/process.yml', 'default: [lead]\n');
  write('docs/product/stories/export.md', `${front('story-export', 'approved', [])}\nAs a user, I want to export so that I can share.\n`);
  write('docs/design/export.md', `${front('design-export', 'approved', ['story-export'])}\n# Export\n`);
  write('docs/user/export.md', `${front('user-export', 'approved', ['design-export'])}\n# Exporting\n`);
  commit('base');
  spawnSync('git', ['init', '-q', '--bare', '-b', 'main', path.join(base, 'remote.git')]);
  git('remote', 'add', 'origin', path.join(base, 'remote.git'));
  git('push', '-q', '-u', 'origin', 'main');
  git('switch', '-q', '-c', branch);
  return { root, git, write, commit };
}

test('delivery-run#AC-3: the decisions file is named after the branch, each / written as -', () => {
  assert.equal(decisionsFile('feature/export'), 'docs/decisions/feature-export.md');
  assert.equal(decisionsFile('claude/run-1'), 'docs/decisions/claude-run-1.md');
  assert.equal(decisionsFile('a\\b//c'), 'docs/decisions/a-b-c.md');
  assert.notEqual(decisionsFile('feature/export'), decisionsFile('feature/export-2'));
});

test('delivery-run#AC-3: tokens in the branch-named file set aside the tests and tutorial; the push still counts', () => {
  const r = repo('feature/export');
  r.write('docs/specs/export.md', SPEC);
  r.write('docs/decisions/feature-export.md', ASIDE);
  r.commit('spec only');
  assert.deepEqual(deliveryMissing(r.root).map(m => m.split(':')[0]), ['the branch is not pushed']);
});

test('delivery-run#AC-3: another branch\'s decisions file sets nothing aside for this run', () => {
  const r = repo('feature/export');
  r.write('docs/specs/export.md', SPEC);
  r.write('docs/decisions/feature-other.md', ASIDE);
  r.commit('spec, and a decision from another run');
  const missing = deliveryMissing(r.root).join('\n');
  assert.match(missing, /tests that cite export#AC-n/);
  assert.match(missing, /a tutorial in docs\/tutorials/);
});

test('delivery-run#AC-3: starting a run names its decisions file', () => {
  const r = repo('feature/export');
  const started = spawnSync(process.execPath, [SCRIPT, 'start'], { cwd: r.root, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: r.root } });
  assert.equal(started.status, 0, started.stderr);
  assert.match(started.stdout, /decisions file is docs\/decisions\/feature-export\.md/);
});
