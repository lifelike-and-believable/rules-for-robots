// Tests for the fourth round of fixes from the Kettlebird pilot (docs/specs/project-process.md,
// "Pilot findings: round 4"). Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArtifact } from '../checks/lib/process.mjs';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

function project(storyLinks, status = 'approved') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-round4-'));
  const files = {
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\n## Audience\n\nFans.\n',
    'docs/product/personas/fan.md': '---\nid: persona-fan\nstatus: approved\nderived-from:\n  - concept#audience:\n---\n\n# Fan\n\n## Goals\n\nRead.\n',
    'docs/product/epics/read.md': '---\nid: epic-read\nstatus: approved\nderived-from:\n  - persona-fan#goals:\n---\n\n# Reading\n\n## Outcome\n\nFans read.\n',
    'docs/product/stories/read/first.md': `---\nid: story-first\nstatus: ${status}\nderived-from:\n${storyLinks}---\n\n# First\n\nAs a fan, I want to read so that I enjoy it.\n\n## Acceptance criteria\n\n- Pages show.\n`,
  };
  for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); }
  relink(root, ['persona-fan', 'epic-read']);
  return root;
}

test('project-process#AC-34: an entry without a colon is read as a link with no hash', () => {
  const { links, errors } = parseArtifact('---\nid: story-x\nderived-from:\n  - epic-read#outcome\n  - persona-fan#goals:\n---\n\n# X\n');
  assert.deepEqual(errors, []);
  assert.deepEqual(links.map(l => [l.key, l.hash]), [['epic-read#outcome', ''], ['persona-fan#goals', '']]);
});

test('project-process#AC-34: relink records the hash of a new link written with or without the colon', () => {
  const root = project('  - epic-read#outcome\n  - persona-fan#goals:\n');
  const r = relink(root, ['story-first']);
  assert.deepEqual(r.changed, ['story-first']);
  const { links } = parseArtifact(fs.readFileSync(path.join(root, 'docs/product/stories/read/first.md'), 'utf8'));
  for (const l of links) assert.match(l.hash, /^[0-9a-f]{12}$/, l.key);
  assert.deepEqual(runProcessTrace(root).errors, []);
});

test('project-process#AC-34: the message for an approved link with no hash names the relink command', () => {
  const root = project('  - epic-read#outcome\n  - persona-fan#goals:\n');
  const errors = runProcessTrace(root).errors.filter(e => /no recorded hash/.test(e));
  assert.equal(errors.length, 2, runProcessTrace(root).errors.join('\n'));
  for (const e of errors) assert.match(e, /process-relink\.mjs story-first/);
});
