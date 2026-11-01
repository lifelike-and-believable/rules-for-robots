// Tests for recording tutorial runs (docs/specs/project-process.md, amendment): a passing run leaves
// a screenshot per step and a video, so it doubles as the stage 12 demo; a failing run leaves a
// screenshot of the page at the failing step. Each test title cites the criterion it covers.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { runTutorial } from '../checks/tutorial-run.mjs';

const FIXTURE = path.resolve('test/fixtures/tutorial-web');
const TUTORIAL = `---
id: tutorial-retarget
status: approved
runner: web
---

# Tutorial

## Steps

1. Open \`/index.html\`. You see **Retarget clips**.
2. Type \`Walk_01\` into **Clip name**.
3. Click **Retarget**. You see **Retargeted Walk_01 to Mannequin**.
`;

let server;
let baseUrl;
let broken = false;
before(async () => {
  server = http.createServer((req, res) => {
    const file = path.join(FIXTURE, new URL(req.url, 'http://x').pathname);
    if (!file.startsWith(FIXTURE) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    let body = fs.readFileSync(file, 'utf8');
    if (broken) body = body.replace('>Retarget</button>', '>Apply</button>');
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const nonEmpty = file => fs.existsSync(file) && fs.statSync(file).size > 0;

test('project-process#AC-20: a recorded passing run leaves a screenshot per step and a video', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-record-'));
  broken = false;
  const r = await runTutorial({ text: TUTORIAL, baseUrl, record: dir });
  assert.equal(r.ok, true, r.failure?.message);
  const out = path.join(dir, 'tutorial-retarget');
  for (const n of ['01', '02', '03']) assert.ok(nonEmpty(path.join(out, `step-${n}.png`)), `step-${n}.png`);
  assert.ok(nonEmpty(path.join(out, 'video.webm')), 'video.webm');
  assert.equal(fs.existsSync(path.join(out, 'failure.png')), false);
  assert.deepEqual([...r.artifacts].sort(), ['step-01.png', 'step-02.png', 'step-03.png', 'video.webm'].map(f => path.join(out, f)).sort());
});

test('project-process#AC-20: a recorded failing run leaves the steps before it and a screenshot of the failure', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-record-'));
  broken = true;
  const r = await runTutorial({ text: TUTORIAL, baseUrl, record: dir, timeout: 1500 });
  broken = false;
  assert.equal(r.ok, false);
  assert.equal(r.failure.step, 3);
  const out = path.join(dir, 'tutorial-retarget');
  assert.ok(nonEmpty(path.join(out, 'step-01.png')));
  assert.ok(nonEmpty(path.join(out, 'step-02.png')));
  assert.equal(fs.existsSync(path.join(out, 'step-03.png')), false);
  assert.ok(nonEmpty(path.join(out, 'failure.png')));
  assert.ok(nonEmpty(path.join(out, 'video.webm')));
  assert.match(r.failure.message, /failure\.png/);
});

test('project-process#AC-20: without record, nothing is written', async () => {
  const before = fs.readdirSync(os.tmpdir()).length;
  broken = false;
  const r = await runTutorial({ text: TUTORIAL, baseUrl });
  assert.equal(r.ok, true);
  assert.deepEqual(r.artifacts ?? [], []);
  assert.ok(fs.readdirSync(os.tmpdir()).length <= before + 1);
});
