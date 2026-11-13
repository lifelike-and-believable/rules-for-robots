// Tests for the rfr-web guard-mcp hook: which Vercel MCP calls it asks about. Moved from
// test/hooks.test.mjs (rewrite plan 25e, verify inventory slice f).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

test('guard-mcp asks before Vercel actions that change or expose the account', async () => {
  const { vercelToolNeedsApproval } = await import('../scripts/guard-mcp.mjs');
  for (const t of ['mcp__Vercel__create_deployment', 'mcp__vercel__edit_project_env', 'mcp__plugin_vercel_vercel__delete_project', 'mcp__Vercel__buy_domain', 'mcp__Vercel__get_auth_token', 'mcp__Vercel__request_rollback', 'mcp__Vercel__update_project_protection_bypass']) {
    assert.ok(vercelToolNeedsApproval(t), t);
  }
  for (const t of ['mcp__Vercel__get_deployment', 'mcp__Vercel__list_projects', 'mcp__Vercel__get_runtime_logs', 'mcp__Vercel__search_vercel_documentation', 'mcp__github__create_pull_request', 'Bash']) {
    assert.ok(!vercelToolNeedsApproval(t), t);
  }
});

test('guard-mcp asks before Vercel reads that return decrypted environment variables or tokens (NODE-002)', async () => {
  const { vercelToolNeedsApproval } = await import('../scripts/guard-mcp.mjs');
  // Vercel's tool schemas: get_project_env "get the decrypted value", get_shared_env_var "including its decrypted value".
  for (const t of ['mcp__Vercel__get_project_env', 'mcp__vercel__get_shared_env_var', 'mcp__plugin_vercel_vercel__get_project_env', 'mcp__Vercel__get_edge_config_tokens']) {
    assert.ok(vercelToolNeedsApproval(t, { idOrName: 'prj_1', id: 'env_1' }), t);
  }
  // filter_project_envs lists variables, and decrypts them only when asked to.
  for (const decrypt of ['true', true, 'TRUE']) {
    assert.ok(vercelToolNeedsApproval('mcp__Vercel__filter_project_envs', { idOrName: 'prj_1', decrypt }), String(decrypt));
  }
  for (const input of [{ idOrName: 'prj_1' }, { idOrName: 'prj_1', decrypt: 'false' }, { idOrName: 'prj_1', decrypt: false }, undefined]) {
    assert.ok(!vercelToolNeedsApproval('mcp__Vercel__filter_project_envs', input), JSON.stringify(input));
  }
  // The hook passes tool_input through, so a decrypting call asks end to end.
  const run = input => spawnSync(process.execPath, ['plugins/web/scripts/guard-mcp.mjs'], { input: JSON.stringify(input), encoding: 'utf8' });
  assert.match(run({ tool_name: 'mcp__Vercel__filter_project_envs', tool_input: { idOrName: 'prj_1', decrypt: 'true' } }).stdout, /"permissionDecision":\s*"deny".*Claude does not do this here/);
  assert.equal(run({ tool_name: 'mcp__Vercel__filter_project_envs', tool_input: { idOrName: 'prj_1' } }).stdout.trim(), '');
});

test('guard-mcp asks on any form of decrypt, names secrets in its question, and matches the server name in any case (NODE-002)', async () => {
  const { vercelToolNeedsApproval } = await import('../scripts/guard-mcp.mjs');
  const f = 'mcp__Vercel__filter_project_envs';
  for (const input of [{ decrypt: 1 }, { decrypt: '1' }, { decrypt: 'yes' }, { decrypt: 'true ' }, { Decrypt: 'true' }, { query: { decrypt: 'true' } }, '{"idOrName":"p","decrypt":"true"}']) {
    assert.ok(vercelToolNeedsApproval(f, input), JSON.stringify(input));
  }
  for (const input of [{ decrypt: 'False' }, { decrypt: false }, { decrypt: null }, '{"idOrName":"p"}', {}]) {
    assert.ok(!vercelToolNeedsApproval(f, input), JSON.stringify(input));
  }
  // Read tools Vercel documents as returning masked or non-secret data still pass.
  for (const t of ['mcp__Vercel__list_feature_flag_sdk_keys', 'mcp__Vercel__get_bypass_ip']) assert.ok(!vercelToolNeedsApproval(t, {}), t);

  const run = input => spawnSync(process.execPath, ['plugins/web/scripts/guard-mcp.mjs'], { input: JSON.stringify(input), encoding: 'utf8' });
  assert.match(run({ tool_name: 'mcp__Vercel__get_project_env', tool_input: { idOrName: 'p', id: 'e' } }).stdout, /returns secret values \(decrypted environment variables or tokens\)/);
  assert.match(run({ tool_name: 'mcp__Vercel__create_deployment', tool_input: { target: 'production' } }).stdout, /can change or expose your Vercel account/);
  assert.equal(run({ tool_name: 'mcp__Vercel__create_deployment', tool_input: {} }).stdout, '', 'a preview deploy goes ahead');

  const hooks = JSON.parse(fs.readFileSync('plugins/web/hooks/hooks.json', 'utf8'));
  const entry = hooks.hooks.PreToolUse.find(h => h.hooks.some(x => x.command.includes('guard-mcp.mjs')));
  const matcher = new RegExp(`^(?:${entry.matcher})$`);
  for (const t of ['mcp__Vercel__get_project_env', 'mcp__claude_ai_VERCEL__get_project_env', 'mcp__plugin_vercel_vercel__get_project_env']) assert.match(t, matcher);
});
