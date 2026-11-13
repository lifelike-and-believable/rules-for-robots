// Tests for running web tutorials against preview deployments (docs/specs/project-process.md): the
// bypass header and the preview workflow (AC-33), and reporting a protected deployment (AC-36).
// Moved unchanged from the slice 11g and pilot-round files (rewrite plan 25e). Each test title cites
// the criterion it covers (project-process#AC-n).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import YAML from 'yaml';
import { runTutorial } from '../checks/tutorial-run.mjs';

const workflow = file => YAML.parse(fs.readFileSync(file, 'utf8'));

// ---- AC-33: tutorials against a preview ------------------------------------------------------------

let site;
let other;
const seen = { site: [], other: [] };
before(async () => {
  other = http.createServer((req, res) => { seen.other.push(req.headers['x-preview-bypass'] ?? null); res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'); });
  await new Promise(r => other.listen(0, '127.0.0.1', r));
  const otherUrl = `http://localhost:${other.address().port}`;
  site = http.createServer((req, res) => {
    seen.site.push(req.headers['x-preview-bypass'] ?? null);
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><title>Home</title><h1>Welcome</h1><img src="${otherUrl}/pixel.svg" alt="">`);
  });
  await new Promise(r => site.listen(0, '127.0.0.1', r));
});
after(() => { site?.close(); other?.close(); });

test('project-process#AC-33: a header for a protected preview reaches the preview origin and no other host', async () => {
  const text = '---\nid: tutorial-home\nstatus: draft\nrunner: web\n---\n\n# Tutorial\n\n## Steps\n\n1. Open `/`. You see **Welcome**.\n';
  const r = await runTutorial({ text, baseUrl: `http://127.0.0.1:${site.address().port}`, headers: { 'x-preview-bypass': 's3cret' } });
  assert.equal(r.ok, true, r.failure?.message);
  assert.ok(seen.site.length > 0 && seen.site.every(h => h === 's3cret'), JSON.stringify(seen));
  assert.ok(seen.other.length > 0, 'the page loaded the other host');
  assert.ok(seen.other.every(h => h === null), JSON.stringify(seen.other));
});

test('project-process#AC-33: the reusable workflow runs, records, and uploads tutorials for the URL it is given', () => {
  const wf = workflow('.github/workflows/rfr-tutorials-preview.yml');
  const call = wf.on.workflow_call;
  assert.equal(call.inputs['base-url'].required, true);
  assert.ok(call.secrets.RFR_PREVIEW_BYPASS, 'optional bypass secret');
  const steps = Object.values(wf.jobs)[0].steps;
  const run = steps.map(s => s.run ?? '').join('\n');
  assert.match(run, /tutorial-run\.mjs/);
  assert.match(run, /--base-url/);
  assert.match(run, /--record/);
  assert.match(run, /playwright install/);
  assert.ok(steps.some(s => /actions\/upload-artifact/.test(s.uses ?? '') && s.if === 'always()'), 'uploads the recording even on failure');
  assert.doesNotMatch(run, /RFR_PREVIEW_BYPASS/, 'the secret is passed by environment, not on the command line');
});

test('project-process#AC-33: the caller template starts it from a successful preview deployment', () => {
  const wf = workflow('plugins/process/templates/workflows/rfr-tutorials-preview.yml');
  assert.ok('deployment_status' in wf.on);
  const job = Object.values(wf.jobs)[0];
  assert.match(job.uses, /rfr-tutorials-preview\.yml@/);
  assert.match(job.if, /state == 'success'/);
  assert.match(job.if, /[Pp]roduction/);
  assert.match(job.with['base-url'], /environment_url/);
});

// ---- AC-36: protected previews --------------------------------------------------------------------

let locked;
let redirecting;
let login;
before(async () => {
  login = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<title>Log in</title><h1>Log in to Vercel</h1>'); });
  await new Promise(r => login.listen(0, '127.0.0.1', r));
  const loginUrl = `http://localhost:${login.address().port}/login`;
  locked = http.createServer((req, res) => { res.writeHead(401, { 'content-type': 'text/html' }); res.end('<h1>Authentication required</h1>'); });
  await new Promise(r => locked.listen(0, '127.0.0.1', r));
  redirecting = http.createServer((req, res) => { res.writeHead(302, { location: loginUrl }); res.end(); });
  await new Promise(r => redirecting.listen(0, '127.0.0.1', r));
});
after(() => { locked?.close(); redirecting?.close(); login?.close(); });

const TUTORIAL = '---\nid: tutorial-home\nstatus: draft\nrunner: web\n---\n\n# Tutorial\n\n## Steps\n\n1. Open `/`. You see **Comics**.\n';

test('project-process#AC-36: a 401 is reported as a protected deployment, naming the bypass setting', async () => {
  const r = await runTutorial({ text: TUTORIAL, baseUrl: `http://127.0.0.1:${locked.address().port}`, timeout: 1500 });
  assert.equal(r.ok, false);
  assert.match(r.failure.message, /protected/);
  assert.match(r.failure.message, /RFR_PREVIEW_BYPASS|RFR_TUTORIAL_HEADER/);
});

test('project-process#AC-36: landing on another origin is reported as a protected deployment', async () => {
  const r = await runTutorial({ text: TUTORIAL, baseUrl: `http://127.0.0.1:${redirecting.address().port}`, timeout: 1500 });
  assert.equal(r.ok, false);
  assert.match(r.failure.message, /protected/);
  assert.match(r.failure.message, /localhost:\d+/, 'names where it landed');
});
