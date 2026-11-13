// Tests for the sixth round of fixes from the Kettlebird pilot (docs/specs/project-process.md,
// "Pilot findings: round 6"). Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

// ---- AC-38: stale whole-artifact links suggest sections ------------------------------------------

function project(link) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-round6-'));
  const files = {
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\n## Audience\n\nFans.\n',
    'docs/product/personas/fan.md': '---\nid: persona-fan\nstatus: approved\nderived-from:\n  - concept#audience:\n---\n\n# Fan\n\n## Goals\n\nRead.\n',
    'docs/product/epics/read.md': '---\nid: epic-read\nstatus: approved\nderived-from:\n  - persona-fan#goals:\n---\n\n# Reading\n\n## Outcome\n\nFans read.\n',
    'docs/product/stories/read/first.md': '---\nid: story-first\nstatus: approved\nderived-from:\n  - epic-read#outcome:\n  - persona-fan#goals:\n---\n\n# First\n\nAs a fan, I want to read so that I enjoy it.\n\n## Acceptance criteria\n\n- Pages show.\n',
    'docs/design/reader.md': '---\nid: design-reader\nstatus: approved\nderived-from:\n  - story-first:\n---\n\n# Reader\n\n## Flow\n\nTurn pages.\n\n## Deleting a comic\n\nNot yet.\n',
    'docs/user/reading.md': `---\nid: docs-reading\nstatus: approved\nderived-from:\n  - ${link}:\n---\n\n# Reading\n\nTurn pages.\n`,
  };
  for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); }
  relink(root, ['persona-fan', 'epic-read', 'story-first', 'design-reader', 'docs-reading']);
  const design = path.join(root, 'docs/design/reader.md');
  fs.writeFileSync(design, fs.readFileSync(design, 'utf8').replace('Not yet.', 'Select **Delete**, then confirm.'));
  relink(root, ['design-reader']);
  return runProcessTrace(root).errors.join('\n');
}

test('project-process#AC-38: a stale whole-artifact link lists the sections to link instead', () => {
  const errors = project('design-reader');
  assert.match(errors, /docs-reading: stale: design-reader/);
  assert.match(errors, /design-reader#flow/);
  assert.match(errors, /design-reader#deleting-a-comic/);
});

test('project-process#AC-38: a section link is not stale when another section changes, and gets no suggestion', () => {
  const errors = project('design-reader#flow');
  assert.doesNotMatch(errors, /docs-reading/);
});
