// The change check's public-api globs and the kind it reports to the workflow
// (docs/specs/process-state.md AC-6; project-process AC-24). matchGlob moved here from the tier
// check, and the mutation job reads the kind, when the tier job was retired (rewrite plan 25e).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { matchGlob } from '../checks/ci/process-change.mjs';

test('process-state#AC-6: public-api globs match ** across folders and * within one', () => {
  assert.equal(matchGlob('src/api/**', 'src/api/a/b.ts'), true);
  assert.equal(matchGlob('src/api/**', 'src/api/x'), true);
  assert.equal(matchGlob('src/api/**', 'src/apix/y'), false);
  assert.equal(matchGlob('*.md', 'a.md'), true);
  assert.equal(matchGlob('*.md', 'docs/a.md'), false);
  assert.equal(matchGlob('src/**/index.ts', 'src/index.ts'), true);
  assert.equal(matchGlob('a.b', 'axb'), false, 'a dot is literal');
});

test('project-process#AC-24: the change check writes its kind to the job output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-change-kind-'));
  const git = (...args) => {
    const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  fs.mkdirSync(path.join(root, 'docs/product'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/product/process.yml'), 'default: [lead]\n');
  fs.writeFileSync(path.join(root, 'README.md'), '# App\n');
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  fs.writeFileSync(path.join(root, 'README.md'), '# App\n\nMore.\n');
  git('commit', '-q', '-am', 'docs');
  const head = git('rev-parse', 'HEAD');
  const output = path.join(root, 'out.txt');
  const r = spawnSync(process.execPath, [path.resolve('checks/ci/process-change.mjs'), root], { encoding: 'utf8', env: { ...process.env, BASE_SHA: base, HEAD_SHA: head, GITHUB_OUTPUT: output } });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(output, 'utf8'), 'kind=no-source\n');
});

test('process-state#AC-6: a * inside a path with ** after it matches one folder, as an Unreal public-api glob needs', () => {
  assert.equal(matchGlob('Source/*/Public/**', 'Source/MyPlugin/Public/A/B.h'), true);
  assert.equal(matchGlob('Source/*/Public/**', 'Source/MyPlugin/Private/A.cpp'), false);
});

test('project-process#AC-57: the notify path reads the pull request number from a merge or squash subject', async () => {
  const { subjectPull } = await import('../checks/ci/process-approvals.mjs');
  assert.equal(subjectPull('Merge pull request #12 from acme/feature'), 12);
  assert.equal(subjectPull('Update the concept (#5)'), 5);
  assert.equal(subjectPull('Update the concept'), null);
  assert.equal(subjectPull('Fix #5 in the concept'), null);
});

test('project-process#AC-24: the retired tier job is a stub that passes on pull requests and runs no check', async () => {
  const { parse } = await import('yaml');
  const wf = parse(fs.readFileSync('.github/workflows/rfr-process.yml', 'utf8'));
  const job = wf.jobs.tier;
  assert.ok(job, 'a repository that still requires process / tier gets a result');
  assert.match(job.if, /pull_request/);
  assert.deepEqual(job.permissions, {});
  assert.equal(job.steps.length, 1);
  assert.doesNotMatch(job.steps[0].run, /node |exit 1/);
  assert.match(job.steps[0].run, /::notice::/);
});
