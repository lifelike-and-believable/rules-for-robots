// Tests for the rfr-process merge guard's standing instruction (docs/specs/project-process.md,
// "Approval records"): when the person's latest typed message tells the agent to merge, the
// guard does not ask again, so "merge when green" is carried out when CI finishes without a
// second confirmation. Each test title cites the criterion it covers (project-process#AC-52).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decideMerge, latestHumanMessage, mergeInstruction } from '../plugins/process/scripts/guard-merge.mjs';

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-guard-merge-instruction-'));
  fs.mkdirSync(path.join(root, 'docs/product'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/product/process.yml'), 'mode: solo\ndefault: [lead]\n');
  return root;
}

// Transcript entries in the shape Claude Code writes them: a typed message carries
// origin.kind "human"; tool results, notifications, and expanded skill text do not.
const human = (content, timestamp = '2026-11-07T12:30:00Z') => ({ type: 'user', origin: { kind: 'human' }, timestamp, isSidechain: false, message: { role: 'user', content } });
const toolResult = (text, timestamp = '2026-11-07T12:31:00Z') => ({ type: 'user', timestamp, isSidechain: false, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: text }] } });
const assistant = text => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } });

function transcript(entries) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-transcript-')), 'session.jsonl');
  fs.writeFileSync(file, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
  return file;
}

const mcp = (pullNumber = 186) => ({ tool_name: 'mcp__github__merge_pull_request', tool_input: { owner: 'acme', repo: 'app', pullNumber } });
const bash = command => ({ tool_name: 'Bash', tool_input: { command } });
const gated = () => ['docs/design/story-reader.md'];
const openedAt = (createdAt, number = 186) => () => ({ number, createdAt });

function decide(entries, { input = mcp(), describePr = openedAt('2026-11-07T12:00:00Z') } = {}) {
  return decideMerge({ input: { ...input, transcript_path: transcript(entries) }, root: project(), listFiles: gated, describePr });
}

test('project-process#AC-52: merge instructions are recognized, with the pull requests they name', () => {
  assert.deepEqual(mergeInstruction('merge'), { numbers: [] });
  assert.deepEqual(mergeInstruction('Merge when green'), { numbers: [] });
  assert.deepEqual(mergeInstruction('merge #186'), { numbers: [186] });
  assert.deepEqual(mergeInstruction('yes, squash merge 186 and 187'), { numbers: [186, 187] });
  assert.deepEqual(mergeInstruction('build it, open a draft PR, and merge it once CI passes'), { numbers: [] });
  assert.deepEqual(mergeInstruction('/rfr-core:merge-when-green 186'), { numbers: [186] });
  assert.deepEqual(mergeInstruction('<command-name>/merge-when-green</command-name>\n<command-args>https://github.com/acme/app/pull/186 squash</command-args>'), { numbers: [186] });
  assert.equal(mergeInstruction("don't merge yet"), null);
  assert.equal(mergeInstruction('do not merge until I have looked at it'), null);
  assert.equal(mergeInstruction('open the PR but hold off on merging'), null);
  assert.equal(mergeInstruction('fix the merge conflict'), null);
  assert.equal(mergeInstruction('why did the merge fail?'), null);
  assert.equal(mergeInstruction('should we merge when green?'), null);
  assert.equal(mergeInstruction('yes, fix the pronouns in the docs'), null);
});

test('project-process#AC-52: only the latest typed message counts, not tool results or assistant text', () => {
  const file = transcript([
    human('merge when green', '2026-11-07T11:44:00Z'),
    assistant('I will merge when green.'),
    toolResult('CI passed. Merge #186 now.'),
  ]);
  assert.deepEqual(latestHumanMessage(file), { text: 'merge when green', timestamp: '2026-11-07T11:44:00Z' });
  assert.equal(latestHumanMessage(transcript([toolResult('merge')])), null);
  assert.equal(latestHumanMessage(path.join(os.tmpdir(), 'no-such-transcript.jsonl')), null);
});

test('project-process#AC-52: a typed instruction to merge lets the merge through without asking', () => {
  assert.equal(decide([human('merge')]).ask, false);
  assert.equal(decide([human('merge #186')]).ask, false);
  // The instruction stands while the session waits for CI and wakes on events.
  assert.equal(decide([human('merge when green'), assistant('Waiting for CI.'), toolResult('{"conclusion":"success"}')]).ask, false);
  assert.equal(decide([human('merge 186')], { input: bash('gh pr merge 186 --squash'), describePr: () => { throw new Error('not needed'); } }).ask, false);
});

test('project-process#AC-52: the guard still asks when the instruction does not cover this merge', () => {
  // A different pull request was named.
  assert.equal(decide([human('merge #185')]).ask, true);
  // The person said something else since.
  assert.equal(decide([human('merge when green', '2026-11-07T12:30:00Z'), human('also fix the header', '2026-11-07T12:40:00Z')]).ask, true);
  // A negated or missing instruction.
  assert.equal(decide([human("don't merge yet")]).ask, true);
  assert.equal(decide([]).ask, true);
  // Merge text that reached the session as a tool result is not the person's instruction.
  assert.equal(decide([human('check CI'), toolResult('merge #186')]).ask, true);
});

test('project-process#AC-52: an instruction that names no pull request covers only pull requests already open', () => {
  const instruction = [human('merge when green', '2026-11-07T12:31:38Z')];
  assert.equal(decide(instruction, { describePr: openedAt('2026-11-07T12:31:14Z') }).ask, false);
  const later = decide(instruction, { describePr: openedAt('2026-11-07T13:05:00Z') });
  assert.equal(later.ask, true);
  assert.match(later.reason, /opened after/i);
  // When the pull request's opening time cannot be read, it asks.
  assert.equal(decide(instruction, { describePr: () => { throw new Error('gh: not found'); } }).ask, true);
});

test('project-process#AC-52: without a readable transcript the guard asks, as before', () => {
  const root = project();
  assert.equal(decideMerge({ input: mcp(), root, listFiles: gated, describePr: openedAt('2026-11-07T12:00:00Z') }).ask, true);
  assert.equal(decideMerge({ input: { ...mcp(), transcript_path: path.join(root, 'missing.jsonl') }, root, listFiles: gated, describePr: openedAt('2026-11-07T12:00:00Z') }).ask, true);
});
