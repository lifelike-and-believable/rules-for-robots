import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from 'yaml';

// The test change guard (TEST-001) passes when the pull request carries the
// `tests-reviewed` label, and it reads the labels from the event that started
// the run. A label added afterwards starts no run unless the caller workflow
// asks for it, and a re-run reuses the original event, so the check stays red
// beside an approving label. Removing the label must re-run it too, or the
// check stays green after the approval is withdrawn.
const CALLERS = [
  'templates/repo-files/common/.github/workflows/guards.yml',
  'template-repos/web-app/.github/workflows/guards.yml',
  'template-repos/static-site/.github/workflows/guards.yml',
  'template-repos/unreal-plugin/.github/workflows/guards.yml',
  'examples/web-app/.github/workflows/guards.yml',
];

for (const file of CALLERS) {
  test(`${file} re-runs the guards when a label is added or removed`, () => {
    const workflow = parse(fs.readFileSync(file, 'utf8'));
    const types = workflow.on.pull_request?.types;
    assert.ok(Array.isArray(types), 'pull_request needs an explicit types list');
    for (const type of ['opened', 'synchronize', 'reopened', 'labeled', 'unlabeled']) {
      assert.ok(types.includes(type), `types should include ${type}`);
    }
    assert.deepEqual(workflow.on.push.branches, ['main'], 'pushes to main still run the guards');
    assert.equal(
      workflow.jobs.guards.uses,
      'lifelike-and-believable/rules-for-robots/.github/workflows/rfr-guards.yml@main',
    );
  });
}

test('the adoption guide tells adopters to include the label events', () => {
  const guide = fs.readFileSync('docs/adoption-guide.md', 'utf8');
  assert.match(guide, /labeled/);
  assert.match(guide, /unlabeled/);
});
