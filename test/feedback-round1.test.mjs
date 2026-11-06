// Tests for feedback round 1 (#130, #131; docs/specs/project-process.md AC-51).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { runTutorial } from '../checks/tutorial-run.mjs';

let server;
let baseUrl;
before(async () => {
  server = http.createServer((req, res) => {
    const slow = new URL(req.url, 'http://x').pathname === '/slow.html';
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<h1>Slow page</h1>');
    }, slow ? 1500 : 0);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const tutorial = steps => `---\nid: tutorial-cold\nstatus: approved\nrunner: web\n---\n\n# Tutorial: cold start\n\n## Steps\n\n${steps}\n`;

test('project-process#AC-51: a slow first page opens within the first-load timeout', async () => {
  const r = await runTutorial({ text: tutorial('1. Open `/slow.html`. You see **Slow page**.'), baseUrl, timeout: 500 });
  assert.equal(r.ok, true, r.failure?.message);
});

test('project-process#AC-51: the same delay on a later page still fails at the step timeout', async () => {
  const r = await runTutorial({ text: tutorial('1. Open `/fast.html`. You see **Slow page**.\n2. Open `/slow.html`. You see **Slow page**.'), baseUrl, timeout: 500 });
  assert.equal(r.ok, false);
  assert.equal(r.failure.step, 2);
});
