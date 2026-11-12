// The merge instructions practices/guards.md lists ("Merge instructions, and how each is read"), checked
// against the recognizer, so the table and the code cannot drift (task-approval AC-1 and AC-9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mergeInstruction, standingInstructions, tasksIn } from '../plugins/core/scripts/task-approval.mjs';

const standing = text => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-phrasing-')), 'session.jsonl');
  fs.writeFileSync(file, `${JSON.stringify({ type: 'user', origin: { kind: 'human' }, message: { content: text } })}\n`);
  return standingInstructions(file);
};

test('task-approval#AC-1: a merge joined to other tasks is still a merge instruction', () => {
  assert.deepEqual(mergeInstruction('merge and release 5.11.0'), { numbers: [] });
  assert.deepEqual(tasksIn('merge and release 5.11.0').releases, ['5.11.0']);
  assert.deepEqual(mergeInstruction('merge 301, then release 5.11.0'), { numbers: [301] });
  assert.deepEqual(mergeInstruction('merge 196 and then release'), { numbers: [196] });
  assert.deepEqual(mergeInstruction('review it, then merge'), { numbers: [] });
  // Text that only mentions merging is not an instruction.
  for (const text of ['fix the merge conflict, then push', 'resolve the merge, then continue', 'look at the merge queue and push']) {
    assert.equal(mergeInstruction(text), null, text);
  }
});

test('task-approval#AC-9: each row of the guide\'s merge table is read as the guide says', () => {
  // [phrase, pull requests named (null: not a single instruction), standing merge]
  const rows = [
    ['merge 301', [301], false],
    ['merge 301 when green', [301], false],
    ['merge 301 and 302', [301, 302], false],
    ['merge when green', [], false],
    ['merge it once CI passes', [], false],
    ['merge when all checks pass', [], false],
    ['merge 301, then release 5.11.0', [301], false],
    ['merge each PR when green', [], true],
    ['merge PRs as you go', null, true],
    ['keep merging', null, true],
    ["don't merge yet", null, false],
    ['hold off on merging', null, false],
    ['should we merge?', null, false],
  ];
  for (const [text, numbers, isStanding] of rows) {
    assert.deepEqual(mergeInstruction(text)?.numbers ?? null, numbers, text);
    assert.equal(Boolean(standing(text).merge), isStanding, text);
  }
  assert.ok(standing('push each branch as you go').push);
});
