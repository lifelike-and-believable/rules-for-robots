// Tests for stale mock-up images (docs/specs/revisions-and-foundations.md, AC-16, D5): the process
// check compares the hashes recorded in each design folder's .rendered.json with the files as they
// are now, and fails a PNG whose HTML, stylesheet, or image changed since it was rendered. It warns
// about a PNG that has an HTML page of its name and no record, and leaves alone a PNG with no HTML
// source. It runs no browser. The records here are written by hand, so these tests need none either.
// Each test title cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runProcessTrace } from '../checks/process-trace.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-mockup-stale-'));
const write = (root, file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};
const sha = text => crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
const CSS = '.card { border: 1px solid; }\n';
const HTML = '<!doctype html><link rel="stylesheet" href="../wireframe.css"><p>Board</p>\n';
const RENDER = folder => `render it again with node .rfr/checks/mockup-render.mjs ${folder}`;

// A design folder laid out as XR Studio In A Box has it: pages, a PNG of each, a phone PNG named
// after a page, and a stylesheet shared by every folder, one level up. `record` writes .rendered.json.
function project({ record = true } = {}) {
  const root = tmp();
  write(root, 'docs/design/wireframe.css', CSS);
  write(root, 'docs/design/board/board.html', HTML);
  write(root, 'docs/design/board/board.png', 'png');
  write(root, 'docs/design/board/board-phone.png', 'png');
  const inputs = { 'docs/design/board/board.html': sha(HTML), 'docs/design/wireframe.css': sha(CSS) };
  if (record) {
    write(root, 'docs/design/board/.rendered.json', `${JSON.stringify({
      'board-phone.png': { source: 'board.html', width: 320, height: 640, inputs },
      'board.png': { source: 'board.html', width: 1280, height: 800, inputs },
    }, null, 2)}\n`);
  }
  return root;
}

test('revisions-and-foundations#AC-16: recorded images whose inputs are unchanged pass, and line endings do not count as a change', () => {
  const root = project();
  // The same stylesheet checked out with Windows line endings.
  write(root, 'docs/design/wireframe.css', CSS.replace(/\n/g, '\r\n'));
  const r = runProcessTrace(root);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('revisions-and-foundations#AC-16: a changed stylesheet outside the folder fails each image rendered from it, naming the file and the command', () => {
  const root = project();
  write(root, 'docs/design/wireframe.css', `${CSS}.card { padding: 8px; }\n`);
  assert.deepEqual(runProcessTrace(root).errors, [
    `docs/design/board/board-phone.png: rendered from board.html, but docs/design/wireframe.css changed since; ${RENDER('docs/design/board')}`,
    `docs/design/board/board.png: rendered from board.html, but docs/design/wireframe.css changed since; ${RENDER('docs/design/board')}`,
  ]);
});

test('revisions-and-foundations#AC-16: a changed HTML page fails its images', () => {
  const root = project();
  write(root, 'docs/design/board/board.html', HTML.replace('Board', 'Board, changed'));
  const errors = runProcessTrace(root).errors;
  assert.equal(errors.length, 2);
  assert.ok(errors.every(e => e.includes('but docs/design/board/board.html changed since')), errors.join('\n'));
});

test('revisions-and-foundations#AC-16: an input that is gone fails the image too', () => {
  const root = project();
  fs.rmSync(path.join(root, 'docs/design/wireframe.css'));
  assert.deepEqual(runProcessTrace(root).errors, [
    `docs/design/board/board-phone.png: rendered from board.html, but docs/design/wireframe.css no longer exists; ${RENDER('docs/design/board')}`,
    `docs/design/board/board.png: rendered from board.html, but docs/design/wireframe.css no longer exists; ${RENDER('docs/design/board')}`,
  ]);
});

test('revisions-and-foundations#AC-16: a phone image with no record, beside a page of its name, is warned about like any other', () => {
  const root = project();
  write(root, 'docs/design/board/compare.html', HTML);
  write(root, 'docs/design/board/compare-phone.png', 'png');
  const r = runProcessTrace(root);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, [
    'docs/design/board/compare-phone.png is not tracked; render its folder once (node .rfr/checks/mockup-render.mjs docs/design/board) so a change to its HTML or styles is caught',
  ]);
});

test('revisions-and-foundations#AC-16: an unrecorded image is a warning, and a folder with no record gets one warning, not one per image', () => {
  const root = project({ record: false });
  write(root, 'docs/design/board/empty.html', HTML);
  write(root, 'docs/design/board/empty.png', 'png');
  const r = runProcessTrace(root);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, [
    'docs/design/board: 3 mock-up images are not tracked; render the folder once (node .rfr/checks/mockup-render.mjs docs/design/board) so a change to their HTML or styles is caught',
  ]);
});

test('revisions-and-foundations#AC-16: an image with no HTML source is not checked', () => {
  const root = project();
  // A hand-made image, a phone image whose page does not exist, and an image in a folder of its own.
  write(root, 'docs/design/board/sketch.png', 'png');
  write(root, 'docs/design/board/settings-phone.png', 'png');
  write(root, 'docs/design/figma/export.png', 'png');
  const r = runProcessTrace(root);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('revisions-and-foundations#AC-16: a .rendered.json that cannot be read is an error naming it', () => {
  const root = project();
  write(root, 'docs/design/board/.rendered.json', '{ not json');
  const errors = runProcessTrace(root).errors;
  assert.equal(errors.length, 1, errors.join('\n'));
  assert.match(errors[0], /^docs\/design\/board\/\.rendered\.json cannot be read/);
  assert.ok(errors[0].includes('node .rfr/checks/mockup-render.mjs docs/design/board'), errors[0]);
});

const OUTSIDE = (p, folder = 'docs/design/board') => `${folder}/.rendered.json lists ${p}, which is outside the repository; render the folder again with node .rfr/checks/mockup-render.mjs ${folder}`;

test('revisions-and-foundations#AC-16: a record that lists a path outside the repository is an error, and the path is not read', () => {
  const parent = tmp();
  const root = path.join(parent, 'repo');
  write(parent, 'secret.txt', 'secret\n');
  write(root, 'docs/design/board/board.html', HTML);
  write(root, 'docs/design/board/board.png', 'png');
  write(root, 'docs/design/board/.rendered.json', JSON.stringify({
    'board.png': { source: 'board.html', width: 1280, height: 800, inputs: { 'docs/design/board/board.html': sha(HTML), '../secret.txt': sha('secret\n') } },
    '../../../../x.png': { source: 'board.html', width: 1280, height: 800, inputs: {} },
  }));
  assert.deepEqual(runProcessTrace(root).errors, [OUTSIDE('../../../../x.png'),OUTSIDE('../secret.txt')]);
  // A wrong hash for the outside file makes no difference: it is never read, so never compared.
  write(root, 'docs/design/board/.rendered.json', JSON.stringify({
    'board.png': { source: 'board.html', width: 1280, height: 800, inputs: { 'docs/design/board/board.html': sha(HTML), '../secret.txt': 'f'.repeat(64) } },
  }));
  assert.deepEqual(runProcessTrace(root).errors, [OUTSIDE('../secret.txt')]);
});

test('revisions-and-foundations#AC-16: a recorded input reached through a junction or symlink that leads outside is an error', () => {
  const parent = tmp();
  const root = path.join(parent, 'repo');
  write(parent, 'outside/style.css', CSS);
  write(root, 'docs/design/board/board.html', HTML);
  write(root, 'docs/design/board/board.png', 'png');
  fs.symlinkSync(path.join(parent, 'outside'), path.join(root, 'docs/design/shared'), 'junction');
  write(root, 'docs/design/board/.rendered.json', JSON.stringify({
    'board.png': { source: 'board.html', width: 1280, height: 800, inputs: { 'docs/design/board/board.html': sha(HTML), 'docs/design/shared/style.css': sha(CSS) } },
  }));
  assert.deepEqual(runProcessTrace(root).errors, [OUTSIDE('docs/design/shared/style.css')]);
});

// A small process project whose design for the board lives beside its mock-up folder, so the design
// stage's approvers are the ones to assign when an image is stale.
function processProject() {
  const root = project();
  write(root, 'docs/product/process.yml', 'mode: team\ndefault: [lead]\nstages:\n  design: [designer]\n');
  write(root, 'docs/product/concept.md', '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\nOne.\n');
  write(root, 'docs/product/personas/animator.md', '---\nid: persona-animator\nstatus: approved\nderived-from:\n  - concept:\n---\n\n# Animator\n\n## Goals\n\nFast.\n');
  write(root, 'docs/product/epics/board.md', '---\nid: epic-board\nstatus: approved\nderived-from:\n  - persona-animator:\n---\n\n# Board\n');
  write(root, 'docs/product/stories/board.md', '---\nid: story-board\nstatus: approved\nderived-from:\n  - persona-animator:\n  - epic-board:\n---\n\n# See the board\n\nAs an animator, I want to see the board so that I know what is next.\n\n## Acceptance criteria\n\n- The board lists the work.\n');
  write(root, 'docs/design/board.md', '---\nid: design-board\nstatus: approved\nderived-from:\n  - story-board:\n---\n\n# Board\n\nThe board.\n');
  write(root, 'docs/design/settings.md', '---\nid: design-settings\nstatus: approved\nderived-from:\n  - story-board:\n---\n\n# Settings\n\nThe settings.\n');
  return root;
}

test('revisions-and-foundations#AC-16: a stale image puts its folder\'s design among those involved, so the stale issue goes to the design approvers', async () => {
  const { relink } = await import('../checks/process-relink.mjs');
  const { staleAssignees } = await import('../checks/process-trace.mjs');
  const root = processProject();
  relink(root, ['persona-animator', 'epic-board', 'story-board', 'design-board', 'design-settings']);
  const clean = runProcessTrace(root);
  assert.deepEqual(clean.errors, [], 'the project is clean before the change');
  assert.deepEqual(clean.involved, []);
  write(root, 'docs/design/wireframe.css', `${CSS}.card { margin: 0; }\n`);
  assert.deepEqual(runProcessTrace(root).involved, ['design-board']);
  assert.deepEqual(staleAssignees(root), ['designer']);
});

test('revisions-and-foundations#AC-16: a stale image in a folder no design matches involves every design', async () => {
  const { relink } = await import('../checks/process-relink.mjs');
  const root = processProject();
  fs.renameSync(path.join(root, 'docs/design/board.md'), path.join(root, 'docs/design/board-design.md'));
  relink(root, ['persona-animator', 'epic-board', 'story-board', 'design-board', 'design-settings']);
  assert.deepEqual(runProcessTrace(root).involved, []);
  write(root, 'docs/design/wireframe.css', `${CSS}.card { margin: 0; }\n`);
  assert.deepEqual(runProcessTrace(root).involved, ['design-board', 'design-settings']);
});

// The check needing no browser. The process check and its modules are copied into a temporary folder
// with no node_modules above it, and run there in a child process, so nothing can resolve playwright:
// a static import of it would fail to load, and a dynamic one would throw. The child first proves that
// playwright really cannot be resolved from the copy (otherwise the test would pass for the wrong
// reason), then runs the check on a project with a stale image and expects the stale error.
test('revisions-and-foundations#AC-16: the check finds a stale image with no browser and no Playwright installed', () => {
  const root = project();
  write(root, 'docs/design/wireframe.css', `${CSS}.card { margin: 0; }\n`);
  const copy = tmp();
  fs.mkdirSync(path.join(copy, 'checks/lib'), { recursive: true });
  fs.copyFileSync(path.resolve('checks/process-trace.mjs'), path.join(copy, 'checks/process-trace.mjs'));
  for (const f of fs.readdirSync(path.resolve('checks/lib'))) fs.copyFileSync(path.resolve('checks/lib', f), path.join(copy, 'checks/lib', f));
  const probe = path.join(copy, 'probe.mjs');
  fs.writeFileSync(probe, [
    "import { createRequire } from 'node:module';",
    "import { pathToFileURL } from 'node:url';",
    'const [check, root] = process.argv.slice(2);',
    "let found = null; try { found = createRequire(check).resolve('playwright'); } catch { /* as intended */ }",
    "if (found) { console.log(JSON.stringify({ playwright: found })); process.exit(0); }",
    'const { runProcessTrace } = await import(pathToFileURL(check).href);',
    'console.log(JSON.stringify(runProcessTrace(root)));',
  ].join('\n'));
  const r = spawnSync(process.execPath, [probe, path.join(copy, 'checks/process-trace.mjs'), root], { cwd: copy, encoding: 'utf8', env: { ...process.env, NODE_PATH: '' } });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.playwright, undefined, `playwright resolves from the copy (${out.playwright}), so this test cannot show the check runs without it`);
  assert.ok(out.errors.some(e => e.startsWith('docs/design/board/board.png: rendered from board.html, but docs/design/wireframe.css changed since')), out.errors.join('\n'));
});
