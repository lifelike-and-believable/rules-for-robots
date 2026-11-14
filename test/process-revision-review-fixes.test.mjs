// Cases the review of slice 26a found (docs/specs/revisions-and-foundations.md, AC-3, AC-5, AC-6): a
// spec behind a draft is not a revision open; the branch is compared from where it left the base; a
// branch that changes only a tutorial does not hide a revision whose spec is still behind; and the
// message for an approved artifact set back to draft no longer says to keep a tutorial approved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runProcessTrace } from '../checks/process-trace.mjs';
import { openDeliveries } from '../plugins/process/scripts/delivery.mjs';
import { REWORD, revisionProject } from './fixtures/revision-project.mjs';

test('revisions-and-foundations#AC-3: a spec behind a draft is not a revision open', () => {
  const p = revisionProject();
  p.editBody('docs-retarget', REWORD);
  p.setStatus('docs-retarget', 'draft');
  const r = runProcessTrace(p.root);
  assert.match(r.errors.join('\n'), /spec-retarget.*links to docs-retarget, which is draft/);
  assert.doesNotMatch(r.notes.join('\n'), /spec-retarget/);
});

test('revisions-and-foundations#AC-3: the branch is compared from where it left the base', () => {
  const p = revisionProject({ git: true });
  p.git('switch', '-q', '-c', 'feature/docs');
  p.editBody('docs-retarget', REWORD);
  p.commit('reword the user documentation');
  const branchTip = p.git('rev-parse', 'HEAD');
  // The default branch moves on and changes the spec, which this branch never touched.
  p.git('switch', '-q', 'main');
  p.write('docs/specs/retarget.md', p.read('docs/specs/retarget.md').replace('# Retarget spec', '# Retarget spec\n\nA note added on main.'));
  p.commit('note on main');
  p.git('switch', '-q', 'feature/docs');
  assert.equal(p.git('rev-parse', 'HEAD'), branchTip);
  const r = runProcessTrace(p.root, { base: 'main' });
  assert.doesNotMatch(r.errors.join('\n'), /spec-retarget/);
  assert.match(r.notes.join('\n'), /revision open: .*spec-retarget/);
});

test('revisions-and-foundations#AC-5: a branch that changes only the tutorial does not hide a revision whose spec is still behind', () => {
  const p = revisionProject({ remote: true });
  p.editBody('docs-retarget', REWORD);
  p.commit('reword'); p.git('push', '-q');
  assert.ok(openDeliveries(p.root).some(f => f.revision), 'the revision is open');
  p.elsewhere('claude/tutorial-only', { 'docs/tutorials/retarget.md': p.read('docs/tutorials/retarget.md').replace('# Retarget a batch of clips', '# Retarget a batch of clips\n\nA note.') });
  assert.ok(openDeliveries(p.root).some(f => f.revision), 'a tutorial-only branch leaves the revision open');
  p.elsewhere('claude/spec-revision', { 'docs/specs/retarget.md': p.read('docs/specs/retarget.md').replace('# Retarget spec', '# Retarget spec\n\nRevised.') });
  assert.ok(!openDeliveries(p.root).some(f => f.revision), 'a branch revising the spec puts it under way');
});

test('revisions-and-foundations#AC-6: the guide and the rule-7 message say a tutorial with changed steps goes back to draft', () => {
  const guide = fs.readFileSync(path.resolve('plugins/process/guide/reviews-and-changes.md'), 'utf8').replace(/\s+/g, ' ');
  assert.match(guide, /tutorial[^.]*step[^.]*`status: draft`/i);
  assert.match(guide, /spec or tutorial[^.]*revision open/i);
  const readme = fs.readFileSync(path.resolve('plugins/process/README.md'), 'utf8').replace(/\s+/g, ' ');
  assert.match(readme, /revision open/i);
  const trace = fs.readFileSync(path.resolve('checks/process-trace.mjs'), 'utf8');
  assert.doesNotMatch(trace, /If you are amending it, keep status: approved;/);
});
