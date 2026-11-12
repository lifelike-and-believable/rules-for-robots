// Finishing a feature from wherever it stands (docs/specs/delivery-run.md, AC-9 and AC-10): a run
// can be started for a named spec or story whose spec is already on the default branch, so that
// "finish slice 1" picks up at the first thing still missing, such as a tutorial for a feature that
// was built before tutorials were required. Each test title cites its criterion (delivery-run#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { deliveryMissing, readMarker, resolveSpecs } from '../plugins/process/scripts/delivery.mjs';

const SCRIPT = path.resolve('plugins/process/scripts/delivery.mjs');
const front = (id, status, links, extra = '') => `---\nid: ${id}\nstatus: ${status}\n${extra}derived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n`;

// main holds a feature that was built and merged with no tutorial: story, design, user
// documentation, an implemented spec, its tests, and its code. A second story has only a design.
function repo() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-resume-'));
  const root = path.join(base, 'work');
  fs.mkdirSync(root);
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  const commit = message => { git('add', '-A'); git('commit', '-q', '-m', message); };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'test'); git('config', 'core.autocrlf', 'false');
  write('docs/product/process.yml', 'mode: team\ndefault: [lead]\n');
  write('docs/product/stories/export.md', `${front('story-export', 'approved', [])}\nAs a user, I want to export so that I can share.\n`);
  write('docs/design/export.md', `${front('design-export', 'approved', ['story-export'])}\n# Export\n`);
  write('docs/user/export.md', `${front('user-export', 'approved', ['design-export'])}\n# Exporting\n`);
  write('docs/specs/slice1-export.md', `${front('spec-export', 'implemented', ['user-export'])}\n# Export\n`);
  write('test/export.test.mjs', '// slice1-export#AC-1\n');
  write('src/export.mjs', 'export const x = 1;\n');
  write('docs/product/stories/import.md', `${front('story-import', 'approved', [])}\nAs a user, I want to import so that I can start.\n`);
  write('docs/design/import.md', `${front('design-import', 'approved', ['story-import'])}\n# Import\n`);
  commit('base');
  spawnSync('git', ['init', '-q', '--bare', '-b', 'main', path.join(base, 'remote.git')]);
  git('remote', 'add', 'origin', path.join(base, 'remote.git'));
  git('push', '-q', '-u', 'origin', 'main');
  git('switch', '-q', '-c', 'feature/finish-export');
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  const stop = () => { const r = spawnSync(process.execPath, [SCRIPT], { cwd: root, input: JSON.stringify({ cwd: root }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } }); return r.stdout ? JSON.parse(r.stdout) : null; };
  return { root, git, write, commit, run, stop };
}
const TUTORIAL = `${front('tutorial-export', 'draft', ['user-export'], 'runner: manual\n')}\n# Try exporting\n`;

test('delivery-run#AC-9 a name resolves to its spec: a spec file, a spec id, or a story', () => {
  const r = repo();
  assert.deepEqual(resolveSpecs(r.root, 'slice1-export'), ['slice1-export']);
  assert.deepEqual(resolveSpecs(r.root, 'spec-export'), ['slice1-export']);
  assert.deepEqual(resolveSpecs(r.root, 'story-export'), ['slice1-export']);
  assert.deepEqual(resolveSpecs(r.root, 'story-import'), []);
  assert.deepEqual(resolveSpecs(r.root, 'nothing-like-this'), []);
});

test('delivery-run#AC-9 a run started for a built feature asks only for what it lacks', () => {
  const r = repo();
  const started = r.run('start', 'slice1-export');
  assert.equal(started.status, 0, started.stderr);
  assert.deepEqual(readMarker(r.root).specs, ['slice1-export']);
  const missing = deliveryMissing(r.root, ['slice1-export']);
  assert.match(missing.join('\n'), /tutorial .*user-export/);
  assert.ok(!/no spec in this branch/.test(missing.join('\n')));
  assert.ok(!/tests that cite/.test(missing.join('\n')), 'its tests are already on the default branch');

  const blocked = r.stop();
  assert.equal(blocked.decision, 'block');
  assert.match(blocked.reason, /tutorial/);

  r.write('docs/tutorials/export.md', TUTORIAL);
  r.commit('tutorial'); r.git('push', '-q', '-u', 'origin', 'HEAD');
  assert.deepEqual(deliveryMissing(r.root, ['slice1-export']), []);
});

test('delivery-run#AC-9 starting for a name that has no spec yet is refused, with where the feature stands', () => {
  const r = repo();
  const refused = r.run('start', 'story-import');
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /story-import: write the user documentation/);
  assert.match(refused.stderr, /not a delivery run/);
  assert.equal(readMarker(r.root), null);
});

test('delivery-run#AC-10 `where` says how far a feature has got and what is next', () => {
  const r = repo();
  const built = r.run('where', 'story-export');
  assert.equal(built.status, 0);
  assert.match(built.stdout, /story-export: delivery is under way/);
  assert.match(built.stdout, /slice1-export[\s\S]*tutorial/);
  const early = r.run('where', 'story-import');
  assert.match(early.stdout, /story-import: write the user documentation/);
  const all = r.run('where');
  assert.match(all.stdout, /story-export/);
  assert.match(all.stdout, /story-import/);
});

test('delivery-run#AC-10 the skill picks a feature up from where it stands', () => {
  const skill = fs.readFileSync('plugins/process/skills/deliver/SKILL.md', 'utf8');
  for (const part of [/finish/i, /delivery\.mjs" where/, /delivery\.mjs" start <[^>]+>/, /waiting for (the lead's )?approval/i, /do not start a run/i]) assert.match(skill, part);
});
