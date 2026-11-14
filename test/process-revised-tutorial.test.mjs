// A tutorial a revision changes stays approved when only its hashes or recorded results changed, and
// goes back to draft when a step's words changed; the description says which
// (docs/specs/revisions-and-foundations.md, AC-6; decision D3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { prBody, readPrBody } from '../checks/ci/process-pr-body.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';
import { relink } from '../checks/process-relink.mjs';
import { REWORD, revisionProject } from './fixtures/revision-project.mjs';

// The feature is built and validated on main, and a merged packet rewords the section its spec and
// tutorial cite; a delivery branch then brings them up to date.
function revising() {
  const p = revisionProject({ git: true });
  p.editBody('docs-retarget', REWORD);
  p.commit('reword the user documentation');
  p.git('switch', '-q', '-c', 'feature/revise-retarget');
  relink(p.root, ['spec-retarget']);
  return p;
}
const description = p => prBody({ ...readPrBody(p.root, 'main'), branch: 'feature/revise-retarget' });
const STEP_TWO = '2. Click **Retarget**. You see **Done**.';

test('revisions-and-foundations#AC-6: a tutorial re-recorded with its steps unchanged stays approved and is listed as still validated', () => {
  const p = revising();
  relink(p.root, ['tutorial-retarget']);
  p.commit('record the tutorial against the reworded section');
  const body = description(p);
  assert.match(body, /^## Re-recorded, still validated$/m);
  assert.ok(body.includes('`docs/tutorials/retarget.md` is re-recorded: only its hashes or recorded results changed'), body);
  assert.doesNotMatch(body, /^## Validation$/m, 'approving it does not record a new validation');
  assert.doesNotMatch(body, /^## Built, not yet validated$/m);
  assert.deepEqual(runProcessTrace(p.root, { base: 'main' }).errors, []);
});

test('revisions-and-foundations#AC-6: a tutorial whose step words changed goes back to draft and is listed as not yet validated', () => {
  const p = revising();
  p.editBody('tutorial-retarget', b => b.replace(STEP_TWO, '2. Choose a target skeleton, then click **Retarget**. You see **Done**.'));
  p.setStatus('tutorial-retarget', 'draft');
  relink(p.root, ['tutorial-retarget']);
  p.commit('change the tutorial step');
  const body = description(p);
  assert.match(body, /^## Built, not yet validated$/m);
  assert.ok(body.includes('`docs/tutorials/retarget.md` is still a draft'), body);
  assert.doesNotMatch(body, /Re-recorded, still validated/);
});

test('revisions-and-foundations#AC-6: the process check fails a tutorial still approved after a step\'s words changed', () => {
  const p = revising();
  p.editBody('tutorial-retarget', b => b.replace(STEP_TWO, '2. Choose a target skeleton, then click **Retarget**. You see **Done**.'));
  relink(p.root, ['tutorial-retarget']);
  const errors = runProcessTrace(p.root, { base: 'main' }).errors.join('\n');
  assert.match(errors, /tutorial-retarget: the words of step 2 changed since main[^\n]*status: draft/);
  // Text outside the steps, and spacing inside them, is not a step's words.
  const other = revising();
  other.editBody('tutorial-retarget', b => b.replace('For **Animator**.', 'For **Animator**, on any project.').replace(STEP_TWO, '2.  Click **Retarget**.   You see **Done**.'));
  relink(other.root, ['tutorial-retarget']);
  assert.deepEqual(runProcessTrace(other.root, { base: 'main' }).errors, []);
});

test('revisions-and-foundations#AC-6: the deliver skill says when a revised tutorial stays approved and when it goes back to draft', () => {
  const skill = fs.readFileSync(path.resolve('plugins/process/skills/deliver/SKILL.md'), 'utf8');
  assert.match(skill, /revision open/);
  assert.match(skill, /words of (?:a|any) step changed[^.]*`status: draft`/i);
  assert.match(skill, /re-recorded, still validated/i);
  assert.match(skill, /process-relink\.mjs/);
});
