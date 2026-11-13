// What a tutorial needs that a stand-in cannot give (docs/specs/lasting-tutorials.md, AC-14; Phase
// 27c). A tutorial lists services in `needs:`; process.yml's try.provides lists the services each
// place has. The runner takes --provides <list>, runs a tutorial only where every need is provided,
// and reports the others as not run here, apart from passes, failures, and skips, without failing
// the run. The process check fails a need that no place provides, and an unreadable needs: value.
// The release check's clause (a recorded run where the needs were met) is not built yet: there is no
// store of recorded runs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { needsOf } from '../checks/lib/tutorial.mjs';
import { checkCoverage, runTutorials } from '../checks/tutorial-run.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

let server;
let baseUrl;
let visits = [];
before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    visits.push(url.pathname);
    if (url.pathname === '/home' || url.pathname === '/mail') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<!doctype html><title>Home</title><h1>${url.pathname === '/home' ? 'Welcome' : 'Inbox'}</h1>`);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const tutorial = ({ id, needs = null, startsFrom = null, page = '/home', see = 'Welcome' }) =>
  `---\nid: ${id}\nstatus: draft\nrunner: web\n${needs === null ? '' : `${needs}\n`}${startsFrom ? `starts-from: ${startsFrom}\n` : ''}---\n\n# ${id}\n\nFor **a member**.\n\n## Steps\n\n1. Open \`${page}\`. You see **${see}**.\n`;

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-needs-'));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

const PLAIN = { 'docs/tutorials/a-look-at-home.md': tutorial({ id: 'tutorial-look-at-home' }) };
const MAIL = { 'docs/tutorials/b-read-mail.md': tutorial({ id: 'tutorial-read-mail', needs: 'needs: [mail, tripo]', page: '/mail', see: 'Inbox' }) };
const AFTER_MAIL = { 'docs/tutorials/c-answer-mail.md': tutorial({ id: 'tutorial-answer-mail', startsFrom: 'tutorial-read-mail', page: '/mail', see: 'Inbox' }) };

const runAll = (root, opts = {}) => runTutorials({ tutorials: checkCoverage(root).tutorials, baseUrl, timeout: 3000, ...opts });
const cli = args => new Promise(resolve => {
  execFile(process.execPath, [path.resolve('checks/tutorial-run.mjs'), ...args], { encoding: 'utf8' }, (err, stdout, stderr) => {
    resolve({ code: err ? err.code : 0, stdout, stderr });
  });
});

// ---------------------------------------------------------------------------------------------
// Reading needs:

test('lasting-tutorials#AC-14: needs: is read as an inline list or a block list', () => {
  assert.deepEqual(needsOf('---\nid: t\nneeds: [mail, tripo]\n---\n'), { needs: ['mail', 'tripo'], error: null });
  assert.deepEqual(needsOf('---\nid: t\nneeds:\n  - mail\n  - tripo\nrunner: web\n---\n'), { needs: ['mail', 'tripo'], error: null });
  assert.deepEqual(needsOf('---\nid: t\nneeds: []\n---\n'), { needs: [], error: null });
  assert.deepEqual(needsOf('---\nid: t\nrunner: web\n---\n'), { needs: null, error: null });
});

test('lasting-tutorials#AC-14: an unreadable needs: value is an error that says how to write it', () => {
  const how = 'list the services, like needs: [mail, tripo]';
  assert.deepEqual(needsOf('---\nneeds: mail\n---\n'), { needs: null, error: `needs: "mail" is not a list; ${how}` });
  assert.deepEqual(needsOf('---\nneeds: [mail, tripo\n---\n'), { needs: null, error: `needs: "[mail, tripo" is not a list; ${how}` });
  assert.deepEqual(needsOf('---\nneeds:\n---\n'), { needs: null, error: `needs: names no service; ${how}, or remove the line` });
  assert.deepEqual(needsOf('---\nneeds: [real mail]\n---\n'), { needs: null, error: `needs: "real mail" is not a service name (letters, digits, -, and _); ${how}` });
});

// ---------------------------------------------------------------------------------------------
// The runner

test('lasting-tutorials#AC-14: a tutorial whose needs are provided runs, and one whose needs are not is not run here', async () => {
  visits = [];
  const root = project({ ...PLAIN, ...MAIL });
  const provided = await runAll(root, { provides: ['mail', 'tripo', 'queue'] });
  assert.deepEqual(provided.map(r => [r.id, r.status]), [['tutorial-look-at-home', 'ok'], ['tutorial-read-mail', 'ok']]);
  visits = [];
  const missing = await runAll(root, { provides: ['mail'] });
  assert.deepEqual(missing.map(r => [r.id, r.status, r.reason ?? null]), [['tutorial-look-at-home', 'ok', null], ['tutorial-read-mail', 'not-run', 'needs tripo']]);
  assert.ok(!visits.includes('/mail'), 'a tutorial not run here opens nothing');
});

test('lasting-tutorials#AC-14: without --provides, needs are ignored and every tutorial runs, as before', async () => {
  const results = await runAll(project({ ...PLAIN, ...MAIL }));
  assert.deepEqual(results.map(r => [r.id, r.status]), [['tutorial-look-at-home', 'ok'], ['tutorial-read-mail', 'ok']]);
});

test('lasting-tutorials#AC-14: a tutorial that starts from one not run here is itself not run here', async () => {
  const results = await runAll(project({ ...MAIL, ...AFTER_MAIL }), { provides: [] });
  assert.deepEqual(results.map(r => [r.id, r.status, r.reason]), [
    ['tutorial-read-mail', 'not-run', 'needs mail, tripo'],
    ['tutorial-answer-mail', 'not-run', 'starts from tutorial-read-mail, which was not run here'],
  ]);
});

test('lasting-tutorials#AC-14: the command line reports tutorials not run here apart from the rest, and does not fail for them', async () => {
  const root = project({ ...PLAIN, ...MAIL, ...AFTER_MAIL });
  const r = await cli([root, '--base-url', baseUrl, '--provides', 'mail']);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /^ok {3}tutorial-look-at-home \(1 steps\)$/m);
  assert.match(r.stdout, /^n\/a {2}tutorial-read-mail: not run here: needs tripo$/m);
  assert.match(r.stdout, /^n\/a {2}tutorial-answer-mail: not run here: starts from tutorial-read-mail, which was not run here$/m);
  assert.match(r.stdout, /^2 tutorial\(s\) not run here, because they need a service this run does not provide \(it provides: mail\)\.$/m);
  assert.doesNotMatch(r.stderr, /SKIP|FAIL/);

  const none = await cli([root, '--base-url', baseUrl, '--provides', '']);
  assert.equal(none.code, 0, none.stderr);
  assert.match(none.stdout, /needs mail, tripo/);
  assert.match(none.stdout, /\(it provides: nothing\)/);

  const all = await cli([root, '--base-url', baseUrl]);
  assert.equal(all.code, 0, all.stderr);
  assert.doesNotMatch(all.stdout, /not run here/);
  assert.equal(all.stdout.match(/^ok /gm)?.length, 3);
});

test('lasting-tutorials#AC-14: the runner\'s coverage check fails an unreadable needs: value', () => {
  const root = project({ 'docs/tutorials/read-mail.md': tutorial({ id: 'tutorial-read-mail', needs: 'needs: mail' }) });
  assert.deepEqual(checkCoverage(root).errors, ['tutorial-read-mail: needs: "mail" is not a list; list the services, like needs: [mail, tripo]']);
});

// ---------------------------------------------------------------------------------------------
// The process check

const needsErrors = root => runProcessTrace(root).errors.filter(e => /needs/.test(e));
const withYml = (yml, tutorials) => project({ 'docs/product/process.yml': yml, ...tutorials });

test('lasting-tutorials#AC-14: the process check fails a need that no place provides', () => {
  const root = withYml('default: [lead]\ntry:\n  provides:\n    local: [mail]\n    preview: [mail]\n', MAIL);
  assert.deepEqual(needsErrors(root), ['tutorial-read-mail: needs tripo, which no place in try.provides in docs/product/process.yml provides; add it to the place that has it (local, preview, or staging), or remove it from needs']);
});

test('lasting-tutorials#AC-14: the process check accepts needs that some place provides, and does not check needs without try.provides', () => {
  const staging = withYml('default: [lead]\ntry:\n  provides:\n    local: [mail]\n    staging: [mail, tripo]\n', MAIL);
  assert.deepEqual(needsErrors(staging), []);
  const noProvides = withYml('default: [lead]\ntry:\n  local: ./try.sh\n', MAIL);
  assert.deepEqual(needsErrors(noProvides), []);
  const noTry = withYml('default: [lead]\n', MAIL);
  assert.deepEqual(needsErrors(noTry), []);
});

test('lasting-tutorials#AC-14: the process check fails an unreadable needs: value, with or without try.provides', () => {
  const bad = { 'docs/tutorials/read-mail.md': tutorial({ id: 'tutorial-read-mail', needs: 'needs: [mail' }) };
  const message = 'tutorial-read-mail: needs: "[mail" is not a list; list the services, like needs: [mail, tripo]';
  assert.deepEqual(needsErrors(withYml('default: [lead]\n', bad)), [message]);
  assert.deepEqual(needsErrors(withYml('default: [lead]\ntry:\n  provides:\n    local: [mail]\n', bad)), [message]);
});
