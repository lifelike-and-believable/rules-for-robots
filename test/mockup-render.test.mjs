// Tests for rendering mock-ups (docs/specs/revisions-and-foundations.md, AC-16): checks/mockup-render.mjs
// renders each mock-up HTML page under docs/design/ to a PNG beside it, at phone size too when the
// page has a <page>-phone.png, with no network, and records in .rendered.json what each PNG was
// rendered from. These tests run a real browser, so the pages are tiny and the browser is shared.
// Each test title cites the criterion it covers.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { renderMockups } from '../checks/mockup-render.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

const RENDERER = path.resolve('checks/mockup-render.mjs');

let browser;
before(async () => { browser = await createRequire(import.meta.url)('playwright').chromium.launch(); });
after(async () => { await browser?.close(); });

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-mockup-render-'));
const write = (root, file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};
// The hash the record should hold: of the bytes, with CRLF line endings made LF for text files.
const sha = text => crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
const pngSize = file => {
  const buf = fs.readFileSync(file);
  assert.equal(buf.subarray(1, 4).toString('latin1'), 'PNG', `${file} is a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
};
const readRecord = (root, folder) => JSON.parse(fs.readFileSync(path.join(root, folder, '.rendered.json'), 'utf8'));
const sorted = keys => [...keys].sort();
const PAGE = body => `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body>${body}</body></html>\n`;

test('revisions-and-foundations#AC-16: a fresh render writes each PNG and records its source, size, and the hash of the HTML and each local file it references', async () => {
  const root = tmp();
  // The shared stylesheet is outside the design's folder, has CRLF line endings, and points at an
  // image of its own with url(...).
  const css = 'body { font-family: sans-serif; }\r\n.hero { background: url("img/bg.svg"); }\r\n';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>\n';
  const html = PAGE('<link rel="stylesheet" href="../wireframe.css"><link rel="stylesheet" href="https://example.com/remote.css"><div class="hero">Board</div><img src="logo.svg" alt=""><a href="other.html">Other</a><a href="#top">Top</a><script src="page.js"></script>');
  write(root, 'docs/design/wireframe.css', css);
  write(root, 'docs/design/img/bg.svg', svg);
  write(root, 'docs/design/board/logo.svg', svg);
  write(root, 'docs/design/board/page.js', 'document.title = "Board";\n');
  write(root, 'docs/design/board/page.html', html);
  write(root, 'docs/design/board/other.html', PAGE('<p>Other</p>'));

  await renderMockups(root, { browser });

  for (const name of ['page.png', 'other.png']) {
    const size = pngSize(path.join(root, 'docs/design/board', name));
    assert.equal(size.width, 1280, `${name} width`);
    assert.ok(size.height >= 800, `${name} is at least 800 high`);
  }
  assert.equal(fs.existsSync(path.join(root, 'docs/design/board/page-phone.png')), false, 'no phone render without a phone image');

  const record = readRecord(root, 'docs/design/board');
  assert.deepEqual(record, {
    'other.png': { source: 'other.html', width: 1280, height: 800, inputs: { 'docs/design/board/other.html': sha(PAGE('<p>Other</p>')) } },
    'page.png': {
      source: 'page.html',
      width: 1280,
      height: 800,
      inputs: {
        'docs/design/board/logo.svg': sha(svg),
        'docs/design/board/page.html': sha(html),
        'docs/design/board/page.js': sha('document.title = "Board";\n'),
        'docs/design/img/bg.svg': sha(svg),
        'docs/design/wireframe.css': sha(css),
      },
    },
  });
  // Keys are sorted, so the file is the same however it was rendered.
  assert.deepEqual(Object.keys(record), sorted(Object.keys(record)));
  assert.deepEqual(Object.keys(record['page.png'].inputs), sorted(Object.keys(record['page.png'].inputs)));

  // Freshly rendered, the process check has nothing to say about the images.
  const fresh = runProcessTrace(root);
  assert.deepEqual(fresh.errors, []);
  assert.deepEqual(fresh.warnings.filter(w => /png|mock-up/.test(w)), []);

  // A change to the shared stylesheet outside the folder makes page.png stale, and only page.png.
  write(root, 'docs/design/wireframe.css', `${css}.hero { color: red; }\n`);
  assert.deepEqual(runProcessTrace(root).errors, [
    'docs/design/board/page.png: rendered from page.html, but docs/design/wireframe.css changed since; render it again with node .rfr/checks/mockup-render.mjs docs/design/board',
  ]);
});

test('revisions-and-foundations#AC-16: a page with <page>-phone.png beside it is also rendered at phone size, 390 by 844', async () => {
  const root = tmp();
  write(root, 'docs/design/work/work.html', PAGE('<p>Work</p>'));
  write(root, 'docs/design/work/work-phone.png', 'not yet a real image');
  write(root, 'docs/design/work/solo.html', PAGE('<p>Solo</p>'));

  await renderMockups(root, { browser });

  assert.equal(pngSize(path.join(root, 'docs/design/work/work-phone.png')).width, 390);
  assert.equal(pngSize(path.join(root, 'docs/design/work/work.png')).width, 1280);
  assert.equal(fs.existsSync(path.join(root, 'docs/design/work/solo-phone.png')), false);
  const record = readRecord(root, 'docs/design/work');
  assert.deepEqual(Object.keys(record), ['solo.png', 'work-phone.png', 'work.png']);
  assert.deepEqual({ ...record['work-phone.png'], inputs: undefined }, { source: 'work.html', width: 390, height: 844, inputs: undefined });
});

test('revisions-and-foundations#AC-16: a size in the record wins over the default when the page is rendered again', async () => {
  const root = tmp();
  write(root, 'docs/design/work/work.html', PAGE('<p>Work</p>'));
  write(root, 'docs/design/work/.rendered.json', `${JSON.stringify({ 'work-phone.png': { source: 'work.html', width: 414, height: 896, inputs: {} } }, null, 2)}\n`);

  await renderMockups(root, { browser });

  assert.equal(pngSize(path.join(root, 'docs/design/work/work-phone.png')).width, 414);
  const record = readRecord(root, 'docs/design/work');
  assert.equal(record['work-phone.png'].width, 414);
  assert.equal(record['work-phone.png'].height, 896);
  assert.equal(record['work.png'].width, 1280);
});

test('revisions-and-foundations#AC-16: rendering makes no network request, and blocks files outside the repository', async () => {
  let hits = 0;
  const server = http.createServer((req, res) => { hits += 1; res.end('body { color: red; }'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const remote = `http://127.0.0.1:${server.address().port}`;
  try {
    const parent = tmp();
    const root = path.join(parent, 'repo');
    write(parent, 'outside.css', 'body { color: blue; }\n');
    write(root, 'docs/design/net/page.html', PAGE(`<link rel="stylesheet" href="${remote}/a.css"><link rel="stylesheet" href="../../../../outside.css"><img src="${remote}/b.png" alt="">`));

    const result = await renderMockups(root, { browser });

    assert.equal(hits, 0, 'the local server saw no request');
    const blocked = result.folders.flatMap(f => f.blocked);
    assert.ok(blocked.includes(`${remote}/a.css`), blocked.join(', '));
    assert.ok(blocked.includes(`${remote}/b.png`), blocked.join(', '));
    assert.ok(blocked.some(u => u.startsWith('file:') && u.endsWith('/outside.css')), blocked.join(', '));
    assert.deepEqual(Object.keys(readRecord(root, 'docs/design/net')['page.png'].inputs), ['docs/design/net/page.html']);
  } finally {
    server.close();
  }
});

test('revisions-and-foundations#AC-16: the command renders the folder it is given, and --only renders one page and keeps the rest of the record', () => {
  const root = tmp();
  write(root, 'docs/design/board/a.html', PAGE('<p>A</p>'));
  write(root, 'docs/design/board/b.html', PAGE('<p>B</p>'));
  write(root, 'docs/design/other/c.html', PAGE('<p>C</p>'));

  const only = spawnSync(process.execPath, [RENDERER, 'docs/design/board', '--only', 'a.html'], { cwd: root, encoding: 'utf8' });
  assert.equal(only.status, 0, only.stderr);
  assert.deepEqual(Object.keys(readRecord(root, 'docs/design/board')), ['a.png']);
  assert.equal(fs.existsSync(path.join(root, 'docs/design/board/b.png')), false);

  const all = spawnSync(process.execPath, [RENDERER, 'docs/design/board'], { cwd: root, encoding: 'utf8' });
  assert.equal(all.status, 0, all.stderr);
  assert.deepEqual(Object.keys(readRecord(root, 'docs/design/board')), ['a.png', 'b.png']);
  assert.equal(fs.existsSync(path.join(root, 'docs/design/other/c.png')), false, 'only the folder named was rendered');
});
