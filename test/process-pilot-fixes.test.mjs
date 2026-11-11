// Tests for the first round of fixes from the Kettlebird pilot (docs/specs/project-process.md,
// "Pilot findings: round 1"). Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { parseProcessConfig } from '../checks/lib/process.mjs';
import { checkTier } from '../checks/ci/process-tier.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

const config = parseProcessConfig('default: [lead]\n').config;

test('project-process#AC-27: the pull request that adds process.yml passes without a tier label', () => {
  const files = ['docs/product/process.yml', 'docs/product/concept.md', '.github/workflows/rfr-process.yml'];
  const adoption = checkTier({ labels: [], files, config, addedFiles: new Set(['docs/product/process.yml', 'docs/product/concept.md']) });
  assert.equal(adoption.ok, true, adoption.problems.join('\n'));
  assert.equal(adoption.tier, 'adoption');
  const later = checkTier({ labels: [], files: ['docs/product/process.yml'], config, addedFiles: new Set() });
  assert.deepEqual([later.ok, later.tier], [true, 'story'], 'a later change to process.yml, under docs/product/, passes at the inferred tier');
});

test('project-process#AC-27: the tier job creates the four tier labels', () => {
  const wf = parse(fs.readFileSync('.github/workflows/rfr-process.yml', 'utf8'));
  const job = wf.jobs.tier;
  assert.equal(job.permissions?.issues, 'write');
  const steps = Object.values(job.steps);
  const run = steps.map(s => s.run ?? '').join('\n');
  for (const tier of ['trivial', 'fix', 'story', 'epic']) assert.match(run, new RegExp(`gh label create tier:${tier}\\b`));
  const tierStep = steps.find(s => /process-tier\.mjs/.test(s.run ?? ''));
  assert.match(String(tierStep.env?.PR_NUMBER), /pull_request\.number/);
  assert.match(String(tierStep.env?.GITHUB_TOKEN), /github\.token/);
});

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-pilot-'));
  for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); }
  return root;
}

test('project-process#AC-28: draft links without a recorded hash are counted and reported', () => {
  const root = project({
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': '---\nid: concept\nstatus: draft\n---\n\n# Concept\n',
    'docs/product/personas/fan.md': '---\nid: persona-fan\nstatus: draft\nderived-from:\n  - concept:\n---\n\n# Fan\n',
    'docs/product/personas/client.md': '---\nid: persona-client\nstatus: draft\nderived-from:\n  - concept:\n---\n\n# Client\n',
  });
  const r = runProcessTrace(root);
  assert.deepEqual(r.errors, []);
  assert.equal(r.unrecorded, 2);
  const out = spawnSync(process.execPath, [path.resolve('checks/process-trace.mjs'), root], { encoding: 'utf8' });
  assert.equal(out.status, 0);
  assert.match(out.stdout, /2 draft link\(s\) .*not yet recorded/);
  assert.doesNotMatch(out.stdout, /links are current\.$/m);
});
