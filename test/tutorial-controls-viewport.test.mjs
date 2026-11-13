// Tests for how the web tutorial runner finds controls and sizes the page
// (docs/specs/project-process.md): a click by text picks the visible control (AC-49), and a tutorial
// can set its viewport (AC-50). Moved unchanged from the pilot-round files (rewrite plan 25e). Each
// test title cites the criterion it covers (project-process#AC-n).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { runTutorial } from '../checks/tutorial-run.mjs';

const FIXTURE = path.resolve('test/fixtures/tutorial-visible');
let server;
let baseUrl;
before(async () => {
  server = http.createServer((req, res) => {
    const file = path.join(FIXTURE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(FIXTURE) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(fs.readFileSync(file, 'utf8'));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const tutorial = (front = '') => `---\nid: tutorial-reader\nstatus: approved\nrunner: web\n${front}---\n\n# Tutorial: turn a page\n\n## Steps\n\n1. Open \`/index.html\`. You see **Page 1**.\n2. Click **Next**. You see **Page 2**.\n`;

test('project-process#AC-49: a click by text picks the visible control, not a hidden copy before it', async () => {
  const r = await runTutorial({ text: tutorial(), baseUrl, timeout: 3000 });
  assert.equal(r.ok, true, r.failure?.message);
});

test('project-process#AC-50: a tutorial with a viewport runs at that size', async () => {
  const text = tutorial('viewport: 390x844\n').replace('You see **Page 1**.', 'You see **Page 1**. You see **Width 390**.');
  const r = await runTutorial({ text, baseUrl, timeout: 3000 });
  assert.equal(r.ok, true, r.failure?.message);
});

test('project-process#AC-50: a malformed viewport is an error', async () => {
  const r = await runTutorial({ text: tutorial('viewport: phone\n'), baseUrl, timeout: 3000 });
  assert.equal(r.ok, false);
  assert.match(r.failure.message, /viewport/);
});
