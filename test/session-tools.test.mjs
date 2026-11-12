// A session may subscribe to a pull request's activity (docs/specs/unattended.md, AC-9), so that the
// merge of a feature packet can start its delivery. Other tools that change something through
// another service are still refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultDecision } from '../plugins/core/scripts/allow-default.mjs';

const on = { permissions: 'default-allow' };
const decide = tool => defaultDecision({ tool_name: tool }, on);

test('unattended#AC-9 subscribing to and unsubscribing from a pull request is allowed', () => {
  for (const tool of ['mcp__claude-code-remote__subscribe_pr_activity', 'mcp__claude-code-remote__unsubscribe_pr_activity']) {
    const d = decide(tool);
    assert.equal(d.decision, 'allow', tool);
    assert.match(d.reason, /told about a pull request/);
  }
});

test('unattended#AC-9 the session tools that act for the person are still refused', () => {
  for (const tool of ['mcp__claude-code-remote__create_session', 'mcp__claude-code-remote__create_trigger', 'mcp__claude-code-remote__update_environment', 'mcp__other-server__subscribe_pr_activity']) {
    assert.equal(decide(tool).decision, 'never', tool);
  }
});

test('unattended#AC-9 with "permissions": "ask" the hook still decides nothing', () => {
  assert.equal(defaultDecision({ tool_name: 'mcp__claude-code-remote__subscribe_pr_activity' }, { permissions: 'ask' }), null);
});
