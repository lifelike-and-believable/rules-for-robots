// A session may subscribe to a pull request's activity (docs/specs/unattended.md, AC-9), so that the
// merge of a feature packet can start its delivery. Other tools that change something through
// another service are still refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mcpNever } from '../plugins/core/scripts/guard-mcp-tools.mjs';

const decide = tool => mcpNever({ tool_name: tool });

test('unattended#AC-9 subscribing to and unsubscribing from a pull request is not refused', () => {
  for (const tool of ['mcp__claude-code-remote__subscribe_pr_activity', 'mcp__claude-code-remote__unsubscribe_pr_activity']) {
    assert.equal(decide(tool), null, tool);
  }
});

test('unattended#AC-9 the session tools that act for the person are still refused', () => {
  for (const tool of ['mcp__claude-code-remote__create_session', 'mcp__claude-code-remote__create_trigger', 'mcp__claude-code-remote__update_environment', 'mcp__other-server__subscribe_pr_activity']) {
    assert.match(decide(tool) ?? '', /^rfr-core \(never list\)/, tool);
  }
});
