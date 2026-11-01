// Tests for link rule 8 (docs/specs/project-process.md, amendment): a story says who it is for,
// what they want, and why, names a persona it links to, and has acceptance criteria.
// Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

const GOOD = '# Batch retarget\n\nAs an animator, I want to retarget a batch of clips\nso that I ship shots faster.\n\n## Acceptance criteria\n\n- The clips show the new skeleton.\n';

function project(storyBody, { status = 'approved', personaLink = 'persona-animator' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-story-'));
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  write('docs/product/process.yml', 'default: [lead]\n');
  write('docs/product/concept.md', '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\nTools.\n');
  write('docs/product/personas/animator.md', '---\nid: persona-animator\nstatus: approved\nderived-from:\n  - concept:\n---\n\n# Animator\n\n## Goals\n\nFast.\n');
  write('docs/product/personas/rigger.md', '---\nid: persona-rigger\nstatus: approved\nderived-from:\n  - concept:\n---\n\n# Rigger\n\n## Goals\n\nClean rigs.\n');
  write('docs/product/epics/retarget.md', '---\nid: epic-retarget\nstatus: approved\nderived-from:\n  - persona-animator:\n---\n\n# Retargeting\n');
  write('docs/product/stories/retarget/batch.md', `---\nid: story-batch\nstatus: ${status}\nderived-from:\n  - epic-retarget:\n  - ${personaLink}:\n---\n\n${storyBody}`);
  relink(root, ['persona-animator', 'persona-rigger', 'epic-retarget', 'story-batch']);
  return root;
}

const result = (body, opts) => runProcessTrace(project(body, opts));
const errors = (body, opts) => result(body, opts).errors.join('\n');

test('project-process#AC-21: a story with a role, a want, a benefit, and criteria passes', () => {
  assert.deepEqual(result(GOOD).errors, []);
  assert.deepEqual(result(GOOD.replace('As an animator', 'As the Animator')).errors, [], 'the role can use the persona title in any case');
  assert.deepEqual(result(GOOD.replace('As an animator', 'As persona-animator')).errors, [], 'or the persona id');
});

test('project-process#AC-21: a story without "As <persona>, I want ..." fails', () => {
  assert.match(errors('# Batch\n\nRetarget a batch of clips.\n\n## Acceptance criteria\n\n- Works.\n'), /story-batch.*As <persona>/);
});

test('project-process#AC-21: a story whose role is not a persona it links to fails', () => {
  assert.match(errors(GOOD.replace('As an animator', 'As a rigger')), /story-batch.*rigger/);
  assert.match(errors(GOOD.replace('As an animator', 'As a producer')), /story-batch.*producer/);
});

test('project-process#AC-21: a story without a "so that" benefit fails', () => {
  assert.match(errors(GOOD.replace('\nso that I ship shots faster', '')), /story-batch.*so that/);
});

test('project-process#AC-21: a story with no criteria section, or an empty one, fails', () => {
  assert.match(errors(GOOD.replace(/## Acceptance criteria[\s\S]*$/, '')), /story-batch.*Acceptance criteria/);
  assert.match(errors(GOOD.replace('- The clips show the new skeleton.\n', '')), /story-batch.*Acceptance criteria/);
});

test('project-process#AC-21: a draft story that breaks the rule gets a warning, not an error', () => {
  const r = result('# Batch\n\nRetarget clips.\n', { status: 'draft' });
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings.join('\n'), /story-batch.*As <persona>/);
  assert.match(r.warnings.join('\n'), /story-batch.*Acceptance criteria/);
});
