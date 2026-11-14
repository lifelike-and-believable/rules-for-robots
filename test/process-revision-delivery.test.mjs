// A merged revision leaves the features behind it as open deliveries: `delivery open` lists them,
// `delivery start` scopes the run to the stale specs, and the run is finished when each stale spec and
// tutorial is brought up to date (docs/specs/revisions-and-foundations.md, AC-5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deliveryMissing, openDeliveries, readMarker } from '../plugins/process/scripts/delivery.mjs';
import { relink } from '../checks/process-relink.mjs';
import { DELIVERY, REWORD, revisionProject } from './fixtures/revision-project.mjs';

const BEHIND = '(revision: docs/specs/retarget.md, docs/tutorials/retarget.md are behind docs-retarget#retarget-a-batch)';

// The feature is built and validated; then a merged packet rewords the section its spec and tutorial cite.
function merged() {
  const p = revisionProject({ remote: true });
  p.editBody('docs-retarget', REWORD);
  p.commit('reword the user documentation');
  p.git('push', '-q', 'origin', 'main');
  return p;
}

test('revisions-and-foundations#AC-5: delivery open lists a revision as an open delivery, marked revision', () => {
  const p = merged();
  const out = p.run(DELIVERY, 'open');
  assert.equal(out.status, 0, out.stderr);
  const lines = out.stdout.trim().split('\n');
  assert.equal(lines.length, 1, out.stdout);
  assert.match(lines[0], /^story-retarget-batch\b/);
  assert.ok(lines[0].includes(BEHIND), lines[0]);
  const [feature] = openDeliveries(p.root);
  assert.equal(feature.revision, true);
  assert.equal(feature.waiting, false, 'a revision is started by a merge like any open delivery');
  assert.deepEqual(feature.stories, ['story-retarget-batch']);
});

test('revisions-and-foundations#AC-5: a revision is under way when another branch on the remote changes the stale spec', () => {
  const p = merged();
  p.elsewhere('claude/unrelated', { 'docs/decisions/claude-unrelated.md': 'Nothing about retargeting.\n' });
  assert.match(p.run(DELIVERY, 'open').stdout, /^story-retarget-batch\b/m);
  p.elsewhere('claude/revise-retarget', { 'docs/specs/retarget.md': `${p.read('docs/specs/retarget.md')}\nBrought up to date.\n` });
  assert.equal(p.run(DELIVERY, 'open').stdout.trim(), 'No delivery is open.');
});

test('revisions-and-foundations#AC-5: delivery start for a revision scopes the run to the stale specs and lists what is behind', () => {
  const p = merged();
  p.git('switch', '-q', '-c', 'feature/revise-retarget');
  const started = p.run(DELIVERY, 'start', 'story-retarget-batch');
  assert.equal(started.status, 0, started.stderr);
  assert.deepEqual(readMarker(p.root).specs, ['retarget']);
  assert.doesNotMatch(started.stdout, /no spec in this branch yet/);
  assert.ok(started.stdout.includes('docs/specs/retarget.md: behind docs-retarget#retarget-a-batch; bring the spec up to the changed sections, then record its hashes (node .rfr/checks/process-relink.mjs spec-retarget)'), started.stdout);
  assert.ok(started.stdout.includes('docs/tutorials/retarget.md: behind docs-retarget#retarget-a-batch; run the tutorial again against the delivery, then record its hashes (node .rfr/checks/process-relink.mjs tutorial-retarget)'), started.stdout);
});

test('revisions-and-foundations#AC-5: tests are asked for the criteria that changed, under the existing lock rules', () => {
  const p = merged();
  p.git('switch', '-q', '-c', 'feature/revise-retarget');
  p.editBody('spec-retarget', b => b.replace('| AC-1 | The selected clips are retargeted |', '| AC-1 | The selected clips are retargeted to the chosen skeleton |')
    .concat('| AC-2 | The chosen skeleton is remembered | test: a second batch | docs-retarget#retarget-a-batch |\n'));
  relink(p.root, ['spec-retarget']);
  const missing = deliveryMissing(p.root, ['retarget']);
  assert.doesNotMatch(missing.join('\n'), /docs\/specs\/retarget\.md: behind/, 'the spec is up to date');
  const tests = missing.find(m => m.startsWith('tests for the criteria of retarget that changed'));
  assert.ok(tests, missing.join('\n'));
  assert.ok(tests.startsWith('tests for the criteria of retarget that changed (retarget#AC-1, retarget#AC-2): '), tests);
  assert.match(tests, /tests-commit/);
  assert.match(tests, /unlocks:/);
  // A test file in the branch that cites each changed criterion answers it.
  p.write('test/retarget-skeleton.test.mjs', "// retarget#AC-1 retarget#AC-2\ntest('retargets to the chosen skeleton', () => {});\n");
  assert.ok(!deliveryMissing(p.root, ['retarget']).some(m => m.startsWith('tests for the criteria')));
});

test('revisions-and-foundations#AC-5: a revision is finished when the spec and the tutorial are up to date, committed, and pushed', () => {
  const p = merged();
  p.git('switch', '-q', '-c', 'feature/revise-retarget');
  const before = deliveryMissing(p.root, ['retarget']);
  assert.ok(before.some(m => m.startsWith('docs/specs/retarget.md: behind')), before.join('\n'));
  assert.ok(before.some(m => m.startsWith('docs/tutorials/retarget.md: behind')), before.join('\n'));
  // The spec's criteria still hold as written: recording its hashes is all it needs, and no test is asked for.
  relink(p.root, ['spec-retarget']);
  assert.ok(!deliveryMissing(p.root, ['retarget']).some(m => m.startsWith('docs/specs/retarget.md') || m.startsWith('tests for')));
  relink(p.root, ['tutorial-retarget']);
  p.commit('bring retargeting up to the reworded user documentation');
  p.git('push', '-q', '-u', 'origin', 'feature/revise-retarget');
  assert.deepEqual(deliveryMissing(p.root, ['retarget']), []);
});
