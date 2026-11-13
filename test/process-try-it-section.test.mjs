// "Try it" in a delivery's pull request and in the end-of-run report (docs/specs/lasting-tutorials.md,
// AC-8; Phase 27c). When a pull request adds or changes a tutorial, its description lists those
// tutorials by title with their paths, then the preview when process.yml has try.preview: true, then
// the try.local command. The Stop hook's end-of-run report tells the agent to give the lead the same,
// once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { prBody, readPrBody } from '../checks/ci/process-pr-body.mjs';

const SCRIPT = path.resolve('plugins/process/scripts/delivery.mjs');
const EXPORT = { file: 'docs/tutorials/export.md', title: 'Export a report' };
const SHARE = { file: 'docs/tutorials/share.md', title: 'Share a report' };

test('lasting-tutorials#AC-8: the Try it section lists the tutorials, the preview, and the local command', () => {
  const body = prBody({ tryIt: { tutorials: [EXPORT, SHARE], preview: true, local: 'npm run try' }, branch: 'feature/export' });
  assert.ok(body.startsWith([
    '## Try it',
    '',
    'Follow these tutorials to try the change:',
    '',
    '- Export a report (`docs/tutorials/export.md`)',
    '- Share a report (`docs/tutorials/share.md`)',
    '',
    'Open the preview linked below, when its deployment finishes.',
    '',
    'To try it on your own machine, run `npm run try` and open the address it prints.',
    '',
  ].join('\n')), body);
});

test('lasting-tutorials#AC-8: without preview there is no preview line, and with no try: block the section lists the tutorials only', () => {
  const local = prBody({ tryIt: { tutorials: [EXPORT], preview: false, local: 'npm run try' }, branch: 'b' });
  assert.match(local, /## Try it/);
  assert.doesNotMatch(local, /preview/i);
  assert.match(local, /run `npm run try`/);

  const bare = prBody({ tryIt: { tutorials: [EXPORT], preview: false, local: null }, branch: 'b' });
  assert.ok(bare.startsWith('## Try it\n\nFollow these tutorials to try the change:\n\n- Export a report (`docs/tutorials/export.md`)\n\nOpened by'), bare);
});

test('lasting-tutorials#AC-8: a pull request that touches no tutorial has no Try it section', () => {
  assert.doesNotMatch(prBody({ tryIt: { tutorials: [], preview: true, local: 'npm run try' }, branch: 'b' }), /Try it/);
  assert.doesNotMatch(prBody({ branch: 'b' }), /Try it/);
});

test('lasting-tutorials#AC-8: the Try it section comes right after "Built, not yet validated", and before the rest', () => {
  const body = prBody({
    tutorials: [{ file: EXPORT.file, status: 'draft' }],
    tryIt: { tutorials: [EXPORT], preview: true, local: null },
    enabling: [{ id: 'design-skeleton', file: 'docs/design/skeleton.md', reason: 'layout' }],
    packet: '## Review packet\n\n- a choice',
    gated: true, number: 4, branch: 'feature/export',
  });
  const order = ['## Built, not yet validated', '## Try it', '## Skips user documentation', '## Review packet', 'gh pr review 4'];
  let at = -1;
  for (const part of order) { const i = body.indexOf(part); assert.ok(i > at, `"${part}" in order:\n${body}`); at = i; }
});

// ---------------------------------------------------------------------------------------------
// Read from the branch, and the end-of-run report

const front = (id, status, links, extra = '') => `---\nid: ${id}\nstatus: ${status}\n${extra}derived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n`;

function finished(yml) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-try-it-'));
  const root = path.join(base, 'work');
  fs.mkdirSync(root);
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'test'); git('config', 'core.autocrlf', 'false');
  write('docs/product/process.yml', yml);
  write('docs/product/stories/export.md', `${front('story-export', 'approved', [])}\nAs a user, I want to export so that I can share.\n`);
  write('docs/design/export.md', `${front('design-export', 'approved', ['story-export'])}\n# Export\n`);
  write('docs/user/export.md', `${front('user-export', 'approved', ['design-export'])}\n# Exporting\n`);
  write('docs/tutorials/old.md', `${front('tutorial-old', 'approved', ['user-export'], 'runner: manual\n')}\n# An older tutorial\n`);
  git('add', '-A'); git('commit', '-q', '-m', 'base');
  spawnSync('git', ['init', '-q', '--bare', '-b', 'main', path.join(base, 'remote.git')]);
  git('remote', 'add', 'origin', path.join(base, 'remote.git')); git('push', '-q', '-u', 'origin', 'main');
  git('switch', '-q', '-c', 'feature/export');
  const env = { ...process.env, CLAUDE_PROJECT_DIR: root };
  assert.equal(spawnSync(process.execPath, [SCRIPT, 'start'], { cwd: root, encoding: 'utf8', env }).status, 0);
  write('docs/specs/export.md', `${front('spec-export', 'approved', ['user-export'])}\n# Export\n`);
  write('test/export.test.mjs', '// export#AC-1\n');
  write('docs/tutorials/export.md', `${front('tutorial-export', 'draft', ['user-export'], 'runner: manual\n')}\n# Export a report\n\nFor **a user**.\n`);
  git('add', '-A'); git('commit', '-q', '-m', 'deliver'); git('push', '-q', '-u', 'origin', 'HEAD');
  const stop = () => { const r = spawnSync(process.execPath, [SCRIPT], { cwd: root, input: JSON.stringify({ cwd: root }), encoding: 'utf8', env }); return r.stdout ? JSON.parse(r.stdout) : null; };
  return { root, stop };
}

const YML = 'default: [lead]\ntry:\n  local: npm run try\n  preview: true\n';

test('lasting-tutorials#AC-8: the description reads the changed tutorials, their titles, and the try: block from the branch', () => {
  const r = finished(YML);
  assert.deepEqual(readPrBody(r.root, 'origin/main').tryIt, { tutorials: [{ file: 'docs/tutorials/export.md', title: 'Export a report' }], preview: true, local: 'npm run try' });
  const plain = finished('default: [lead]\n');
  assert.deepEqual(readPrBody(plain.root, 'origin/main').tryIt, { tutorials: [{ file: 'docs/tutorials/export.md', title: 'Export a report' }], preview: false, local: null });
});

test('lasting-tutorials#AC-8: the end-of-run report tells the agent to give the lead, once, where to try it', () => {
  const r = finished(YML);
  const report = r.stop();
  assert.equal(report.decision, 'block');
  // The existing report stays.
  assert.match(report.reason, /tell the lead once/i);
  assert.match(report.reason, /built and not yet validated/);
  // And says where to try it.
  assert.match(report.reason, /where to try it/i);
  assert.match(report.reason, /- Export a report \(`docs\/tutorials\/export\.md`\)/);
  assert.doesNotMatch(report.reason, /An older tutorial/);
  assert.match(report.reason, /Open the preview linked from the pull request, when its deployment finishes\./);
  assert.match(report.reason, /run `npm run try` and open the address it prints/);
  assert.equal(report.reason.match(/where to try it/gi).length, 1);
  assert.equal(r.stop(), null, 'the report is given once');
});

test('lasting-tutorials#AC-8: with no try: block, the report names the tutorials only', () => {
  const report = finished('default: [lead]\n').stop();
  assert.match(report.reason, /where to try it/i);
  assert.match(report.reason, /Export a report/);
  assert.doesNotMatch(report.reason, /preview/i);
  assert.doesNotMatch(report.reason, /own machine/);
});
