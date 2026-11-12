// Approval in chat, never by prompt (docs/specs/default-allow.md, AC-10): a guard that needs the
// person's decision refuses the call and sends the agent to ask in chat; once the person says yes, the
// same call goes ahead once. No guard prints an ask unless the project sets "permissions": "ask".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isYes, latestPersonInput } from '../plugins/core/scripts/chat-approval.mjs';
import { defaultDecision } from '../plugins/core/scripts/allow-default.mjs';

let clock = 0;
const at = () => new Date(Date.now() + 1000 * clock++).toISOString();
const typed = text => ({ type: 'user', origin: { kind: 'human' }, timestamp: at(), isSidechain: false, message: { content: text } });
const answered = text => ({ type: 'user', timestamp: at(), isSidechain: false, toolUseResult: { answers: { 'Force-push the branch?': text } }, message: { content: [{ type: 'tool_result', tool_use_id: 'q1', content: 'answered' }] } });

function setup() {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-chat-data-'));
  const transcript = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-chat-t-')), 's.jsonl');
  fs.writeFileSync(transcript, `${JSON.stringify(typed('carry on with the plan'))}\n`);
  const say = entry => fs.appendFileSync(transcript, `${JSON.stringify(entry)}\n`);
  const call = (command, env = {}) => {
    const r = spawnSync(process.execPath, ['plugins/core/scripts/guard-commands.mjs'], {
      input: JSON.stringify({ session_id: 's', tool_name: 'Bash', cwd: process.cwd(), transcript_path: transcript, tool_input: { command } }),
      encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_DATA: data, ...env },
    });
    return r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput : null;
  };
  return { say, call };
}

test('default-allow#AC-10: a decision for the person is a refusal that sends the agent to ask in chat, never a prompt', () => {
  const { call } = setup();
  const out = call('git push --force origin feature');
  assert.equal(out.permissionDecision, 'deny');
  assert.match(out.permissionDecisionReason, /force-push/);
  assert.match(out.permissionDecisionReason, /Ask them in chat, in plain words, what you want to do and why \(not the command text\)/);
  // With "permissions": "ask" the prompt comes back.
  assert.equal(call('git push --force origin feature', { RFR_PERMISSIONS: 'ask' }).permissionDecision, 'ask');
});

test('default-allow#AC-10: after the person says yes in chat, the same call goes ahead once', () => {
  const { say, call } = setup();
  const command = 'git push --force origin feature';
  assert.equal(call(command).permissionDecision, 'deny');
  // A yes before nothing was refused, or to a different call, approves nothing.
  say(typed('yes, go ahead'));
  assert.equal(call('git push --force origin other').permissionDecision, 'deny');
  const approved = call(command);
  assert.equal(approved.permissionDecision, 'allow');
  assert.match(approved.permissionDecisionReason, /approved in chat \("yes, go ahead"\)/);
  // Used once: the next identical call is refused again until the person says yes again.
  assert.equal(call(command).permissionDecision, 'deny');
  say(answered('Yes'));
  assert.equal(call(command).permissionDecision, 'allow', 'an answer to the agent\'s own question counts');
});

test('default-allow#AC-10: a no, a question, or anything that is not a yes approves nothing', () => {
  for (const text of ['no', "don't do that", 'yes, but wait until tomorrow', 'should we?', 'what does that do?', 'looks good to me but hold on', 'cancel']) {
    assert.equal(isYes(text), false, text);
  }
  for (const text of ['yes', 'Yes please', 'ok', 'sure', 'go ahead', 'do it', 'approved', 'sounds good']) assert.equal(isYes(text), true, text);
  const { say, call } = setup();
  const command = 'git push --force origin feature';
  call(command);
  say(typed('no, leave it'));
  assert.equal(call(command).permissionDecision, 'deny');
  assert.equal(latestPersonInput(null), null);
});

test('default-allow#AC-10: an MCP tool that changes another service is a chat decision; reads and GitHub work are allowed', () => {
  const on = { permissions: 'default-allow' };
  assert.equal(defaultDecision({ tool_name: 'mcp__claude_ai_Gmail__create_draft' }, on).decision, 'chat');
  assert.equal(defaultDecision({ tool_name: 'mcp__github__delete_file' }, on).decision, 'chat');
  for (const tool of ['mcp__claude_ai_Gmail__search_threads', 'mcp__github__create_pull_request', 'mcp__github__merge_pull_request', 'mcp__claude_ai_Vercel__create_deployment']) {
    assert.equal(defaultDecision({ tool_name: tool }, on).decision, 'allow', tool);
  }
  assert.equal(defaultDecision({ tool_name: 'mcp__claude_ai_Gmail__create_draft' }, { permissions: 'ask' }), null);
});
