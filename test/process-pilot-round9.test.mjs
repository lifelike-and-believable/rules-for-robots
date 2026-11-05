// Tests for the ninth round of fixes from the Kettlebird pilot (docs/specs/project-process.md,
// "Pilot findings: round 9"). Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from 'yaml';

const text = fs.readFileSync('.github/workflows/rfr-process.yml', 'utf8');
const reusable = parse(text);
const inputs = reusable.on.workflow_call.inputs;
const steps = job => Object.values(job?.steps ?? []);

test('project-process#AC-44: a typecheck input runs the command in its own job, only when set', () => {
  assert.equal(inputs.typecheck?.type, 'string');
  assert.equal(inputs.typecheck?.default, '');
  const job = reusable.jobs.typecheck;
  assert.ok(job, 'typecheck job');
  assert.match(String(job.if), /inputs\.typecheck != ''/);
  assert.notEqual(job['continue-on-error'], true, 'a type error fails the job');
  const run = steps(job).find(s => s.env && Object.values(s.env).some(v => /inputs\.typecheck/.test(String(v))));
  assert.ok(run, 'a step that receives the command through env');
  assert.doesNotMatch(run.run, /\$\{\{\s*inputs\.typecheck/, 'the command is not pasted into the script');
});

test('project-process#AC-45: install-dirs installs each listed folder after the root in mutation and typecheck', () => {
  assert.equal(inputs['install-dirs']?.type, 'string');
  assert.equal(inputs['install-dirs']?.default, '');
  for (const name of ['mutation', 'typecheck']) {
    const all = steps(reusable.jobs[name]);
    const root = all.findIndex(s => /^\s*npm ci\s*$/m.test(s.run ?? ''));
    const extra = all.findIndex(s => /npm ci --prefix/.test(s.run ?? '') && Object.values(s.env ?? {}).some(v => /inputs\['install-dirs'\]|inputs\.install-dirs/.test(String(v))));
    assert.ok(root >= 0, `${name}: root npm ci`);
    assert.ok(extra > root, `${name}: extra folders installed after the root`);
  }
});
