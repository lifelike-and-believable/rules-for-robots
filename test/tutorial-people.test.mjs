// The web runner acts as named people (docs/specs/lasting-tutorials.md, AC-3; Phase 27b). A step that
// begins "As **Name**:" runs in that person's own browser session; "Sign in as **Name**." signs it in
// through the project's sign-in path, or is a manual step when the project has none; a recording has
// one video for each person. The fixture product keeps who is signed in per session, by cookie, and
// keeps the notes people post on the server, so the only way one person sees what another did is
// through the product.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { parseSteps } from '../checks/lib/tutorial.mjs';
import { parseArtifact } from '../checks/lib/process.mjs';
import { checkCoverage, runTutorial } from '../checks/tutorial-run.mjs';

const SIGN_IN = '/try/sign-in?as={name}';

let server;
let baseUrl;
let notes = [];
let signIns = [];
before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const cookie = /(?:^|;\s*)who=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
    const who = cookie ? decodeURIComponent(cookie) : null;
    if (url.pathname === '/try/sign-in') {
      const as = url.searchParams.get('as');
      signIns.push(as);
      res.writeHead(303, { 'set-cookie': `who=${encodeURIComponent(as)}; Path=/`, location: '/board' });
      res.end();
      return;
    }
    if (url.pathname === '/post' && req.method === 'POST') {
      let data = '';
      req.on('data', c => { data += c; });
      req.on('end', () => {
        if (who) notes.push(`${who}: ${new URLSearchParams(data).get('note')}`);
        res.writeHead(303, { location: '/board' });
        res.end();
      });
      return;
    }
    if (url.pathname === '/board') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<!doctype html><title>Board</title><h1>Board</h1><p>${who ? `Signed in as ${who}` : 'Not signed in'}</p>`
        + `<ul>${notes.map(n => `<li>${n}</li>`).join('')}</ul>`
        + '<form method="post" action="/post"><label for="note">Note</label><input id="note" name="note"><button type="submit">Post</button></form>');
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const reset = () => { notes = []; signIns = []; };

const tutorial = (id, steps) => `---\nid: ${id}\nstatus: draft\nrunner: web\n---\n\n# Post a note for your team\n\nFor **a team member**.\n\n## Steps\n\n${steps}\n`;

// Jordan posts a note; Morgan Lee, in a session of their own, sees it. The last step has no name, so
// it runs as the first person, Jordan: if Morgan Lee's sign-in had replaced Jordan's, it would fail.
const TWO_PEOPLE = tutorial('tutorial-post-a-note', [
  '1. As **Jordan**: Sign in as **Jordan**. You see **Signed in as Jordan**.',
  '2. Type `Ship it` into **Note**.',
  '3. Click **Post**. You see **Jordan: Ship it**.',
  '4. As **Morgan Lee**: Sign in as **Morgan Lee**. You see **Signed in as Morgan Lee**.',
  '5. As **Morgan Lee**: Open `/board`. You see **Jordan: Ship it**.',
  '6. Open `/board`. You see **Signed in as Jordan**.',
].join('\n'));

const nonEmpty = file => fs.existsSync(file) && fs.statSync(file).size > 0;

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-people-'));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

// Runs the command line without blocking this process, which serves the fixture product.
const cli = args => new Promise(resolve => {
  execFile(process.execPath, [path.resolve('checks/tutorial-run.mjs'), ...args], { encoding: 'utf8' }, (err, stdout, stderr) => {
    resolve({ code: err ? err.code : 0, stdout, stderr });
  });
});

// ---------------------------------------------------------------------------------------------
// The grammar

test('lasting-tutorials#AC-3: "As **Name**:" names the person a step runs as, and unnamed steps run as the first person', () => {
  const { steps, errors } = parseSteps(parseArtifact(TWO_PEOPLE).body);
  assert.deepEqual(errors, []);
  assert.deepEqual(steps.map(s => s.person), ['Jordan', 'Jordan', 'Jordan', 'Morgan Lee', 'Morgan Lee', 'Jordan']);
  assert.deepEqual(steps[0].actions, [{ type: 'signin', name: 'Jordan' }, { type: 'see', text: 'Signed in as Jordan' }]);
  assert.deepEqual(steps[4].actions, [{ type: 'goto', path: '/board' }, { type: 'see', text: 'Jordan: Ship it' }]);
});

test('lasting-tutorials#AC-3: a tutorial that names nobody has no person, as before', () => {
  const { steps, errors } = parseSteps('## Steps\n\n1. Open `/board`. You see **Board**.\n2. Click **Post**.\n');
  assert.deepEqual(errors, []);
  assert.deepEqual(steps.map(s => s.person), [null, null]);
});

test('lasting-tutorials#AC-3: malformed person and sign-in sentences are errors that say how to write them', () => {
  const errorsOf = line => parseSteps(`## Steps\n\n1. ${line}\n`).errors.join('\n');
  assert.match(errorsOf('As **Jordan** click **Post**.'), /step 1 .*"As \*\*Name\*\*: <step>"/);
  assert.match(errorsOf('As Jordan: Click **Post**.'), /step 1 .*"As \*\*Name\*\*: <step>"/);
  assert.match(errorsOf('Click **Board**. As **Jordan**: Click **Post**.'), /step 1 .*start of a step/);
  assert.match(errorsOf('Sign in as Jordan.'), /step 1 .*"Sign in as \*\*Name\*\*\."/);
  assert.match(errorsOf('As **Jordan**:'), /step 1 /);
  // A session signs in as its own person only.
  const mismatch = parseSteps('## Steps\n\n1. As **Jordan**: Open `/board`.\n2. Sign in as **Morgan**.\n').errors.join('\n');
  assert.match(mismatch, /step 2 .*Morgan.*Jordan/);
  // Narration that happens to start with "As" is still narration.
  assert.deepEqual(parseSteps('## Steps\n\n1. As before, you see **Board**.\n').errors, []);
});

test('lasting-tutorials#AC-3: --coverage accepts the people grammar and reports a malformed form', async () => {
  const good = project({ 'docs/tutorials/post-a-note.md': TWO_PEOPLE });
  assert.deepEqual(checkCoverage(good).errors, []);
  const r = await cli([good, '--coverage']);
  assert.equal(r.code, 0, r.stderr);
  const bad = project({ 'docs/tutorials/post-a-note.md': TWO_PEOPLE.replace('As **Morgan Lee**: Open', 'As **Morgan Lee** Open') });
  assert.match(checkCoverage(bad).errors.join('\n'), /tutorial-post-a-note: step 5 /);
});

// ---------------------------------------------------------------------------------------------
// Running as several people

test('lasting-tutorials#AC-3: two people in separate sessions, and the second sees what the first did', async () => {
  reset();
  const r = await runTutorial({ text: TWO_PEOPLE, baseUrl, timeout: 3000, signIn: SIGN_IN });
  assert.equal(r.ok, true, r.failure?.message);
  assert.deepEqual(signIns, ['Jordan', 'Morgan Lee'], 'each person signed in once, with the name URL-encoded');
  assert.deepEqual(notes, ['Jordan: Ship it']);
});

test('lasting-tutorials#AC-3: a step that fails as a named person reports that step', async () => {
  reset();
  const text = TWO_PEOPLE.replace('5. As **Morgan Lee**: Open `/board`. You see **Jordan: Ship it**.', '5. As **Morgan Lee**: Open `/board`. You see **Morgan Lee: Ship it**.');
  const r = await runTutorial({ text, baseUrl, timeout: 1000, signIn: SIGN_IN });
  assert.equal(r.ok, false);
  assert.equal(r.failure.step, 5);
  assert.match(r.failure.message, /Morgan Lee: Ship it/);
});

test('lasting-tutorials#AC-3: without a sign-in path, a sign-in step is a manual step and is reported', async () => {
  reset();
  const text = tutorial('tutorial-look-at-the-board', [
    '1. As **Jordan**: Sign in as **Jordan**. You see **Signed in as Jordan**.',
    '2. Open `/board`. You see **Not signed in**.',
  ].join('\n'));
  const r = await runTutorial({ text, baseUrl, timeout: 3000 });
  assert.equal(r.ok, true, r.failure?.message);
  assert.deepEqual(signIns, []);
  assert.deepEqual(r.manual, [{ step: 1, person: 'Jordan' }]);

  const root = project({ 'docs/tutorials/look-at-the-board.md': text });
  const run = await cli([root, '--base-url', baseUrl]);
  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stdout, /ok {3}tutorial-look-at-the-board \(2 steps\)/);
  assert.match(run.stdout, /tutorial-look-at-the-board: step 1 signs in as Jordan by hand: no --sign-in was given, so the runner skipped it/);
});

test('lasting-tutorials#AC-3: the command line takes --sign-in, which must contain {name}', async () => {
  reset();
  const root = project({ 'docs/tutorials/post-a-note.md': TWO_PEOPLE });
  const ok = await cli([root, '--base-url', baseUrl, '--sign-in', SIGN_IN]);
  assert.equal(ok.code, 0, ok.stderr);
  assert.match(ok.stdout, /ok {3}tutorial-post-a-note \(6 steps\)/);
  assert.deepEqual(signIns, ['Jordan', 'Morgan Lee']);
  const bad = await cli([root, '--base-url', baseUrl, '--sign-in', '/try/sign-in']);
  assert.equal(bad.code, 2);
  assert.match(bad.stderr, /--sign-in must contain \{name\}/);
});

// ---------------------------------------------------------------------------------------------
// Recordings

test('lasting-tutorials#AC-3: a recording has one video for each person, and a screenshot for each step', async () => {
  reset();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-people-record-'));
  const r = await runTutorial({ text: TWO_PEOPLE, baseUrl, timeout: 3000, signIn: SIGN_IN, record: dir });
  assert.equal(r.ok, true, r.failure?.message);
  const out = path.join(dir, 'tutorial-post-a-note');
  const videos = ['video-jordan.webm', 'video-morgan-lee.webm'];
  for (const v of videos) assert.ok(nonEmpty(path.join(out, v)), v);
  assert.equal(fs.existsSync(path.join(out, 'video.webm')), false, 'no unnamed video when the tutorial names its people');
  const shots = ['01', '02', '03', '04', '05', '06'].map(n => `step-${n}.png`);
  for (const s of shots) assert.ok(nonEmpty(path.join(out, s)), s);
  assert.deepEqual([...r.artifacts].sort(), [...shots, ...videos].map(f => path.join(out, f)).sort());
});
