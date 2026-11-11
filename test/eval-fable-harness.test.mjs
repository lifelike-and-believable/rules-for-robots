// Harness options for the Fable 5.2 round (evals/README.md, "Fable 5.2 round"): an advisor model,
// agent model and effort overrides, and per-model usage in each run record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { advisorCalls, overridePlugin, parseArgs, sessionFlags, usageByModel } from '../evals/run.mjs';

test('parseArgs reads --advisor, and --agent-model and --agent-effort per agent', () => {
  const opts = parseArgs(['--advisor', 'fable', '--agent-model', 'software-architect=claude-opus-5-5,tech-lead=sonnet', '--agent-effort', 'software-architect=medium']);
  assert.equal(opts.advisor, 'fable');
  assert.deepEqual(opts.agentOverrides, { 'software-architect': { model: 'claude-opus-5-5', effort: 'medium' }, 'tech-lead': { model: 'sonnet' } });
  const plain = parseArgs([]);
  assert.equal(plain.advisor, null);
  assert.deepEqual(plain.agentOverrides, {});
  assert.throws(() => parseArgs(['--agent-model', 'software-architect']), /expected <agent>=<model>/);
});

test('sessionFlags adds effort and the advisor only when they are set', () => {
  assert.deepEqual(sessionFlags(), []);
  assert.deepEqual(sessionFlags({ effort: 'medium' }), ['--effort', 'medium']);
  assert.deepEqual(sessionFlags({ effort: 'high', advisor: 'fable' }), ['--effort', 'high', '--settings', '{"advisorModel":"fable"}']);
});

test('overridePlugin changes only the named agent\'s frontmatter in a copy, and refuses a typo', () => {
  const src = 'plugins/core';
  const before = fs.readFileSync(path.join(src, 'agents', 'software-architect.md'), 'utf8');
  const dir = overridePlugin(src, { 'software-architect': { model: 'claude-opus-5-5', effort: 'medium' } });
  const text = fs.readFileSync(path.join(dir, 'agents', 'software-architect.md'), 'utf8');
  assert.match(text, /^model: claude-opus-5-5$/m);
  assert.match(text, /^effort: medium$/m);
  // The body and the other agents are unchanged, and so is the source plugin.
  assert.equal(text.split('\n---')[1], before.split('\n---')[1]);
  assert.equal(fs.readFileSync(path.join(dir, 'agents', 'tech-lead.md'), 'utf8'), fs.readFileSync(path.join(src, 'agents', 'tech-lead.md'), 'utf8'));
  assert.equal(fs.readFileSync(path.join(src, 'agents', 'software-architect.md'), 'utf8'), before);
  assert.throws(() => overridePlugin(src, { 'software-archtect': { model: 'opus' } }), /no agent software-archtect/);
  assert.throws(() => overridePlugin(src, { 'software-architect': { colour: 'blue' } }), /no colour field/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('usageByModel adds each session\'s last result per model, and advisorCalls counts advisor tool calls', () => {
  const result = usage => ({ type: 'result', total_cost_usd: 1, modelUsage: usage });
  const events = [
    { type: 'assistant', message: { content: [{ type: 'server_tool_use', name: 'advisor' }, { type: 'text', text: 'ok' }] } },
    result({ 'claude-sonnet-5-5': { costUSD: 0.1, outputTokens: 100 } }),
    result({ 'claude-sonnet-5-5': { costUSD: 0.2, outputTokens: 200 }, 'claude-fable-5-2': { costUSD: 0.5, outputTokens: 900 } }),
    { type: 'rfr_session_break' },
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'advisor' }, { type: 'tool_use', name: 'Read' }] } },
    result({ 'claude-sonnet-5-5': { costUSD: 0.3, outputTokens: 300 } }),
  ];
  assert.deepEqual(usageByModel(events), {
    'claude-sonnet-5-5': { costUsd: 0.5, outputTokens: 500 },
    'claude-fable-5-2': { costUsd: 0.5, outputTokens: 900 },
  });
  assert.deepEqual(usageByModel([]), {});
  assert.equal(advisorCalls(events), 2);
});
