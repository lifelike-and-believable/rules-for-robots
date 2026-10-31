// Tests for --assignees on the process check: the stale issue on the default branch is assigned to
// the approvers of the stages whose artifacts fail (docs/specs/project-process.md, slice 11b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { staleAssignees } from '../checks/process-trace.mjs';
import { relink } from '../checks/process-relink.mjs';

function project(config) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-assignees-'));
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  write('docs/product/process.yml', config);
  write('docs/product/concept.md', '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\nOne.\n');
  write('docs/product/personas/animator.md', '---\nid: persona-animator\nstatus: approved\nderived-from:\n  - concept:\n---\n\n# Animator\n\n## Goals\n\nFast.\n');
  write('docs/product/epics/retarget.md', '---\nid: epic-retarget\nstatus: approved\nderived-from:\n  - persona-animator:\n---\n\n# Retargeting\n');
  relink(root, ['persona-animator', 'epic-retarget']);
  return { root, write };
}

const CONFIG = 'mode: team\ndefault: [lead, "@acme/leads"]\nstages:\n  personas: [ux-lead, "@acme/ux"]\n';

test('no failures, no assignees', () => {
  assert.deepEqual(staleAssignees(project(CONFIG).root), []);
});

test('a stale persona is assigned to the persona approvers, leaving out teams', () => {
  const { root, write } = project(CONFIG);
  write('docs/product/concept.md', '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\nTwo.\n');
  assert.deepEqual(staleAssignees(root), ['ux-lead']);
});

test('failures in several stages assign each stage\'s approvers once', () => {
  const { root, write } = project(CONFIG);
  write('docs/product/concept.md', '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\nTwo.\n');
  write('docs/product/personas/animator.md', '---\nid: persona-animator\nstatus: approved\nderived-from:\n  - concept: 000000000000\n---\n\n# Animator\n\n## Goals\n\nFaster.\n');
  assert.deepEqual(staleAssignees(root), ['lead', 'ux-lead']);
});
