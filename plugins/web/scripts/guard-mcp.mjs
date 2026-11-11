#!/usr/bin/env node
// PreToolUse (Vercel MCP tools): ask before tools that deploy, change settings or
// environment variables, decrypt, delete, or purchase (rule NODE-002). Read-only tools
// pass through, except those that return credentials or decrypted environment variables,
// and filter_project_envs when it is asked to decrypt.
import { fileURLToPath } from 'node:url';
import { approve, ask, askReason, guardSettings, readInput } from './lib.mjs';
import { approval, mcpTask } from './task-approval.mjs';

const READ_PREFIXES = ['get_', 'list_', 'search_', 'read_', 'count_', 'aggregate_', 'filter_', 'status', 'web_fetch', 'artifact_query'];
// get_project_env and get_shared_env_var return decrypted values (Vercel's tool schemas:
// "get the decrypted value", "including its decrypted value").
const SENSITIVE_READS = new Set(['get_auth_token', 'get_project_token', 'get_access_to_vercel_url', 'get_edge_config_token', 'get_edge_config_tokens', 'get_sdk_key', 'get_project_env', 'get_shared_env_var']);

// A `decrypt` key anywhere in the input, in any letter case, counts unless its value is false or
// "false": an unexpected form (1, "yes", nested, or input sent as a JSON string) asks rather than passes.
function asksToDecrypt(toolInput, depth = 0) {
  if (typeof toolInput === 'string' && depth === 0) {
    try {
      return asksToDecrypt(JSON.parse(toolInput), 1);
    } catch {
      return /"decrypt"\s*:/i.test(toolInput);
    }
  }
  if (!toolInput || typeof toolInput !== 'object' || depth > 5) return false;
  return Object.entries(toolInput).some(([key, value]) => {
    if (key.toLowerCase() === 'decrypt') return !(value === false || /^\s*false\s*$/i.test(String(value)) || value == null);
    return value && typeof value === 'object' && asksToDecrypt(value, depth + 1);
  });
}

// Why a Vercel MCP call needs approval: 'secret' (it returns credentials or decrypted values),
// 'change' (anything that is not a known read), or null (a read that passes).
export function vercelApprovalReason(toolName, toolInput) {
  if (typeof toolName !== 'string' || !/^mcp__.*vercel/i.test(toolName)) return null;
  const action = toolName.slice(toolName.lastIndexOf('__') + 2).toLowerCase();
  if (SENSITIVE_READS.has(action) || asksToDecrypt(toolInput)) return 'secret';
  return READ_PREFIXES.some(p => action.startsWith(p)) ? null : 'change';
}

export const vercelToolNeedsApproval = (toolName, toolInput) => vercelApprovalReason(toolName, toolInput) !== null;

// The ask reason for a Vercel MCP call that needs approval, or null (guard tiers AC-3).
export function vercelAskReason(toolName, toolInput) {
  const kind = vercelApprovalReason(toolName, toolInput);
  if (kind === 'secret') return askReason({ source: 'rfr-web (NODE-002)', action: `${toolName} returns secret values (decrypted environment variables or tokens) into this session`, why: 'a secret read into the session cannot be unread, and it can reach logs and transcripts', instead: 'list the variables without their values (filter_project_envs without decrypt), or refer to the variable by name in code or configuration without reading its value' });
  if (kind === 'change') return askReason({ source: 'rfr-web (NODE-002)', action: `${toolName} can change or expose your Vercel account`, why: 'it acts on the live account, outside this project, and some changes cannot be undone', instead: 'describe the change in your report for a person to make, or use a read-only tool' });
  return null;
}

// The decision for a Vercel MCP call: { decision: 'ask', reason }, { decision: 'allow', reason } for a
// preview deployment the person's latest input asked for (docs/specs/task-approval.md), or null.
export function decideVercel(input, { settings, describePr } = {}) {
  const reason = vercelAskReason(input?.tool_name, input?.tool_input);
  if (!reason) return null;
  const cwd = input?.cwd ?? process.cwd();
  if (input?.transcript_path && (settings ?? guardSettings(cwd)).taskApproval !== 'off') {
    const approved = approval(mcpTask(input.tool_name, input.tool_input), { transcriptPath: input.transcript_path, cwd, ...(describePr ? { describePr } : {}) });
    if (approved) return { decision: 'allow', reason: approved.reason.replace('rfr-core', 'rfr-web') };
  }
  return { decision: 'ask', reason };
}

async function main() {
  const input = await readInput();
  const result = decideVercel(input);
  if (result?.decision === 'allow') approve(result.reason);
  else if (result) ask(result.reason);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
