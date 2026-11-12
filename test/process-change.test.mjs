// Tests for the change check (docs/specs/process-state.md): a pull request that changes source
// belongs to a feature with an approved spec, or declares itself a fix or a trivial change and
// fits what those may be. Each test title cites the criterion it covers (process-state#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { parseProcessConfig } from '../checks/lib/process.mjs';
import { checkChange, isSource, readChange } from '../checks/ci/process-change.mjs';

const config = (extra = '') => parseProcessConfig(`default: [lead]\npublic-api: [src/api/**]\n${extra}`).config;
const files = (...list) => list.map(entry => { const [status, file] = entry.split(' '); return { status, path: file }; });
const SPECS = [
  { name: 'export', file: 'docs/specs/export.md', status: 'approved', isProcess: true },
  { name: 'import', file: 'docs/specs/import.md', status: 'draft', isProcess: true },
  { name: 'notes', file: 'docs/specs/notes.md', status: 'approved', isProcess: false },
];
const check = (changed, { messages = [], cited = [], cfg = config(), today = '2026-11-12' } = {}) => checkChange({ files: files(...changed), messages, specs: SPECS, cited, config: cfg, today });

test('process-state#AC-5 what counts as a source file', () => {
  for (const file of ['src/app.ts', 'package.json', 'Source/Mod/Private/Thing.cpp', 'scripts/build.mjs']) assert.equal(isSource(file), true, file);
  for (const file of ['docs/user/x.md', '.github/workflows/ci.yml', '.claude/settings.json', 'README.md', 'src/app.test.ts', 'test/x.mjs', 'e2e/home.spec.ts-snapshots/home.png']) assert.equal(isSource(file), false, file);
});

test('process-state#AC-5 a pull request with no source change passes', () => {
  const r = check(['M docs/user/x.md', 'A docs/design/x.md', 'M README.md']);
  assert.deepEqual([r.ok, r.kind], [true, 'no-source']);
});

test('process-state#AC-5 source with an approved spec in the pull request, or a test citing one, passes', () => {
  assert.deepEqual([check(['A src/export.ts', 'A docs/specs/export.md']).ok, check(['A src/export.ts', 'A docs/specs/export.md']).kind], [true, 'feature']);
  assert.equal(check(['M src/export.ts', 'M test/export.test.ts'], { cited: ['export'] }).ok, true);
});

test('process-state#AC-5 source with a draft spec, a plain spec, or no spec fails and names the ways forward', () => {
  for (const r of [check(['A src/import.ts', 'A docs/specs/import.md']), check(['A src/x.ts', 'M docs/specs/notes.md']), check(['A src/x.ts'])]) {
    assert.equal(r.ok, false);
    const text = r.problems.join('\n');
    assert.match(text, /approved spec/);
    assert.match(text, /Change: fix/);
    assert.match(text, /Change: trivial/);
  }
});

test('process-state#AC-5 where specs are waived the spec is not required', () => {
  const waived = config('waived:\n  specs: a content site with no code of its own\n');
  assert.equal(check(['A src/x.ts'], { cfg: waived }).ok, true);
});

test('process-state#AC-6 a trivial change adds no source file and touches no public API path', () => {
  const trivial = ['Bump the parser\n\nChange: trivial'];
  assert.deepEqual([check(['M package.json', 'M src/app.ts'], { messages: trivial }).ok, check(['M package.json'], { messages: trivial }).kind], [true, 'trivial']);
  assert.match(check(['A src/new.ts'], { messages: trivial }).problems.join('\n'), /src\/new\.ts.*spec/);
  assert.match(check(['M src/api/users.ts'], { messages: trivial }).problems.join('\n'), /public API.*src\/api\/users\.ts/);
});

test('process-state#AC-6 a fix changes a test and adds no source file', () => {
  const fix = ['Fix the off-by-one in paging\n\nChange: fix\n'];
  assert.equal(check(['M src/page.ts', 'M src/page.test.ts'], { messages: fix }).ok, true);
  assert.equal(check(['M src/page.ts', 'A test/page-regression.test.ts'], { messages: fix }).ok, true);
  assert.match(check(['M src/page.ts'], { messages: fix }).problems.join('\n'), /test/);
  assert.match(check(['A src/pager.ts', 'M src/page.test.ts'], { messages: fix }).problems.join('\n'), /src\/pager\.ts.*spec/);
});

test('process-state#AC-6 conflicting or unknown declarations fail', () => {
  assert.match(check(['M src/a.ts'], { messages: ['one\n\nChange: fix', 'two\n\nChange: trivial'] }).problems.join('\n'), /more than one/);
  assert.match(check(['M src/a.ts'], { messages: ['one\n\nChange: refactor'] }).problems.join('\n'), /refactor/);
  assert.equal(check(['M src/a.ts', 'M src/a.test.ts'], { messages: ['A sentence that says Change: fix in passing', 'two\n\nchange: Fix'] }).ok, true);
});

test('process-state#AC-7 the adoption pull request passes, and failures are warnings until adoption-until', () => {
  assert.deepEqual([check(['A docs/product/process.yml', 'A src/x.ts']).ok, check(['A docs/product/process.yml', 'A src/x.ts']).kind], [true, 'adoption']);
  const adopting = config('adoption-until: 2026-12-31\n');
  const before = check(['A src/x.ts'], { cfg: adopting, today: '2026-11-12' });
  assert.equal(before.ok, true);
  assert.match(before.warnings.join('\n'), /approved spec/);
  assert.equal(check(['A src/x.ts'], { cfg: adopting, today: '2027-01-01' }).ok, false);
});

test('process-state#AC-8 the script reads the change from git', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-change-'));
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'test'); git('config', 'core.autocrlf', 'false');
  write('docs/product/process.yml', 'default: [lead]\n');
  write('docs/specs/export.md', '---\nid: spec-export\nstatus: approved\n---\n\n# Export\n');
  write('src/page.ts', 'export const page = 1;\n');
  git('add', '-A'); git('commit', '-q', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  write('src/page.ts', 'export const page = 2;\n');
  write('test/page.test.ts', '// export#AC-2\n');
  git('add', '-A'); git('commit', '-q', '-m', 'Fix paging\n\nChange: fix');
  const change = readChange(root, base, git('rev-parse', 'HEAD'));
  assert.deepEqual(change.files, [{ status: 'M', path: 'src/page.ts' }, { status: 'A', path: 'test/page.test.ts' }]);
  assert.match(change.messages.join('\n'), /Change: fix/);
  assert.deepEqual(change.cited, ['export']);
  assert.deepEqual(change.specs.map(s => [s.name, s.status, s.isProcess]), [['export', 'approved', true]]);
  assert.equal(checkChange({ ...change, today: '2026-11-12' }).ok, true);
});

test('process-state#AC-8 the process workflow runs the check on pull requests with the full history', () => {
  const job = parse(fs.readFileSync('.github/workflows/rfr-process.yml', 'utf8')).jobs.change;
  assert.match(job.if, /pull_request/);
  assert.equal(job.steps.find(s => String(s.uses ?? '').startsWith('actions/checkout') && !s.with?.repository).with['fetch-depth'], 0);
  const run = job.steps.find(s => String(s.run ?? '').includes('process-change.mjs'));
  assert.equal(run.env.BASE_SHA, '${{ github.event.pull_request.base.sha }}');
  assert.equal(run.env.HEAD_SHA, '${{ github.event.pull_request.head.sha }}');
});
