// Tests for slice 11g (docs/specs/project-process.md): the advisory docs-lint job (AC-23), the
// advisory mutation job (AC-24), and web tutorials against preview deployments (AC-33). Each test
// title cites the criterion it covers (project-process#AC-n).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { vocabulary, prepareVale } from '../checks/process-vale.mjs';
import { valeBinary } from '../checks/ci/install-vale.mjs';
import { summarize, markdown } from '../checks/ci/mutation-summary.mjs';
import { runTutorial } from '../checks/tutorial-run.mjs';

const tmp = prefix => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const workflow = file => YAML.parse(fs.readFileSync(file, 'utf8'));

// ---- AC-23: Vale --------------------------------------------------------------------------------

test('project-process#AC-23: the vocabulary has persona names and glossary terms', () => {
  const terms = vocabulary(path.resolve('test/fixtures/vale-project'));
  for (const t of ['Star', 'Kettlebird', 'Webcomic', 'Chapter']) assert.ok(terms.includes(t), t);
  assert.ok(!terms.includes('Fan and reader'), 'a descriptive title is not a term');
  assert.deepEqual(terms, [...terms].sort());
});

function vale(root) {
  const out = tmp('rfr-vale-');
  const { config, paths } = prepareVale(root, out);
  assert.deepEqual(paths.map(p => path.relative(root, p)).sort(), ['docs/tutorials', 'docs/user']);
  const r = spawnSync(valeBinary(), ['--config', config, '--output', 'JSON', '--no-exit', ...paths], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const alerts = Object.entries(JSON.parse(r.stdout)).flatMap(([file, list]) => list.map(a => ({ file: path.basename(file), check: a.Check, match: a.Match })));
  return alerts;
}

test('project-process#AC-23: the style flags emphatic capitals, "not X, it is Y", em dashes, US spellings, and miscased terms', () => {
  const alerts = vale(path.resolve('test/fixtures/vale-project'));
  const has = (check, file) => alerts.some(a => a.check === check && a.file === file);
  assert.ok(has('RFR.EmphaticCaps', 'reading.md'), JSON.stringify(alerts));
  assert.ok(has('RFR.NotXItsY', 'reading.md'), JSON.stringify(alerts));
  assert.ok(has('RFR.EmDashes', 'reading.md'), JSON.stringify(alerts));
  assert.ok(has('RFR.Canadian', 'first.md'), JSON.stringify(alerts));
  assert.ok(alerts.some(a => a.check === 'Vale.Terms' && a.match === 'kettlebird'), JSON.stringify(alerts));
  assert.ok(!alerts.some(a => a.check === 'RFR.Canadian' && a.file === 'reading.md'), 'colour is fine');
  assert.ok(!alerts.some(a => a.check === 'Vale.Spelling'), 'no US dictionary spelling check');
});

test('project-process#AC-23: the reusable workflow has an advisory docs-lint job running Vale', () => {
  const job = workflow('.github/workflows/rfr-process.yml').jobs['docs-lint'];
  assert.ok(job, 'docs-lint job');
  assert.equal(job['continue-on-error'], true);
  const run = job.steps.map(s => s.run ?? '').join('\n');
  assert.match(run, /install-vale\.mjs/);
  assert.match(run, /process-vale\.mjs/);
  assert.match(run, /GITHUB_STEP_SUMMARY/);
});

// ---- AC-24: Stryker -----------------------------------------------------------------------------

test('project-process#AC-24: the web-app and static-site profiles ship an incremental Stryker configuration', async () => {
  for (const p of ['web-app', 'static-site']) {
    const file = path.resolve('plugins/process/templates/profiles', p, 'stryker.config.mjs');
    const config = (await import(pathToFileURL(file).href)).default;
    assert.equal(config.incremental, true, p);
    assert.equal(config.incrementalFile, 'reports/stryker-incremental.json', p);
    assert.ok(config.reporters.includes('json'), p);
    assert.equal(config.jsonReporter.fileName, 'reports/mutation/mutation.json', p);
    assert.equal(config.thresholds?.break ?? null, null, `${p}: advisory, never breaks the build`);
  }
});

test('project-process#AC-24: the mutation job is advisory, runs on story and epic pull requests, and runs in full when tests change', () => {
  const wf = workflow('.github/workflows/rfr-process.yml');
  assert.equal(wf.on.workflow_call.inputs.mutation.default, false);
  const job = wf.jobs.mutation;
  assert.ok(job, 'mutation job');
  assert.equal(job['continue-on-error'], true);
  assert.match(job.if, /inputs\.mutation/);
  assert.match(job.if, /tier:story/);
  assert.match(job.if, /tier:epic/);
  const run = job.steps.map(s => s.run ?? '').join('\n');
  assert.match(run, /stryker run/);
  assert.match(run, /--incremental/);
  assert.match(run, /--force/);
  assert.match(run, /mutation-summary\.mjs/);
  assert.match(run, /GITHUB_STEP_SUMMARY/);
  assert.ok(job.steps.some(s => /actions\/cache/.test(s.uses ?? '')), 'the incremental file is cached');
});

test('project-process#AC-24: a Stryker run on the fixture project gives a score, and the summary lists survivors', () => {
  const dir = tmp('rfr-mutation-');
  fs.cpSync(path.resolve('test/fixtures/mutation-project'), dir, { recursive: true });
  const bin = path.resolve('node_modules/@stryker-mutator/core/bin/stryker.js');
  // The child test runs must not report to this test runner.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [bin, 'run'], { cwd: dir, encoding: 'utf8', timeout: 240000, env });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'reports/mutation/mutation.json'), 'utf8'));
  const s = summarize(report);
  assert.ok(s.total > 0);
  assert.ok(s.killed > 0);
  assert.ok(s.survived > 0, 'the fixture test misses the boundary');
  assert.ok(s.score > 0 && s.score < 100);
  assert.ok(fs.existsSync(path.join(dir, 'reports/stryker-incremental.json')), 'incremental file written');
  const md = markdown(s);
  assert.match(md, /Mutation score/);
  assert.match(md, new RegExp(`${s.score.toFixed(1)}%`));
  assert.match(md, /src\/price\.mjs:\d+/);
});

test('project-process#AC-24: the summary counts statuses as Stryker does', () => {
  const mutant = (status, line = 1) => ({ id: String(Math.random()), mutatorName: 'EqualityOperator', replacement: '>=', status, location: { start: { line, column: 1 }, end: { line, column: 2 } } });
  const report = { files: { 'src/a.ts': { mutants: [mutant('Killed'), mutant('Killed'), mutant('Timeout'), mutant('Survived', 7), mutant('NoCoverage', 9), mutant('Ignored'), mutant('CompileError')] } } };
  const s = summarize(report);
  assert.equal(s.total, 5);
  assert.equal(s.score, 60);
  assert.deepEqual(s.survivors.map(x => `${x.file}:${x.line}`), ['src/a.ts:7', 'src/a.ts:9']);
});

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
