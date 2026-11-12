// The tests-reviewed label approves the code it was added for (docs/specs/test-change-review.md, AC-10):
// a run of the CI test change guard started by a push ignores a label that was already there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { labelApproves } from '../checks/ci/test-change-guard.mjs';

test('test-change-review#AC-10: a label carried over a push does not approve the new commits', () => {
  assert.equal(labelApproves({ labelled: true, event: 'synchronize' }), false);
  for (const event of ['labeled', 'opened', 'reopened', 'unlabeled', null]) {
    assert.equal(labelApproves({ labelled: true, event }), true, String(event));
  }
  assert.equal(labelApproves({ labelled: false, event: 'labeled' }), false);
});

test('test-change-review#AC-10: the reusable workflow passes the event action to the guard', () => {
  const workflow = fs.readFileSync('.github/workflows/rfr-guards.yml', 'utf8');
  assert.match(workflow, /test-change-guard\.mjs .*--event "\$\{\{ github\.event\.action \}\}"/);
  // The caller template runs the guard again when the label is added, so re-adding it after a push clears the check.
  const caller = fs.readFileSync('templates/repo-files/common/.github/workflows/guards.yml', 'utf8');
  assert.match(caller, /types: \[[^\]]*synchronize[^\]]*labeled[^\]]*unlabeled/);
});
