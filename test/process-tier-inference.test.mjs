// Tier inference wiring (docs/specs/project-process.md AC-54, process plan 23f): the tier job reports
// the tier it settled on, and the mutation job runs by that output instead of by labels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

const SCRIPT = path.resolve('checks/ci/process-tier.mjs');

test('project-process#AC-54: the mutation job needs the tier job and reads its output', () => {
  const wf = parse(fs.readFileSync('.github/workflows/rfr-process.yml', 'utf8'));
  assert.match(String(wf.jobs.tier.outputs?.tier), /steps\.tier\.outputs\.tier/);
  assert.ok(Object.values(wf.jobs.tier.steps).some(s => s.id === 'tier' && /process-tier\.mjs/.test(s.run ?? '')));
  assert.equal(wf.jobs.mutation.needs, 'tier');
  assert.match(wf.jobs.mutation.if, /needs\.tier\.outputs\.tier == 'story'/);
  assert.match(wf.jobs.mutation.if, /needs\.tier\.outputs\.tier == 'epic'/);
  assert.doesNotMatch(wf.jobs.mutation.if, /labels/);
});

test('project-process#AC-54: the tier job sets the output from the check, with no label', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-tier-'));
  const g = (...a) => spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8' });
  fs.mkdirSync(path.join(dir, 'docs/product'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs/product/process.yml'), 'mode: solo\ndefault: [lead]\n');
  g('init', '-q', '-b', 'main'); g('add', '-A'); g('commit', '-qm', 'base');
  const base = g('rev-parse', 'HEAD').stdout.trim();
  fs.mkdirSync(path.join(dir, 'docs/user'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs/user/guide.md'), '# Guide\n');
  g('add', '-A'); g('commit', '-qm', 'docs');
  const head = g('rev-parse', 'HEAD').stdout.trim();
  const output = path.join(dir, 'out.txt');
  const r = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8', env: { ...process.env, LABELS: '[]', BASE_SHA: base, HEAD_SHA: head, GITHUB_OUTPUT: output, GITHUB_TOKEN: '' } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /inferred/);
  assert.equal(fs.readFileSync(output, 'utf8'), 'tier=story\n');
  const lower = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8', env: { ...process.env, LABELS: '["tier:fix"]', BASE_SHA: base, HEAD_SHA: head, GITHUB_OUTPUT: path.join(dir, 'out2.txt'), GITHUB_TOKEN: '' } });
  assert.equal(lower.status, 1);
  assert.equal(fs.existsSync(path.join(dir, 'out2.txt')), false, 'no tier is reported when the check fails');
  fs.rmSync(dir, { recursive: true, force: true });
});
