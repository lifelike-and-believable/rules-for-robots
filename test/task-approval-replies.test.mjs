// Merge instructions as people write them (docs/specs/task-approval.md, AC-13 and AC-14; feedback
// #205 and #206): a merge clause followed by another request, and a short "yes" to the agent's own
// question about a merge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { agrees, approvedTasks, latestInput, mergeInstruction } from '../plugins/core/scripts/task-approval.mjs';

function transcript(...entries) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-replies-')), 's.jsonl');
  fs.writeFileSync(file, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
  return file;
}
const said = text => ({ type: 'assistant', isSidechain: false, message: { content: [{ type: 'text', text }] } });
const typed = (text, timestamp = '2026-11-12T13:00:00Z') => ({ type: 'user', origin: { kind: 'human' }, timestamp, isSidechain: false, message: { content: text } });

test('task-approval#AC-13: a merge clause followed by "and" or a comma and another request is a merge instruction for its own pull requests (#206)', () => {
  assert.deepEqual(mergeInstruction('merge 344 and go through the gaps'), { numbers: [344] });
  assert.deepEqual(mergeInstruction('yes, merge 344 and put up the scenario'), { numbers: [344] });
  assert.deepEqual(mergeInstruction('merge 344 when green, and carry on'), { numbers: [344] });
  assert.deepEqual(mergeInstruction('merge when green and start the next task'), { numbers: [] });
  assert.deepEqual(mergeInstruction('merge 301 and 302'), { numbers: [301, 302] });
  for (const text of ['fix the merge conflict and push', "don't merge 344 and wait", 'should I merge 344 and push?']) assert.equal(mergeInstruction(text), null, text);
});

test("task-approval#AC-14: a short yes to the agent's own question approves what the question named (#205)", () => {
  const file = transcript(said('The design is ready in #344. Merge #344 and start the next task?'), typed('go ahead for both'));
  const input = latestInput(file);
  assert.equal(input.kind, 'typed');
  const tasks = approvedTasks(input);
  assert.deepEqual(tasks.merge, { numbers: [344] });
  assert.match(tasks.quote, /go ahead for both \(to: .*Merge #344/);
  // A release the agent asked about.
  assert.deepEqual(approvedTasks(latestInput(transcript(said('All merged. Shall I publish 7.1.0?'), typed('yes')))).releases, ['7.1.0']);
  // Not a yes, not short, or no question before it: nothing from the question.
  for (const reply of ['no', 'yes but wait for CI', 'what does it change?', 'not yet']) {
    assert.equal(approvedTasks(latestInput(transcript(said('Merge #344?'), typed(reply)))).merge, null, reply);
  }
  assert.equal(approvedTasks(latestInput(transcript(said('I merged the design branch.'), typed('ok')))).merge, null, 'no question was asked');
  // Only the agent's message just before the reply counts, not an older one.
  assert.equal(approvedTasks(latestInput(transcript(said('Merge #344?'), typed('later'), said('Tests pass.'), typed('ok')))).merge, null);
  for (const t of ['yes', 'go ahead for both', 'Sure, do it', 'ok']) assert.equal(agrees(t), true, t);
});
