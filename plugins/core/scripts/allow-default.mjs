#!/usr/bin/env node
// PreToolUse: default allow (docs/specs/default-allow.md). rfr-core allows the agent's working tools
// (the shell, file edits, web search and fetch, the GitHub MCP tools, and any MCP tool that only
// reads) so Claude Code does not prompt for ordinary work. The guards' decisions still win, because
// Claude Code lets another hook's deny win over this allow on the same call (AC-3, checked on Claude
// Code 2.1.322 in evals/results/2026-11-12-hook-combination/). An MCP tool that changes something
// through another service, or a GitHub tool that deletes, changes settings or access, or publishes a
// release, is on the never list: it is refused with a reason the agent acts on, and nobody is asked
// (docs/specs/unattended.md). A deny rule and Claude Code's protected paths still apply.
// "permissions": "ask" in .claude/rfr.json turns this off (AC-5). Nothing is logged for an allow.
import { fileURLToPath } from 'node:url';
import { ask, askReason, guardSettings, readInput } from './lib.mjs';

const WORK_TOOLS = new Set(['Bash', 'PowerShell', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'WebSearch', 'WebFetch']);

const MCP_TOOL = /^mcp__(.+?)__(.+)$/;
const GITHUB_SERVER = /(?:^|_)github(?:_|$)/i;
const GITHUB_HELD = /delete|remove|release|tag|setting|secret|collaborator|webhook|protection|ruleset|transfer|archive|visibility|create_repository|fork_repository|team|member|permission/i;
// An action that only reads: get_, list_, search_, read_, fetch_, query_, find_, describe_, show_, view_.
const READS = /^(get|list|search|read|fetch|query|find|describe|show|view|count|aggregate)_/i;

// The default decision for a tool call: { decision: 'allow', reason }, { decision: 'chat', reason }
// for one that needs the person's decision, or null to leave it to the other guards and Claude Code.
export function defaultDecision(input, settings = guardSettings(input?.cwd ?? process.cwd())) {
  if (settings.permissions === 'ask') return null;
  const tool = String(input?.tool_name ?? '');
  if (WORK_TOOLS.has(tool)) return { decision: 'allow', reason: `rfr-core (default allow): ${tool} is one of the agent's working tools` };
  const mcp = MCP_TOOL.exec(tool);
  if (!mcp) return null;
  const [, server, action] = mcp;
  if (READS.test(action)) return { decision: 'allow', reason: `rfr-core (default allow): ${action} only reads` };
  if (GITHUB_SERVER.test(server) && !GITHUB_HELD.test(action)) return { decision: 'allow', reason: `rfr-core (default allow): ${action} is a GitHub tool for the agent's own work` };
  // Subscribing to a pull request changes nothing there: it arranges for this session to be told
  // when the pull request is reviewed or merged, which is how the merge of a feature packet starts
  // its delivery (unattended AC-9). The session tools that act for the person (starting sessions,
  // scheduling, changing an environment) are not in this list.
  if (/^claude[-_]code[-_]remote$/i.test(server) && /^(un)?subscribe_pr_activity$/.test(action)) return { decision: 'allow', reason: `rfr-core (default allow): ${action} only arranges for this session to be told about a pull request` };
  // Vercel tools are rfr-web's to decide, with their own reasons.
  if (/vercel/i.test(server)) return { decision: 'allow', reason: `rfr-core (default allow): rfr-web's guard decides ${action}` };
  return { decision: 'never', reason: askReason({ source: 'rfr-core (default allow)', action: `${action.replace(/_/g, ' ')} through ${server.replace(/^(plugin|claude_ai)_/, '').replace(/_/g, ' ')}`, why: 'it changes something outside the project, in another service', instead: 'say in your report what you would have done there' }) };
}

// Kept for callers that only need the allow reason.
export function defaultAllow(input, settings) {
  const d = defaultDecision(input, settings);
  return d?.decision === 'allow' ? d.reason : null;
}

async function main() {
  const input = await readInput();
  const d = defaultDecision(input);
  if (d?.decision === 'allow') process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', permissionDecisionReason: d.reason } }));
  else if (d?.decision === 'never') ask(d.reason);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
