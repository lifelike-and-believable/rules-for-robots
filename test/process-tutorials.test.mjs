// Tests for runnable tutorials (docs/specs/project-process.md, stage 12): a web tutorial's steps are
// run in a browser against the product, so a tutorial that no longer matches the product fails;
// Unreal tutorials must be cited by an automation test. Also the per-profile templates (AC-7).
// Each test title cites the criterion it covers (project-process#AC-n).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { parseSteps } from '../checks/lib/tutorial.mjs';
import { checkCoverage, runTutorial } from '../checks/tutorial-run.mjs';
import { parseArtifact } from '../checks/lib/process.mjs';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

const FIXTURE = path.resolve('test/fixtures/tutorial-web');

const TUTORIAL = `---
id: tutorial-retarget
status: approved
runner: web
---

# Tutorial: retarget a clip

## Steps

1. Open \`/index.html\`. You see **Retarget clips**.
2. Type \`Walk_01\` into **Clip name**.
3. Choose \`Quadruped\` from **Target skeleton**.
4. Check **Keep root motion**.
5. Click **Retarget**. You see **Retargeted Walk_01 to Quadruped with root motion**.
6. Select **Settings**. The settings page opens and you see **Default skeleton: Mannequin**.
`;

// Serves the fixture product. `rename` plants a UI change in index.html.
let server;
let baseUrl;
let rename = null;
before(async () => {
  server = http.createServer((req, res) => {
    const file = path.join(FIXTURE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(FIXTURE) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    let body = fs.readFileSync(file, 'utf8');
    if (rename && file.endsWith('index.html')) body = body.replace(rename.from, rename.to);
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

// ---------------------------------------------------------------------------------------------
// Step grammar

test('project-process#AC-16: tutorial steps are read into browser actions and checks', () => {
  const { steps, errors } = parseSteps(parseArtifact(TUTORIAL).body);
  assert.deepEqual(errors, []);
  assert.equal(steps.length, 6);
  assert.deepEqual(steps[0].actions, [{ type: 'goto', path: '/index.html' }, { type: 'see', text: 'Retarget clips' }]);
  assert.deepEqual(steps[1].actions, [{ type: 'fill', label: 'Clip name', value: 'Walk_01' }]);
  assert.deepEqual(steps[2].actions, [{ type: 'select', label: 'Target skeleton', value: 'Quadruped' }]);
  assert.deepEqual(steps[3].actions, [{ type: 'check', label: 'Keep root motion' }]);
  assert.deepEqual(steps[4].actions, [{ type: 'click', label: 'Retarget' }, { type: 'see', text: 'Retargeted Walk_01 to Quadruped with root motion' }]);
  assert.deepEqual(steps[5].actions, [{ type: 'click', label: 'Settings' }, { type: 'see', text: 'Default skeleton: Mannequin' }]);
});

test('project-process#AC-16: a step the runner cannot perform is an error unless it is marked manual', () => {
  const body = '## Steps\n\n1. Drag the clip onto the timeline.\n2. Drag the clip onto the timeline. (manual)\n3. Click **Save**.\n';
  const { steps, errors } = parseSteps(body);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /step 1/);
  assert.equal(steps[1].manual, true);
  assert.deepEqual(steps[1].actions, []);
  assert.deepEqual(steps[2].actions, [{ type: 'click', label: 'Save' }]);
});

test('project-process#AC-16: a tutorial without a Steps section is an error', () => {
  assert.match(parseSteps('# Tutorial\n\nSome text.\n').errors.join('\n'), /Steps/);
});

// ---------------------------------------------------------------------------------------------
// Running against the product

test('project-process#AC-16: a tutorial that matches the product passes', async () => {
  rename = null;
  const r = await runTutorial({ text: TUTORIAL, baseUrl });
  assert.equal(r.ok, true, r.failure?.message);
  assert.equal(r.steps, 6);
});

test('project-process#AC-16: after a planted UI change, the tutorial fails at the step that no longer matches', async () => {
  rename = { from: '<button type="submit">Retarget</button>', to: '<button type="submit">Apply</button>' };
  const r = await runTutorial({ text: TUTORIAL, baseUrl, timeout: 1500 });
  rename = null;
  assert.equal(r.ok, false);
  assert.equal(r.failure.step, 5);
  assert.match(r.failure.message, /Retarget/);
});

test('project-process#AC-16: a changed result message fails the check in that step', async () => {
  rename = { from: '`Retargeted ${clip}', to: '`Retarget queued for ${clip}' };
  const r = await runTutorial({ text: TUTORIAL, baseUrl, timeout: 1500 });
  rename = null;
  assert.equal(r.ok, false);
  assert.equal(r.failure.step, 5);
  assert.match(r.failure.message, /Retargeted Walk_01/);
});

test('project-process#AC-16: a renamed field label fails the step that types into it', async () => {
  rename = { from: '<label for="clip">Clip name</label>', to: '<label for="clip">Animation</label>' };
  const r = await runTutorial({ text: TUTORIAL, baseUrl, timeout: 1500 });
  rename = null;
  assert.equal(r.ok, false);
  assert.equal(r.failure.step, 2);
});

// ---------------------------------------------------------------------------------------------
// Coverage: every tutorial says how it runs; Unreal tutorials are cited by an automation test

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-tutorials-'));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}
const tutorial = (id, runner) => `---\nid: ${id}\nstatus: draft\n${runner ? `runner: ${runner}\n` : ''}---\n\n# T\n\n## Steps\n\n1. Click **Go**.\n`;

test('project-process#AC-16: an Unreal tutorial must be cited by an automation test', () => {
  const uncited = project({ 'docs/tutorials/rig.md': tutorial('tutorial-rig', 'unreal') });
  assert.match(checkCoverage(uncited).errors.join('\n'), /tutorial-rig/);
  const cited = project({
    'docs/tutorials/rig.md': tutorial('tutorial-rig', 'unreal'),
    'Source/MyPlugin/Private/Tests/RigTutorialTest.cpp': '// Follows tutorial-rig step by step.\nIMPLEMENT_SIMPLE_AUTOMATION_TEST(...)\n',
  });
  assert.deepEqual(checkCoverage(cited).errors, []);
});

test('project-process#AC-16: every tutorial names a runner, and web tutorials must have runnable steps', () => {
  const missing = project({ 'docs/tutorials/a.md': tutorial('tutorial-a', null) });
  assert.match(checkCoverage(missing).errors.join('\n'), /tutorial-a.*runner/);
  const unknown = project({ 'docs/tutorials/a.md': tutorial('tutorial-a', 'robot') });
  assert.match(checkCoverage(unknown).errors.join('\n'), /robot/);
  const manual = project({ 'docs/tutorials/a.md': tutorial('tutorial-a', 'manual') });
  assert.deepEqual(checkCoverage(manual).errors, []);
  const badSteps = project({ 'docs/tutorials/a.md': tutorial('tutorial-a', 'web').replace('Click **Go**.', 'Wave at the screen.') });
  assert.match(checkCoverage(badSteps).errors.join('\n'), /tutorial-a.*step 1/);
});

// ---------------------------------------------------------------------------------------------
// Per-profile templates (AC-7)

const PROFILES = ['unreal-plugin', 'web-app', 'static-site'];
const profileDir = p => path.resolve('plugins/process/templates/profiles', p);

test('project-process#AC-7: each profile ships persona starters and templates for user documentation and tutorials', () => {
  for (const p of PROFILES) {
    const dir = profileDir(p);
    const personas = fs.readdirSync(path.join(dir, 'personas')).filter(f => f.endsWith('.md'));
    assert.ok(personas.length >= 2, `${p}: at least two persona starters`);
    for (const f of ['user-doc.md', 'tutorial.md']) assert.ok(fs.existsSync(path.join(dir, f)), `${p}/${f}`);
    const t = parseArtifact(fs.readFileSync(path.join(dir, 'tutorial.md'), 'utf8'));
    assert.ok(t.front?.id, `${p}: tutorial template has an id`);
  }
});

test('project-process#AC-7: the tutorial templates name the runner their profile uses', () => {
  const runner = p => /^runner:\s*(\S+)/m.exec(fs.readFileSync(path.join(profileDir(p), 'tutorial.md'), 'utf8'))?.[1];
  assert.equal(runner('web-app'), 'web');
  assert.equal(runner('static-site'), 'web');
  assert.equal(runner('unreal-plugin'), 'unreal');
  const web = parseSteps(parseArtifact(fs.readFileSync(path.join(profileDir('web-app'), 'tutorial.md'), 'utf8')).body);
  assert.deepEqual(web.errors, [], 'the web-app tutorial template uses steps the runner can perform');
});

test('project-process#AC-7: persona starters pass the process check once copied into a project', () => {
  for (const p of PROFILES) {
    const root = project({
      'docs/product/process.yml': 'default: [lead]\n',
      'docs/product/concept.md': '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\nA tool.\n\n## Audience\n\nThe people it is for.\n',
    });
    const ids = [];
    for (const f of fs.readdirSync(path.join(profileDir(p), 'personas'))) {
      const text = fs.readFileSync(path.join(profileDir(p), 'personas', f), 'utf8');
      fs.mkdirSync(path.join(root, 'docs/product/personas'), { recursive: true });
      fs.writeFileSync(path.join(root, 'docs/product/personas', f), text);
      ids.push(parseArtifact(text).front.id);
    }
    relink(root, ids);
    assert.deepEqual(runProcessTrace(root).errors, [], p);
  }
});
