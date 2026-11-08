#!/usr/bin/env node
// PreToolUse (Vercel MCP tools): ask before tools that deploy, change settings or
// environment variables, decrypt, delete, or purchase (rule NODE-002). Read-only tools
// pass through, except those that return credentials or decrypted environment variables,
// and filter_project_envs when it is asked to decrypt.
import { fileURLToPath } from 'node:url';
import { ask, readInput } from './lib.mjs';

const READ_PREFIXES = ['get_', 'list_', 'search_', 'read_', 'count_', 'aggregate_', 'filter_', 'status', 'web_fetch', 'artifact_query'];
// get_project_env and get_shared_env_var return decrypted values (Vercel's tool schemas:
// "get the decrypted value", "including its decrypted value").
const SENSITIVE_READS = new Set(['get_auth_token', 'get_project_token', 'get_access_to_vercel_url', 'get_edge_config_token', 'get_edge_config_tokens', 'get_sdk_key', 'get_project_env', 'get_shared_env_var']);

const asksToDecrypt = toolInput => toolInput != null && /^true$/i.test(String(toolInput.decrypt));

export function vercelToolNeedsApproval(toolName, toolInput) {
  if (typeof toolName !== 'string' || !/^mcp__.*vercel/i.test(toolName)) return false;
  const action = toolName.slice(toolName.lastIndexOf('__') + 2).toLowerCase();
  if (SENSITIVE_READS.has(action) || asksToDecrypt(toolInput)) return true;
  return !READ_PREFIXES.some(p => action.startsWith(p));
}

async function main() {
  const input = await readInput();
  if (vercelToolNeedsApproval(input?.tool_name, input?.tool_input)) {
    ask(`rfr-core (NODE-002): ${input.tool_name} can change or expose your Vercel account. Approve only if this action is intended.`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
