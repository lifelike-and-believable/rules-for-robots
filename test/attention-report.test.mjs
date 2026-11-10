// Attention report (docs/improvement-plan.md, slice 19a): waits on a person, read from transcripts.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractEvents, formatReport, isHumanMessage, summarise } from '../checks/attention-report.mjs';

const SCRIPT = path.resolve('checks/attention-report.mjs');
const t0 = Date.parse('2026-11-01T10:00:00Z');
const at = s => new Date(t0 + s * 1000).toISOString();
const human = (s, text) => ({ type: 'user', sessionId: 'S', timestamp: at(s), origin: { kind: 'human' }, message: { role: 'user', content: [{ type: 'text', text }] } });
const assistant = (s, stop, tools = []) => ({ type: 'assistant', sessionId: 'S', timestamp: at(s), message: { stop_reason: stop, content: tools.map(([id, name, input]) => ({ type: 'tool_use', id, name, input })) } });
const result = (s, id, permissionDecision) => ({ type: 'user', sessionId: 'S', timestamp: at(s), toolUseResult: {}, permissionDecision, message: { content: [{ type: 'tool_result', tool_use_id: id }] } });

const session = [
  human(0, 'Build the settings page please'),
  assistant(5, 'tool_use', [['t1', 'Bash', { command: 'npm test' }]]),
  result(6, 't1', { decision: 'accept', source: 'config' }),
  assistant(10, 'tool_use', [['t2', 'Bash', { command: 'gh pr merge 12 --squash' }]]),
  result(70, 't2', { decision: 'accept', source: 'user_temporary' }),
  assistant(80, 'tool_use', [['t3', 'AskUserQuestion', { questions: [] }]]),
  result(200, 't3', undefined),
  assistant(210, 'tool_use', [['t4', 'Edit', { file_path: 'x' }]]),
  result(215, 't4', { decision: 'reject', source: 'user_reject' }),
  assistant(220, 'end_turn'),
  human(820, 'Looks good, carry on with the next one'),
  assistant(830, 'tool_use', [['t5', 'Bash', { command: 'ls' }]]),
  human(835, 'also check the footer'),
  result(836, 't5', { decision: 'accept', source: 'config' }),
  assistant(840, 'end_turn'),
];

test('each kind of wait is found, with its duration', () => {
  const events = extractEvents(session);
  assert.deepEqual(events.map(e => e.kind), ['intent', 'prompt', 'question', 'prompt', 'reply', 'aside']);
  const [intent, merge, question, declined, reply, aside] = events;
  assert.equal(intent.waitMs, 0);
  assert.equal(merge.waitMs, 60000);
  assert.equal(merge.merge, true);
  assert.equal(question.waitMs, 120000);
  assert.equal(declined.decision, 'reject');
  assert.equal(declined.merge, false);
  assert.equal(reply.waitMs, 600000);
  assert.equal(aside.waitMs, 0);
});

test('prompts settled by configuration or the classifier are not waits', () => {
  const events = extractEvents(session);
  assert.equal(events.filter(e => e.kind === 'prompt').length, 2);
});

test('subagent transcripts give prompts and questions, never typed messages', () => {
  const events = extractEvents(session, { sidechain: true });
  assert.deepEqual(events.map(e => e.kind), ['prompt', 'question', 'prompt']);
});

test('older transcripts without origin: typed text counts, notices and commands do not', () => {
  const plain = text => ({ type: 'user', timestamp: at(0), message: { content: text } });
  assert.equal(isHumanMessage(plain('Fix the login bug')), true);
  assert.equal(isHumanMessage(plain('<command-name>/clear</command-name>')), false);
  assert.equal(isHumanMessage(plain('<task-notification>done</task-notification>')), false);
  assert.equal(isHumanMessage({ ...plain('x'), isMeta: true }), false);
  assert.equal(isHumanMessage({ ...plain('x'), origin: { kind: 'peer' } }), false);
});

test('summary: totals, kinds, prompts by tool, and figures per merged pull request', () => {
  const r = summarise(extractEvents(session), { merged: 2 });
  assert.equal(r.waits, 4);
  assert.equal(r.blockedMs, 60000 + 120000 + 5000 + 600000);
  assert.deepEqual(r.promptTools, { merge: 1, Edit: 1 });
  assert.equal(r.declined, 1);
  assert.equal(r.words, 5 + 8 + 4);
  assert.equal(r.perMerged.waits, 2);
  assert.match(formatReport(r), /Per merged pull request \(2\): 2\.0 waits/);
  assert.match(formatReport(summarise(extractEvents(session))), /Pass --merged/);
});

test('the command line reads a folder of transcripts and prints no message text', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-attention-'));
  fs.mkdirSync(path.join(dir, 'S', 'subagents'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'S.jsonl'), `${session.map(e => JSON.stringify(e)).join('\n')}\n{partial`);
  fs.writeFileSync(path.join(dir, 'S', 'subagents', 'agent-1.jsonl'), `${JSON.stringify(human(1, 'subagent prompt text'))}\n`);
  const r = spawnSync(process.execPath, [SCRIPT, dir, '--merged', '1', '--json'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.waits, 4);
  assert.equal(out.byKind.intent.count, 1);
  assert.doesNotMatch(r.stdout, /settings page|footer/);
  const text = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
  assert.doesNotMatch(text.stdout, /settings page|footer/);
  assert.equal(spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, [SCRIPT, dir, '--merged', '0'], { encoding: 'utf8' }).status, 2);
});
