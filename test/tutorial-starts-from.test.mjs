// A tutorial can start where another ends (docs/specs/lasting-tutorials.md, AC-4; Phase 27b):
// `starts-from: <tutorial id>` in its front matter. The process check fails a name that is not a
// tutorial's id, and a cycle. The runner runs the named tutorial first, once in a run however many
// start from it, continues in the sessions it left (so nobody signs in twice), and skips, saying
// why, a tutorial whose starting tutorial did not pass. The fixture product keeps its projects on
// the server and who is signed in per session, by cookie.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { checkCoverage, runTutorials } from '../checks/tutorial-run.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

const SIGN_IN = '/try/sign-in?as={name}';

let server;
let baseUrl;
let projects = [];
let signIns = [];
let broken = false;
before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const cookie = /(?:^|;\s*)who=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
    const who = cookie ? decodeURIComponent(cookie) : null;
    const html = body => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(`<!doctype html><title>Projects</title>${body}`); };
    if (url.pathname === '/try/sign-in') {
      const as = url.searchParams.get('as');
      signIns.push(as);
      res.writeHead(303, { 'set-cookie': `who=${encodeURIComponent(as)}; Path=/`, location: '/projects' });
      res.end();
      return;
    }
    if (url.pathname === '/projects' && req.method === 'POST') {
      let data = '';
      req.on('data', c => { data += c; });
      req.on('end', () => {
        if (who) projects.push(new URLSearchParams(data).get('name'));
        res.writeHead(303, { location: '/projects' });
        res.end();
      });
      return;
    }
    if (url.pathname === '/projects/new') {
      html(`<h1>New project</h1><form method="post" action="/projects"><label for="name">Project name</label><input id="name" name="name"><button type="submit">${broken ? 'Save' : 'Create'}</button></form>`);
      return;
    }
    if (url.pathname === '/projects') {
      html(`<h1>Projects</h1><p>${who ? `Signed in as ${who}` : 'Not signed in'}</p><ul>${projects.map(p => `<li>${p}</li>`).join('')}</ul>`);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const reset = () => { projects = []; signIns = []; broken = false; };

const tutorial = ({ id, title, startsFrom = null, runner = 'web', steps }) =>
  `---\nid: ${id}\nstatus: draft\nrunner: ${runner}\n${startsFrom ? `starts-from: ${startsFrom}\n` : ''}---\n\n# ${title}\n\nFor **a project lead**.\n\n## Steps\n\n${steps}\n`;

// File names sort the dependents before the tutorial they start from, so the runner must reorder.
const SET_UP = ['docs/tutorials/c-set-up-a-project.md', tutorial({
  id: 'tutorial-set-up-a-project',
  title: 'Set up a project',
  steps: '1. As **Jordan**: Sign in as **Jordan**. You see **Signed in as Jordan**.\n2. Open `/projects/new`. Type `Moonbase` into **Project name**.\n3. Click **Create**. You see **Moonbase**.',
})];
// Names nobody, so it runs as the first person of the tutorial it starts from: Jordan.
const REVIEW = ['docs/tutorials/a-review-a-project.md', tutorial({
  id: 'tutorial-review-a-project',
  title: 'Review a project',
  startsFrom: 'tutorial-set-up-a-project',
  steps: '1. Open `/projects`. You see **Signed in as Jordan**. You see **Moonbase**.',
})];
const RENAME = ['docs/tutorials/b-rename-a-project.md', tutorial({
  id: 'tutorial-rename-a-project',
  title: 'Rename a project',
  startsFrom: 'tutorial-set-up-a-project',
  steps: '1. As **Jordan**: Open `/projects`. You see **Signed in as Jordan**. You see **Moonbase**.',
})];

function project(entries, extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-starts-from-'));
  for (const [file, text] of [...entries, ...Object.entries(extra)]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

const runAll = async (root, opts = {}) => runTutorials({ tutorials: checkCoverage(root).tutorials, baseUrl, timeout: 3000, signIn: SIGN_IN, ...opts });

const cli = args => new Promise(resolve => {
  execFile(process.execPath, [path.resolve('checks/tutorial-run.mjs'), ...args], { encoding: 'utf8' }, (err, stdout, stderr) => {
    resolve({ code: err ? err.code : 0, stdout, stderr });
  });
});

// ---------------------------------------------------------------------------------------------
// The runner

test('lasting-tutorials#AC-4: a chain of two runs the starting tutorial first, and the next continues where it ended', async () => {
  reset();
  const results = await runAll(project([REVIEW, SET_UP]));
  assert.deepEqual(results.map(r => [r.id, r.status]), [['tutorial-set-up-a-project', 'ok'], ['tutorial-review-a-project', 'ok']], JSON.stringify(results.map(r => r.failure)));
  assert.deepEqual(signIns, ['Jordan'], 'Jordan signs in once, in the starting tutorial');
  assert.deepEqual(projects, ['Moonbase']);
});

test('lasting-tutorials#AC-4: two tutorials that start from the same one run it once', async () => {
  reset();
  const results = await runAll(project([REVIEW, RENAME, SET_UP]));
  assert.deepEqual(results.map(r => [r.id, r.status]), [
    ['tutorial-set-up-a-project', 'ok'],
    ['tutorial-review-a-project', 'ok'],
    ['tutorial-rename-a-project', 'ok'],
  ], JSON.stringify(results.map(r => r.failure)));
  assert.deepEqual(signIns, ['Jordan']);
  assert.deepEqual(projects, ['Moonbase']);
});

test('lasting-tutorials#AC-4: when the starting tutorial fails, the ones that start from it are skipped, with the reason', async () => {
  reset();
  broken = true;
  const results = await runAll(project([REVIEW, RENAME, SET_UP]), { timeout: 1000 });
  assert.deepEqual(results.map(r => [r.id, r.status]), [
    ['tutorial-set-up-a-project', 'fail'],
    ['tutorial-review-a-project', 'skip'],
    ['tutorial-rename-a-project', 'skip'],
  ]);
  assert.equal(results[1].reason, 'starts from tutorial-set-up-a-project, which failed');
  broken = false;
});

test('lasting-tutorials#AC-4: the command line reports skipped tutorials apart from passes and failures, and exits non-zero', async () => {
  reset();
  broken = true;
  const root = project([REVIEW, RENAME, SET_UP]);
  const r = await cli([root, '--base-url', baseUrl, '--sign-in', SIGN_IN]);
  broken = false;
  assert.equal(r.code, 1);
  assert.equal(r.stderr.match(/FAIL tutorial-set-up-a-project:/g)?.length, 1, r.stderr);
  assert.match(r.stderr, /SKIP tutorial-review-a-project: not run, because it starts from tutorial-set-up-a-project, which failed/);
  assert.match(r.stderr, /SKIP tutorial-rename-a-project: not run, because it starts from tutorial-set-up-a-project, which failed/);
  assert.match(r.stderr, /2 tutorial\(s\) skipped because a tutorial they start from did not pass\./);
  assert.doesNotMatch(r.stdout, /^ok /m);
});

test('lasting-tutorials#AC-4: a tutorial that starts from one the runner cannot run is skipped, saying why', async () => {
  reset();
  const manual = ['docs/tutorials/c-set-up-a-project.md', SET_UP[1].replace('runner: web', 'runner: manual')];
  const results = await runAll(project([REVIEW, manual]));
  assert.deepEqual(results.map(r => [r.id, r.status]), [['tutorial-review-a-project', 'skip']]);
  assert.equal(results[0].reason, 'starts from tutorial-set-up-a-project, which is runner: manual, so the runner cannot reach the state it leaves');
  assert.deepEqual(signIns, []);
});

// ---------------------------------------------------------------------------------------------
// The names: the process check, and tutorial-run --coverage

const PROCESS_YML = { 'docs/product/process.yml': 'default: [lead]\n' };
const startsFromErrors = root => runProcessTrace(root).errors.filter(e => /starts-from/.test(e));
const simple = (id, startsFrom) => [`docs/tutorials/${id.replace(/^tutorial-/, '')}.md`, tutorial({ id, title: id, startsFrom, steps: '1. Open `/projects`. You see **Projects**.' })];

test('lasting-tutorials#AC-4: the process check accepts a starts-from that names a tutorial', () => {
  const root = project([simple('tutorial-a', 'tutorial-b'), simple('tutorial-b', null)], PROCESS_YML);
  assert.deepEqual(startsFromErrors(root), []);
  assert.deepEqual(checkCoverage(root).errors, []);
});

test('lasting-tutorials#AC-4: the process check fails a starts-from that is not the id of a tutorial', () => {
  const unknown = project([simple('tutorial-a', 'tutorial-nowhere')], PROCESS_YML);
  assert.deepEqual(startsFromErrors(unknown), ['tutorial-a: starts-from names tutorial-nowhere, which is not the id of a tutorial']);
  assert.match(checkCoverage(unknown).errors.join('\n'), /tutorial-a: starts-from names tutorial-nowhere, which is not the id of a tutorial/);
  // An artifact that is not a tutorial does not count.
  const concept = project([simple('tutorial-a', 'concept')], { ...PROCESS_YML, 'docs/product/concept.md': '---\nid: concept\nstatus: draft\n---\n\n# Concept\n' });
  assert.deepEqual(startsFromErrors(concept), ['tutorial-a: starts-from names concept, which is not the id of a tutorial']);
});

test('lasting-tutorials#AC-4: the process check fails a cycle of starts-from, including a tutorial that names itself', () => {
  const self = project([simple('tutorial-a', 'tutorial-a')], PROCESS_YML);
  assert.deepEqual(startsFromErrors(self), ['starts-from cycle: tutorial-a -> tutorial-a']);
  const loop = project([simple('tutorial-a', 'tutorial-b'), simple('tutorial-b', 'tutorial-c'), simple('tutorial-c', 'tutorial-a')], PROCESS_YML);
  assert.deepEqual(startsFromErrors(loop), ['starts-from cycle: tutorial-a -> tutorial-b -> tutorial-c -> tutorial-a']);
  assert.match(checkCoverage(loop).errors.join('\n'), /starts-from cycle: tutorial-a -> tutorial-b -> tutorial-c -> tutorial-a/);
});
