// The MCP refusal audit (rewrite plan 25f): every MCP tool name seen in a cloud session gets the decision
// test/fixtures/mcp-tool-decisions.json gives it. Refused: a change in another service, spending, another
// session or environment, or asking the user mid-run. Allowed: reads wherever the read word is in the
// name, local tools, and this session's own tools.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mcpNever, onlyReads } from '../plugins/core/scripts/guard-mcp-tools.mjs';

const { cases } = JSON.parse(fs.readFileSync('test/fixtures/mcp-tool-decisions.json', 'utf8'));

test('every tool in the audit corpus gets its recorded decision', () => {
  const wrong = cases
    .map(c => ({ ...c, got: mcpNever({ tool_name: c.tool, tool_input: c.input ?? {} }) ? 'refuse' : 'allow' }))
    .filter(c => c.got !== c.decision)
    .map(c => `${c.tool}: ${c.got}, expected ${c.decision}`);
  assert.deepEqual(wrong, []);
  assert.ok(cases.length >= 170, `${cases.length} cases`);
});

test('a read word anywhere makes a read, unless a change word is also there', () => {
  for (const action of ['microsoft_docs_search', 'recordings_list', 'capabilities_invoke_read', 'search', 'read', 'download_file_content', 'my_notes_get_note_content', 'get_trigger']) assert.ok(onlyReads(action), action);
  for (const action of ['capabilities_invoke_write', 'create_file', 'share_file', 'meeting_create', 'save_to_library', 'generate_image', 'send_message', 'fork_repository']) assert.ok(!onlyReads(action), action);
  assert.ok(!onlyReads('frobnicate'), 'an action with no read word is not a read');
});

test('add_repo is allowed for read access only, and the session\'s own tools are allowed', () => {
  assert.equal(mcpNever({ tool_name: 'mcp__claude-code-remote__add_repo', tool_input: { owner: 'o', repo: 'r' } }), null);
  assert.equal(mcpNever({ tool_name: 'mcp__claude-code-remote__add_repo', tool_input: { owner: 'o', repo: 'r', access: 'read' } }), null);
  assert.match(mcpNever({ tool_name: 'mcp__claude-code-remote__add_repo', tool_input: { owner: 'o', repo: 'r', access: 'push' } }), /never list/);
  for (const action of ['send_later', 'register_repo_root', 'report_preview_port', 'watch_url', 'unwatch_url']) {
    assert.equal(mcpNever({ tool_name: `mcp__claude-code-remote__${action}` }), null, action);
  }
  for (const action of ['send_message', 'create_session', 'create_trigger', 'fire_trigger', 'delete_trigger', 'update_environment', 'request_credential']) {
    assert.match(mcpNever({ tool_name: `mcp__claude-code-remote__${action}` }) ?? '', /never list/, action);
  }
});
