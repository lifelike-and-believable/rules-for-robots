// A story's feature follows the stage chain, so a decision note that several features cite does not
// join them (docs/specs/process-state.md, AC-13; rewrite plan 25f: on the acceptance test the shared
// navigation decision made slices 1 to 3's specs count as slice 4's).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { featureFamily, featureSteps, parseProcessConfig } from '../checks/lib/process.mjs';
import { readMarker } from '../plugins/process/scripts/delivery.mjs';

const config = parseProcessConfig('default: [lead]\n').config;
const art = (id, stage, status, from = [], more = {}) => ({ id, stage, status, file: `docs/${id}.md`, links: from.map(target => ({ target })), ...more });

// Feature "old" is built: story, design, user documentation, spec, and a draft tutorial. Feature "new"
// has approved user documentation and no spec. A decision note derives from both stories, and the old
// spec cites it beside its own user documentation.
const ARTIFACTS = [
  art('story-old', 'stories', 'approved'),
  art('design-old', 'design', 'approved', ['story-old']),
  art('user-old', 'user-docs', 'approved', ['design-old']),
  art('spec-old', 'specs', 'approved', ['user-old', 'decision-urls']),
  art('tutorial-old', 'tutorials', 'draft', ['user-old']),
  art('story-new', 'stories', 'approved'),
  art('design-new', 'design', 'approved', ['story-new']),
  art('user-new', 'user-docs', 'approved', ['design-new']),
  art('decision-urls', 'design', 'approved', ['story-old', 'story-new']),
];

test('process-state#AC-13: a decision note two features cite does not join their specs and tutorials', () => {
  const ids = story => featureFamily(ARTIFACTS, story, config).map(a => a.id).sort();
  assert.deepEqual(ids('story-new'), ['decision-urls', 'design-new', 'story-new', 'user-new']);
  assert.deepEqual(ids('story-old'), ['decision-urls', 'design-old', 'spec-old', 'story-old', 'tutorial-old', 'user-old']);
  const steps = Object.fromEntries(featureSteps(ARTIFACTS, config).map(s => [s.story, s.step]));
  assert.deepEqual(steps, { 'story-new': 'deliver', 'story-old': 'validate' });
});

test('process-state#AC-13: a spec joins through a design marked no-user-docs', () => {
  const artifacts = [
    art('story-skel', 'stories', 'approved'),
    art('design-skel', 'design', 'approved', ['story-skel'], { noUserDocs: 'a repository skeleton with no screens' }),
    art('spec-skel', 'specs', 'draft', ['design-skel']),
  ];
  assert.ok(featureFamily(artifacts, 'story-skel', config).some(a => a.id === 'spec-skel'));
});

test('process-state#AC-13: the delivery commands scope a story to its own feature', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-family-'));
  const root = path.join(base, 'work');
  fs.mkdirSync(root);
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); };
  const front = (id, status, links) => `---\nid: ${id}\nstatus: ${status}\nderived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n\n# ${id}\n`;
  const files = {
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/stories/old.md': front('story-old', 'approved', []),
    'docs/design/old.md': front('design-old', 'approved', ['story-old']),
    'docs/user/old.md': front('user-old', 'approved', ['design-old']),
    'docs/specs/old.md': front('spec-old', 'approved', ['user-old', 'decision-urls']),
    'docs/tutorials/old.md': front('tutorial-old', 'draft', ['user-old']),
    'docs/product/stories/new.md': front('story-new', 'approved', []),
    'docs/design/new.md': front('design-new', 'approved', ['story-new']),
    'docs/user/new.md': front('user-new', 'approved', ['design-new']),
    'docs/design/decisions/urls.md': front('decision-urls', 'approved', ['story-old', 'story-new']),
  };
  for (const [file, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'test');
  git('add', '-A'); git('commit', '-q', '-m', 'base');
  spawnSync('git', ['init', '-q', '--bare', '-b', 'main', path.join(base, 'remote.git')]);
  git('remote', 'add', 'origin', path.join(base, 'remote.git')); git('push', '-q', '-u', 'origin', 'main');
  const run = (...args) => spawnSync(process.execPath, [path.resolve('plugins/process/scripts/delivery.mjs'), ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  assert.match(run('open').stdout, /^story-new \(user documentation: user-new\)$/m);
  git('switch', '-q', '-c', 'feature/new');
  const started = run('start', 'story-new');
  assert.equal(started.status, 0, started.stderr);
  assert.deepEqual(readMarker(root).specs, []);
  assert.doesNotMatch(started.stdout, /spec-old|docs\/specs\/old/);
});
