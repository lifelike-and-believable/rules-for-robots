// Tests that a tutorial names no machine and no build (docs/specs/lasting-tutorials.md, AC-2).
// Each test title cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkCoverage } from '../checks/tutorial-run.mjs';

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-tutorial-body-'));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

const make = ({ runner = 'web', before = '- An account with the editor role.', steps = '1. Open `/clips`. You see **Clips**.\n2. Type `Walk_01` into **Clip name**.\n3. Click **Export**.', extra = '', file = 'export' } = {}) =>
  project({ [`docs/tutorials/${file}.md`]: `---\nid: tutorial-export\nstatus: draft\nrunner: ${runner}\n---\n\n# Tutorial: export a clip\n\n## Before you start\n\n${before}\n\n## Steps\n\n${steps}\n${extra}` });
const errorsOf = (root) => checkCoverage(root).errors.join('\n');

test('lasting-tutorials#AC-2: a clean tutorial passes with no errors or warnings', () => {
  const r = checkCoverage(make());
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('lasting-tutorials#AC-2: a localhost or loopback address anywhere in the body fails', () => {
  for (const address of ['http://localhost:3000', '127.0.0.1', '[::1]']) {
    assert.match(errorsOf(make({ extra: `\nThe product runs at ${address}.\n` })), /tutorial-export: names a machine/, address);
  }
});

test('lasting-tutorials#AC-2: a step that opens the product by an absolute URL fails', () => {
  const steps = '1. Open `https://app.example.com/clips`. You see **Clips**.\n2. Click **Export**.';
  assert.match(errorsOf(make({ steps })), /tutorial-export: step 1 opens the product by an absolute address/);
});

test('lasting-tutorials#AC-2: a fenced code block in "Before you start" or "Steps" fails', () => {
  assert.match(errorsOf(make({ before: '```\nnpm run dev\n```' })), /"Before you start" has a fenced code block/);
  assert.match(errorsOf(make({ steps: '1. Click **Export**.\n\n```sh\nls\n```' })), /"Steps" has a fenced code block/);
});

test('lasting-tutorials#AC-2: an inline shell command in "Before you start" or "Steps" fails', () => {
  assert.match(errorsOf(make({ before: '- Start it with `npm run dev`.' })), /"Before you start" has a shell command \(`npm run dev`\)/);
  assert.match(errorsOf(make({ steps: '1. Click **Export**.\n2. Run `docker compose up` first.' })), /"Steps" has a shell command \(`docker compose up`\)/);
});

test('lasting-tutorials#AC-2: step-grammar inline code is not a shell command', () => {
  const steps = '1. Open `/clips`.\n2. Type `node` into **Clip name**.\n3. Choose `git` from **Kind**.\n4. Type `Walk_01` into **Clip name**.';
  assert.deepEqual(checkCoverage(make({ steps })).errors, []);
});

test('lasting-tutorials#AC-2: a heading "Run record" at any level fails', () => {
  assert.match(errorsOf(make({ extra: '\n### Run record\n\nPassed.\n' })), /tutorial-export: has a "Run record" heading/);
});

test('lasting-tutorials#AC-2: an unreal or manual tutorial may name a tool, but not a machine', () => {
  for (const runner of ['unreal', 'manual']) {
    const root = make({ runner, before: '- Install the tool with `npm install -g thing`.', extra: '\n```\nthing --help\n```\n' });
    // unreal tutorials also need an automation test citing them, which this fixture does not have.
    const errors = checkCoverage(root).errors.filter(e => !/no automation test/.test(e));
    assert.deepEqual(errors, [], runner);
    assert.match(errorsOf(make({ runner, extra: '\nOpen localhost:3000.\n' })), /names a machine/, runner);
  }
});

test('lasting-tutorials#AC-2: a tutorial with the same file name as a spec gets a warning, not an error', () => {
  const root = make({ file: 'export' });
  fs.mkdirSync(path.join(root, 'docs/specs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/specs/export.md'), '# Export spec\n');
  const r = checkCoverage(root);
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /same file name as the spec docs\/specs\/export\.md/);
});
