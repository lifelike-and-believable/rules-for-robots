// A step of a design's build order that no decisions file records as built keeps the feature's
// delivery open, so the next merge or "deliver it" carries on with it (docs/specs/delivery-run.md,
// AC-19; rewrite plan 25f: once a delivery that built step 1 of six merged, nothing started steps 2 to 6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { featureSteps, parseProcessConfig, processNext, renderNext } from '../checks/lib/process.mjs';
import { readMarker } from '../plugins/process/scripts/delivery.mjs';

const SCRIPT = path.resolve('plugins/process/scripts/delivery.mjs');
const config = parseProcessConfig('default: [lead]\n').config;
const art = (id, stage, status, from = [], more = {}) => ({ id, stage, status, file: `docs/${id}.md`, links: from.map(target => ({ target })), ...more });
const NOTES = '# A\n\n## Notes for delivery\n\nBuild in this order.\n\n1. **The command.** It runs.\n2. **The button.** On the toolbar.\n3. **Help.** The help page.\n\n- A check only a person can do.\n';

// A built and validated feature whose design has a build order of three steps.
const feature = ({ tutorial = 'approved', spec = true, designStatus = 'approved', docs = 'approved' } = {}) => [
  art('story-a', 'stories', 'approved'),
  art('design-a', 'design', designStatus, ['story-a'], { body: NOTES }),
  art('user-a', 'user-docs', docs, ['design-a']),
  ...(spec ? [art('spec-a', 'specs', 'approved', ['user-a'])] : []),
  ...(spec && tutorial ? [art('tutorial-a', 'tutorials', tutorial, ['user-a'])] : []),
];
const only = (artifacts, decisions) => featureSteps(artifacts, config, decisions)[0];

test('delivery-run#AC-19: a delivered feature with a step left to build has its delivery open', () => {
  const s = only(feature(), ['- [step done: design-a 1]\n- [step done: design-a 2]\n']);
  assert.equal(s.step, 'deliver');
  assert.equal(s.stage, 'specs');
  assert.deepEqual(s.openSteps, ['design-a 3']);
  assert.deepEqual(s.units, ['design-a']);
});

test('delivery-run#AC-19: a feature with every step built is as it was', () => {
  const s = only(feature(), ['- [step done: design-a 1]\n', '- [step done: design-a 2]\n- [step done: design-a 3]\n']);
  assert.equal(s.step, 'done');
  assert.equal(s.openSteps, undefined);
  assert.equal(only(feature({ tutorial: 'draft' }), ['[step done: design-a 1] [step done: design-a 2] [step done: design-a 3]']).step, 'validate');
});

test('delivery-run#AC-19: a step left for later stays open', () => {
  const s = only(feature(), ['- [step done: design-a 1]\n- [step done: design-a 2]\n- [step later: design-a 3] It follows the lead\'s validation.\n']);
  assert.equal(s.step, 'deliver');
  assert.deepEqual(s.openSteps, ['design-a 3']);
});

test('delivery-run#AC-19: open steps come before validate and delivering, and after the stages before them', () => {
  const decisions = ['- [step done: design-a 1]\n'];
  assert.deepEqual(only(feature({ tutorial: 'draft' }), decisions).openSteps, ['design-a 2', 'design-a 3']);
  assert.equal(only(feature({ tutorial: null }), decisions).step, 'deliver');
  assert.equal(only(feature({ docs: 'draft' }), decisions).step, 'approve');
  assert.equal(only(feature({ designStatus: 'draft' }), decisions).step, 'approve');
  assert.equal(only(feature({ docs: null, spec: false }).filter(a => a.id !== 'user-a'), decisions).step, 'write');
});

test('delivery-run#AC-19: a feature with no spec yet keeps its ordinary delivery step', () => {
  const s = only(feature({ spec: false }), []);
  assert.equal(s.step, 'deliver');
  assert.deepEqual(s.units, ['user-a']);
  assert.equal(s.openSteps, undefined);
});

test('delivery-run#AC-19: featureSteps without decisions counts no step as built, and a design with no build order changes nothing', () => {
  assert.deepEqual(only(feature()).openSteps, ['design-a 1', 'design-a 2', 'design-a 3']);
  const plain = feature().map(a => (a.id === 'design-a' ? { ...a, body: '# A\n\n## Notes for delivery\n\n- A follow-up.\n' } : a));
  assert.equal(only(plain).step, 'done');
});

test('delivery-run#AC-19: the session text says which steps are still to build', () => {
  const steps = [
    { story: 'story-a', step: 'deliver', stage: 'specs', files: [], inBranch: false, started: true, units: ['design-a'], openSteps: ['design-a 2', 'design-a 3'] },
    { story: 'story-b', step: 'deliver', stage: 'specs', files: [], inBranch: false, started: true, units: ['design-b'], openSteps: ['design-b 4'] },
  ];
  const text = renderNext({ steps, product: [] });
  assert.ok(text.includes('story-a: delivery is open: steps 2, 3 of design-a are still to build (/rfr-process:deliver)'), text);
  assert.ok(text.includes('story-b: delivery is open: step 4 of design-b is still to build (/rfr-process:deliver)'), text);
  assert.doesNotMatch(text, /the spec, tests, implementation, and tutorial/);
});

// A repository on main, pushed to a bare remote: the feature "export" is delivered and validated, and
// its decisions file records step 1 of design-export's three as built and step 2 for later.
function repo() {
  const front = (id, status, links, extra = '') => `---\nid: ${id}\nstatus: ${status}\n${extra}derived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n`;
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-open-steps-'));
  const root = path.join(base, 'work');
  fs.mkdirSync(root);
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  const commit = message => { git('add', '-A'); git('commit', '-q', '-m', message); };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'test'); git('config', 'core.autocrlf', 'false');
  write('docs/product/process.yml', 'default: [lead]\n');
  write('docs/product/stories/export.md', `${front('story-export', 'approved', [])}\nAs a user, I want to export so that I can share.\n`);
  write('docs/design/export.md', `${front('design-export', 'approved', ['story-export'])}\n# Export\n\n## Notes for delivery\n\n1. **The export command.** Writes a file.\n2. **The export button.** On the toolbar.\n3. **Help.** The help page.\n`);
  write('docs/user/export.md', `${front('user-export', 'approved', ['design-export'])}\n# Exporting\n`);
  write('docs/specs/export.md', `${front('spec-export', 'approved', ['user-export'])}\n# Export\n`);
  write('test/export.test.mjs', "// export#AC-1\ntest('exports', () => {});\n");
  write('docs/tutorials/export.md', `${front('tutorial-export', 'approved', ['user-export'], 'runner: manual\n')}\n# Try exporting\n`);
  write('docs/decisions/feature-export.md', '- [step done: design-export 1]\n- [step later: design-export 2] It needs a hosting account.\n');
  write('docs/product/stories/import.md', `${front('story-import', 'approved', [])}\nAs a user, I want to import so that I can start.\n`);
  write('docs/design/import.md', `${front('design-import', 'approved', ['story-import'])}\n# Import\n\n## Notes for delivery\n\n1. **The import command.** Reads a file.\n`);
  commit('base');
  spawnSync('git', ['init', '-q', '--bare', '-b', 'main', path.join(base, 'remote.git')]);
  git('remote', 'add', 'origin', path.join(base, 'remote.git'));
  git('push', '-q', '-u', 'origin', 'main');
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  // Push a branch with the given files changed, as a session elsewhere does, and come back to main.
  const elsewhere = (branch, files) => {
    git('switch', '-q', '-c', branch);
    for (const [file, text] of Object.entries(files)) write(file, text);
    commit(branch); git('push', '-q', '-u', 'origin', branch);
    git('switch', '-q', 'main'); git('branch', '-q', '-D', branch);
  };
  return { root, git, write, commit, run, elsewhere, front };
}

test('delivery-run#AC-19: on the default branch, a merged delivery with steps left is open again, and the session says so', () => {
  const r = repo();
  const next = processNext(r.root);
  const s = next.steps.find(x => x.story === 'story-export');
  assert.equal(s.step, 'deliver');
  assert.deepEqual(s.openSteps, ['design-export 2', 'design-export 3']);
  assert.ok(next.text.includes('story-export: delivery is open: steps 2, 3 of design-export are still to build (/rfr-process:deliver)'), next.text);
  // The import feature is at an earlier stage: its build order does not open it.
  assert.equal(next.steps.find(x => x.story === 'story-import').step, 'write');
});

test('delivery-run#AC-19: delivery open lists a feature with steps left, until another branch carries them on', () => {
  const r = repo();
  const open = r.run('open');
  assert.equal(open.status, 0, open.stderr);
  const lines = open.stdout.trim().split('\n');
  assert.equal(lines.length, 1, open.stdout);
  assert.match(lines[0], /^story-export\b/);
  assert.match(lines[0], /design-export 2/);
  // A branch recording a step of another design does not put this one under way.
  r.elsewhere('claude/other', { 'docs/decisions/claude-other.md': '- [step done: design-import 1]\n' });
  assert.match(r.run('open').stdout, /^story-export\b/m);
  // A branch recording a step of this design does.
  r.elsewhere('claude/export-steps', { 'docs/decisions/claude-export-steps.md': '- [step done: design-export 2]\n' });
  assert.equal(r.run('open').stdout.trim(), 'No delivery is open.');
});

test('delivery-run#AC-19: a branch that changes a spec of the feature puts its remaining steps under way', () => {
  const r = repo();
  r.elsewhere('claude/export-spec', { 'docs/specs/export.md': `${r.front('spec-export', 'approved', ['user-export'])}\n# Export\n\nAC-2: the button.\n` });
  assert.equal(r.run('open').stdout.trim(), 'No delivery is open.');
});

test('delivery-run#AC-19: delivery start for a feature with steps left scopes the run to its existing specs', () => {
  const r = repo();
  r.git('switch', '-q', '-c', 'feature/export-more');
  const started = r.run('start', 'story-export');
  assert.equal(started.status, 0, started.stderr);
  assert.deepEqual(readMarker(r.root).specs, ['export']);
  assert.doesNotMatch(started.stdout, /no spec in this branch yet/);
  assert.match(started.stdout, /step 2 of design-export: build it/);
  assert.match(started.stdout, /step 3 of design-export: build it/);
  assert.doesNotMatch(started.stdout, /step 1 of design-export/);
});
