// Tests for the advisory mutation job (docs/specs/project-process.md): the Stryker configuration
// and job (AC-24), and the score as an annotation (AC-37). Moved unchanged from the slice 11g and
// pilot-round files (rewrite plan 25e). Each test title cites the criterion it covers
// (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { annotation, summarize, markdown } from '../checks/ci/mutation-summary.mjs';

const tmp = prefix => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const workflow = file => YAML.parse(fs.readFileSync(file, 'utf8'));

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

test('project-process#AC-24: the mutation job is advisory, runs on feature pull requests, and runs in full when tests change', () => {
  const wf = workflow('.github/workflows/rfr-process.yml');
  assert.equal(wf.on.workflow_call.inputs.mutation.default, false);
  const job = wf.jobs.mutation;
  assert.ok(job, 'mutation job');
  assert.equal(job['continue-on-error'], true);
  assert.match(job.if, /inputs\.mutation/);
  assert.equal(job.needs, 'change');
  assert.match(job.if, /needs\.change\.outputs\.kind == 'feature'/);
  assert.match(wf.jobs.change.outputs.kind, /steps\.change\.outputs\.kind/);
  // The tier job is retired (rewrite plan 25e): a stub that only passes is left for required checks.
  assert.ok(!JSON.stringify(wf.jobs.tier ?? {}).includes('process-tier'), 'the tier job no longer runs the tier check');
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

// ---- AC-37: mutation score as an annotation ------------------------------------------------------

test('project-process#AC-37: the summary script prints the score as a notice annotation', () => {
  const line = annotation({ score: 87.5, total: 40, killed: 33, timeout: 2, survived: 4, noCoverage: 1, survivors: [] });
  assert.match(line, /^::notice title=Mutation score::87\.5%/);
  assert.match(line, /5 undetected/);
});

test('project-process#AC-37: the mutation job asks for the annotation', () => {
  const job = YAML.parse(fs.readFileSync('.github/workflows/rfr-process.yml', 'utf8')).jobs.mutation;
  assert.match(job.steps.map(s => s.run ?? '').join('\n'), /mutation-summary\.mjs .*--annotate/);
});
