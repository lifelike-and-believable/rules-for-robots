// Tests for evals/regrade.mjs: re-grading saved transcripts with the current graders.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseTranscriptName, readTranscript, regrade, relativeToWorkspace, summarise } from '../evals/regrade.mjs';

test('regrade: transcript names give the case, model, arm, and run', () => {
  assert.deepEqual(parseTranscriptName('arch-money-storage.claude-opus-5-5.rules-agents.2.transcript.jsonl'), { case: 'arch-money-storage', model: 'claude-opus-5-5', arm: 'rules+agents', run: 2 });
  assert.deepEqual(parseTranscriptName('lead-plan-order.claude-sonnet-5-5.rules.1.transcript.jsonl'), { case: 'lead-plan-order', model: 'claude-sonnet-5-5', arm: 'rules', run: 1 });
  assert.equal(parseTranscriptName('runs.json'), null);
});

test('regrade: only files in the eval workspace count, not Claude\'s scratchpad for the run', () => {
  const workspace = 'C:\\Users\\Demo\\AppData\\Local\\Temp\\rfr-eval-arch-money-storage-axcHUV\\docs\\adr\\0002-x.md';
  assert.equal(relativeToWorkspace(workspace, 'arch-money-storage'), 'docs/adr/0002-x.md');
  assert.equal(relativeToWorkspace('/tmp/rfr-eval-arch-money-storage-abc/docs/adr/0002-x.md', 'arch-money-storage'), null, 'only a Temp folder is a workspace');
  const scratchpad = 'C:\\Users\\Demo\\AppData\\Local\\Temp\\claude\\C--Users-Demo-AppData-Local-Temp-rfr-eval-arch-money-storage-axcHUV\\07ce\\scratchpad\\probe.mjs';
  assert.equal(relativeToWorkspace(scratchpad, 'arch-money-storage'), null);
});

test('regrade: replays a transcript into a fresh workspace and grades it with the current grader', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-regrade-test-'));
  const event = (type, extra) => JSON.stringify({ type, ...extra });
  const good = 'Criterion 1 is not met: src/login.js never calls the limiter, so POST /login answers 401, never 429.';
  const lines = (text) => [
    event('assistant', { message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'x' } }] } }),
    event('result', { result: text }),
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'lead-check-claim.claude-sonnet-5-5.rules.1.transcript.jsonl'), lines(good));
  fs.writeFileSync(path.join(dir, 'lead-check-claim.claude-sonnet-5-5.rules.2.transcript.jsonl'), lines('All four criteria are met. Ready to merge.'));
  const records = await regrade(dir);
  assert.deepEqual(records.map(r => r.pass), [true, false]);
  assert.equal(summarise(records).length, 1);
  assert.match(summarise(records)[0], /^lead-check-claim \| claude-sonnet-5-5 \| rules: 1\/2 .*flagsCriterionOne/);
  assert.equal(readTranscript(path.join(dir, 'lead-check-claim.claude-sonnet-5-5.rules.1.transcript.jsonl')).finalText, good);
  fs.rmSync(dir, { recursive: true, force: true });
});
