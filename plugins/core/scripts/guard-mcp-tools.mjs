#!/usr/bin/env node
// PreToolUse (MCP tools): refuse the MCP calls on the never list (docs/specs/unattended.md): a tool
// that changes something through another service, and a GitHub tool that deletes, changes settings or
// access, or publishes a release. Nobody is asked; the reason says what to do instead. Reads, the
// GitHub tools for the agent's own work, and subscribing to a pull request (unattended AC-9) are not
// refused. Vercel tools are rfr-web's guard to decide. This hook only refuses: whether Claude Code
// prompts for the rest is the session's permission mode. It is the refusal half of the default-allow
// hook that rewrite plan 25e removed.
import { fileURLToPath } from 'node:url';
import { ask, askReason, readInput } from './lib.mjs';

const MCP_TOOL = /^mcp__(.+?)__(.+)$/;
const GITHUB_SERVER = /(?:^|_)github(?:_|$)/i;
const GITHUB_HELD = /delete|remove|release|tag|setting|secret|collaborator|webhook|protection|ruleset|transfer|archive|visibility|create_repository|fork_repository|team|member|permission/i;
// An action that only reads: get_, list_, search_, read_, fetch_, query_, find_, describe_, show_, view_.
const READS = /^(get|list|search|read|fetch|query|find|describe|show|view|count|aggregate)_/i;

// The refusal reason for an MCP call on the never list, or null.
export function mcpNever(input) {
  const tool = String(input?.tool_name ?? '');
  const mcp = MCP_TOOL.exec(tool);
  if (!mcp) return null;
  const [, server, action] = mcp;
  if (READS.test(action)) return null;
  if (GITHUB_SERVER.test(server) && !GITHUB_HELD.test(action)) return null;
  if (/^claude[-_]code[-_]remote$/i.test(server) && /^(un)?subscribe_pr_activity$/.test(action)) return null;
  if (/vercel/i.test(server)) return null;
  return askReason({ source: 'rfr-core (never list)', action: `${action.replace(/_/g, ' ')} through ${server.replace(/^(plugin|claude_ai)_/, '').replace(/_/g, ' ')}`, why: 'it changes something outside the project, in another service', instead: 'say in your report what you would have done there' });
}

async function main() {
  const input = await readInput();
  const reason = mcpNever(input);
  if (reason) ask(reason);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
