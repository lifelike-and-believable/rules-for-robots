// On the delivery side a stale spec or tutorial is open work, a revision, and not a failure; on the
// document side a stale artifact still fails (docs/specs/revisions-and-foundations.md, AC-3 and AC-4;
// decision D1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { featureSteps, loadArtifacts, parseProcessConfig, processNext, renderNext, workingTree } from '../checks/lib/process.mjs';
import { processStatus, runProcessTrace, staleAssignees } from '../checks/process-trace.mjs';
import { REWORD, TRACE, render, revisionProject } from './fixtures/revision-project.mjs';

const config = parseProcessConfig('default: [lead]\n').config;
const stepFor = root => featureSteps(loadArtifacts(workingTree(root)).artifacts, config).find(s => s.story === 'story-retarget-batch');
const SPEC_NOTE = 'revision open: spec-retarget is behind docs-retarget#retarget-a-batch';
const TUTORIAL_NOTE = 'revision open: tutorial-retarget is behind docs-retarget#retarget-a-batch';

// ---- AC-3: the two sides in the process check ----

test('revisions-and-foundations#AC-3: a stale design or user documentation still fails the check', () => {
  const p = revisionProject();
  p.editBody('story-retarget-batch', b => b.replace('The clips show the new skeleton.', 'Each clip shows the new skeleton.'));
  const r = runProcessTrace(p.root);
  assert.match(r.errors.join('\n'), /design-retarget: stale: story-retarget-batch changed/);
  assert.match(r.errors.join('\n'), /docs-retarget: stale: story-retarget-batch changed/);
  assert.doesNotMatch(r.errors.join('\n'), /spec-retarget/, 'the spec is on the delivery side');
  assert.deepEqual(r.involved, ['design-retarget', 'docs-retarget']);
});

test('revisions-and-foundations#AC-3: a stale approved spec and tutorial pass, each with a revision-open note', () => {
  const p = revisionProject();
  p.editBody('docs-retarget', REWORD);
  const r = runProcessTrace(p.root);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.notes, [SPEC_NOTE, TUTORIAL_NOTE]);
  assert.doesNotMatch(r.warnings.join('\n'), /revision open/, 'a note is not a warning');
  assert.deepEqual(r.involved, []);
});

test('revisions-and-foundations#AC-3: a spec the branch changes or adds still fails when it is stale', () => {
  const changed = revisionProject({ git: true });
  changed.editBody('docs-retarget', REWORD);
  changed.editBody('spec-retarget', b => `${b}\nA note added in the branch.\n`);
  const r = runProcessTrace(changed.root, { base: 'main' });
  assert.match(r.errors.join('\n'), /spec-retarget: stale: docs-retarget#retarget-a-batch changed/);
  assert.deepEqual(r.notes, [TUTORIAL_NOTE], 'the tutorial the branch does not touch is still a note');

  const added = revisionProject({ git: true });
  const defs = { ...added.defs, 'spec-undo': { path: 'docs/specs/undo.md', links: ['docs-retarget#retarget-a-batch'], body: '# Undo spec\n' } };
  added.write('docs/specs/undo.md', render('spec-undo', defs['spec-undo'], defs));
  added.editBody('docs-retarget', REWORD);
  assert.match(runProcessTrace(added.root, { base: 'main' }).errors.join('\n'), /spec-undo: stale: docs-retarget#retarget-a-batch changed/);
});

test('revisions-and-foundations#AC-3: on the default branch a stale spec or tutorial passes and opens no stale issue', () => {
  const p = revisionProject({ git: true });
  p.editBody('docs-retarget', REWORD);
  p.commit('reword the user documentation');
  // The push run has no base: it exits 0, so the workflow's stale-issue step (if: failure()) is skipped.
  const out = p.run(TRACE, '.');
  assert.equal(out.status, 0, out.stderr);
  assert.ok(out.stderr.includes(`note: ${SPEC_NOTE}`), out.stderr);
  assert.ok(out.stderr.includes(`note: ${TUTORIAL_NOTE}`), out.stderr);
  assert.doesNotMatch(out.stderr, /^warning: revision open/m);
  assert.deepEqual(staleAssignees(p.root), [], 'nobody is assigned a stale issue for open revisions');
  const workflow = fs.readFileSync(path.resolve('.github/workflows/rfr-process.yml'), 'utf8');
  assert.match(workflow, /- name: Open or update the stale issue\n\s+if: failure\(\) && github\.event_name == 'push'/);
});

// ---- AC-4: the revise step, the session text, and the release check ----

test('revisions-and-foundations#AC-4: a built and validated feature whose user documentation section changed is to revise', () => {
  const p = revisionProject();
  assert.equal(stepFor(p.root).step, 'done');
  p.editBody('docs-retarget', REWORD);
  const s = stepFor(p.root);
  assert.equal(s.step, 'revise');
  assert.deepEqual(s.files, ['docs/specs/retarget.md', 'docs/tutorials/retarget.md']);
  assert.deepEqual(s.behind, ['docs-retarget#retarget-a-batch']);
});

test('revisions-and-foundations#AC-4: a feature whose design re-recorded a changed design-system link is not behind', () => {
  const p = revisionProject({
    change: d => {
      d['design-system'] = { path: 'docs/design/design-system.md', links: ['story-retarget-batch'], body: '# Design system\n\n## Colour\n\nBlue on white.\n' };
      d['design-retarget'].links.push('design-system#colour');
    },
  });
  // The design system's colour changes, and the design records the new hash: its own text is unchanged.
  p.defs['design-system'].body = p.defs['design-system'].body.replace('Blue on white.', 'Green on white.');
  p.write(p.defs['design-system'].path, render('design-system', p.defs['design-system'], p.defs));
  p.write(p.defs['design-retarget'].path, render('design-retarget', p.defs['design-retarget'], p.defs));
  assert.deepEqual(runProcessTrace(p.root).errors, []);
  assert.equal(stepFor(p.root).step, 'done');
});

test('revisions-and-foundations#AC-4: revise comes after delivering and before validate and done', () => {
  // A spec with no tutorial yet is a delivery under way, whatever its links say.
  const delivering = revisionProject({ change: d => { delete d['tutorial-retarget']; } });
  delivering.editBody('docs-retarget', REWORD);
  assert.equal(stepFor(delivering.root).step, 'delivering');
  // A built feature waiting for validation is behind first.
  const validate = revisionProject({ change: d => { d['tutorial-retarget'].status = 'draft'; } });
  assert.equal(stepFor(validate.root).step, 'validate');
  validate.editBody('docs-retarget', REWORD);
  const s = stepFor(validate.root);
  assert.equal(s.step, 'revise');
  assert.deepEqual(s.files, ['docs/specs/retarget.md'], 'the draft tutorial is not behind an approved revision');
});

test('revisions-and-foundations#AC-4: steps of a build order still to build keep the delivery open, ahead of a revision', () => {
  const p = revisionProject({ change: d => { d['design-retarget'].body += '\n## Notes for delivery\n\n1. **The dialog.** It lists the clips.\n'; } });
  p.editBody('docs-retarget', REWORD);
  const s = stepFor(p.root);
  assert.equal(s.step, 'deliver');
  assert.deepEqual(s.openSteps, ['design-retarget 1']);
});

test('revisions-and-foundations#AC-4: the session text lists a revision under "Open for an agent"', () => {
  const p = revisionProject();
  p.editBody('docs-retarget', REWORD);
  const text = renderNext({ steps: [stepFor(p.root)], product: [] });
  const open = text.indexOf('Open for an agent:');
  const line = text.indexOf('story-retarget-batch: revision open: docs/specs/retarget.md, docs/tutorials/retarget.md are behind docs-retarget#retarget-a-batch');
  assert.ok(open !== -1 && line > open, text);
  assert.doesNotMatch(text, /Done: 1 feature/);
});

test('revisions-and-foundations#AC-4: on the default branch the process state says a merged revision is open', () => {
  const p = revisionProject({ remote: true });
  p.editBody('docs-retarget', REWORD);
  p.commit('reword the user documentation');
  p.git('push', '-q', 'origin', 'main');
  const next = processNext(p.root);
  assert.equal(next.steps.find(s => s.story === 'story-retarget-batch').step, 'revise');
  assert.ok(next.text.includes('story-retarget-batch: revision open: docs/specs/retarget.md, docs/tutorials/retarget.md are behind docs-retarget#retarget-a-batch'), next.text);
});

test('revisions-and-foundations#AC-4: the release check is unchanged and still lists the story as not ready', () => {
  const p = revisionProject();
  assert.deepEqual(processStatus(p.root).find(r => r.id === 'story-retarget-batch').attention, []);
  p.editBody('docs-retarget', REWORD);
  assert.deepEqual(processStatus(p.root).find(r => r.id === 'story-retarget-batch').attention, [
    { id: 'spec-retarget', problem: 'stale' },
    { id: 'tutorial-retarget', problem: 'stale' },
  ]);
});
