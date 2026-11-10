// The step that opens a tutorial's first page keeps the first-load timeout for its later actions
// too (docs/specs/project-process.md AC-51, amended 2026-11-10).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { runTutorial } from '../checks/tutorial-run.mjs';

let server;
let baseUrl;
before(async () => {
  // /late.html loads at once and shows its heading a second later, as a page that renders on the
  // client does when it is cold.
  server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(new URL(req.url, 'http://x').pathname === '/late.html'
      ? '<body><script>setTimeout(() => { document.body.innerHTML = "<h1>Late heading</h1>"; }, 1000)</script></body>'
      : '<h1>Start</h1>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const tutorial = steps => `---\nid: tutorial-late\nstatus: approved\nrunner: web\n---\n\n# Tutorial: late render\n\n## Steps\n\n${steps}\n`;

test('project-process#AC-51: text that renders late on the first page is seen within step 1', async () => {
  const r = await runTutorial({ text: tutorial('1. Open `/late.html`. You see **Late heading**.'), baseUrl, timeout: 300 });
  assert.equal(r.ok, true, r.failure?.message);
});

test('project-process#AC-51: the same late text in a later step fails at the step timeout', async () => {
  const r = await runTutorial({ text: tutorial('1. Open `/start.html`. You see **Start**.\n2. Open `/late.html`. You see **Late heading**.'), baseUrl, timeout: 300 });
  assert.equal(r.ok, false);
  assert.equal(r.failure.step, 2);
});
