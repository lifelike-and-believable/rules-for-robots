// The revise skill and the guide's revision packet (docs/specs/revisions-and-foundations.md, AC-8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = file => fs.readFileSync(path.resolve(file), 'utf8');
const flat = text => text.replace(/\s+/g, ' ');
const SKILL = 'plugins/process/skills/revise/SKILL.md';
const GUIDE = 'plugins/process/guide/reviews-and-changes.md';

test('revisions-and-foundations#AC-8: the skill has front matter that says when to use it', () => {
  const text = read(SKILL);
  assert.match(text, /^---\nname: revise\n/);
  assert.match(text, /^description: .*(already approved|approved).*$/m);
  assert.match(text, /^argument-hint: /m);
});

test('revisions-and-foundations#AC-8: step 1 runs the impact report first and tells the lead the counts once', () => {
  const text = flat(read(SKILL));
  assert.match(text, /node \.rfr\/checks\/process-impact\.mjs \. <id>\[#section\]/);
  assert.match(text, /before changing anything/i);
  assert.match(text, /first line[^.]*counts[^.]*once, in chat/i);
  assert.match(text, /do not wait for an answer/i);
});

test('revisions-and-foundations#AC-8: step 2 makes the change on its own branch', () => {
  assert.match(flat(read(SKILL)), /change on its own branch/i);
});

test('revisions-and-foundations#AC-8: step 3 gives the three ways and never re-records without reading', () => {
  const text = flat(read(SKILL));
  assert.match(text, /update it to match/i);
  assert.match(text, /process-relink\.mjs <id>/);
  assert.match(text, /withdraw it to draft with a `withdrawn:` reason and issue/i);
  assert.match(text, /never re-record one without reading it/i);
  assert.match(text, /reading the changed section against it/i);
});

test('revisions-and-foundations#AC-8: step 4 writes the Revision section with a reason for each re-record', () => {
  const text = flat(read(SKILL));
  assert.match(text, /## Revision/);
  assert.match(text, /docs\/decisions\/<branch with \/ written as ->\.md/);
  assert.match(text, /the reason for the change/i);
  assert.match(text, /one list item for each re-recorded document/i);
  assert.match(text, /- design-board: unaffected; /);
  assert.match(text, /beside each re-recorded document/i);
});

test('revisions-and-foundations#AC-8: step 5 re-renders the mock-ups a changed token file or stylesheet affects', () => {
  const text = flat(read(SKILL));
  assert.match(text, /re-render the mock-ups/i);
  assert.match(text, /token file or stylesheet/i);
  assert.match(text, /which were re-rendered/i);
});

test('revisions-and-foundations#AC-8: step 6 pushes and tells the lead once, with the review link', () => {
  const text = flat(read(SKILL));
  assert.match(text, /push the branch, and tell the lead once[^.]*review link[^.]*waiting for their approval/i);
  assert.match(text, /subscribe to the pull request/i);
});

test('revisions-and-foundations#AC-8: the skill does not touch specs, tests, code, or tutorials', () => {
  const text = flat(read(SKILL));
  assert.match(text, /does not touch specs, tests, code, or tutorials/i);
  assert.match(text, /revision open/i);
  assert.match(text, /\/rfr-process:deliver/);
});

test('revisions-and-foundations#AC-8: the guide describes the revision packet and names the skill', () => {
  const guide = flat(read(GUIDE));
  assert.match(guide, /### A revision packet/);
  assert.match(guide, /`\/rfr-process:revise`/);
  assert.match(guide, /The chain has two sides\. The document side .* The delivery side /);
  assert.match(guide, /impact report[^.]*first/i);
  assert.match(guide, /process-impact\.mjs/);
  assert.match(guide, /`## Revision`/);
  assert.match(guide, /never re-record[^.]*without reading/i);
  assert.match(guide, /delivery side[^.]*open work/i);
});
