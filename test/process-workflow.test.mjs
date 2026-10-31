// Tests for the process check's CI wiring (docs/specs/project-process.md): the reusable workflow
// and the caller template that adopting repositories copy.
// Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from 'yaml';

const reusable = parse(fs.readFileSync('.github/workflows/rfr-process.yml', 'utf8'));
const caller = parse(fs.readFileSync('plugins/process/templates/workflows/rfr-process.yml', 'utf8'));
const steps = job => Object.values(job.steps ?? []);

test('project-process#AC-4: the caller template runs on pull requests and on pushes to the default branch', () => {
  assert.ok(caller.on.pull_request !== undefined, 'pull_request trigger');
  assert.deepEqual(caller.on.push?.branches, ['main']);
  const job = Object.values(caller.jobs)[0];
  assert.match(job.uses, /^lifelike-and-believable\/rules-for-robots\/\.github\/workflows\/rfr-process\.yml@/);
  assert.equal(job.permissions?.issues, 'write');
});

test('project-process#AC-4: the reusable workflow runs the process check, against the base on pull requests', () => {
  assert.ok(reusable.on.workflow_call, 'workflow_call trigger');
  const job = reusable.jobs['process-trace'];
  assert.ok(job, 'process-trace job');
  const run = steps(job).map(s => s.run ?? '').join('\n');
  assert.match(run, /node \.rfr\/checks\/process-trace\.mjs/);
  assert.match(run, /--base/);
  assert.match(run, /github\.event\.pull_request\.base\.sha/);
});

test('project-process#AC-4: on the default branch a failure opens or updates a stale issue', () => {
  const job = reusable.jobs['process-trace'];
  assert.equal(job.permissions?.issues, 'write');
  const issueStep = steps(job).find(s => /stale/i.test(s.name ?? ''));
  assert.ok(issueStep, 'a step that files the stale issue');
  assert.match(String(issueStep.if), /failure\(\)/);
  assert.match(String(issueStep.if), /github\.event_name == 'push'/);
  assert.match(issueStep.run, /gh issue (list|create|comment|edit)/);
  assert.match(issueStep.run, /--label stale|label:stale|--label "stale"/);
});
