#!/usr/bin/env node
// PreToolUse: default allow (docs/specs/default-allow.md). rfr-core allows the agent's working tools
// (the shell, file edits, web search and fetch, and the GitHub MCP tools) so Claude Code does not
// prompt for ordinary work. The named asks still ask, because Claude Code lets another hook's ask or
// deny win over this allow on the same call (AC-3, checked on Claude Code 2.1.322 in
// evals/results/2026-11-12-hook-combination/): guard-commands, guard-test-edits, guard-owned-paths,
// rfr-process's merge guard, and rfr-web's Vercel guard decide those. A deny rule and Claude Code's
// protected paths still apply. "permissions": "ask" in .claude/rfr.json turns this off (AC-5).
// Nothing is logged for an allow, so the guard log keeps only the decisions a person sees.
import { fileURLToPath } from 'node:url';
import { guardSettings, readInput } from './lib.mjs';

const WORK_TOOLS = new Set(['Bash', 'PowerShell', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'WebSearch', 'WebFetch']);

// GitHub MCP tools stay with Claude Code's prompt when they delete, change repository settings or
// access, or publish a release: those are named asks with no guard of their own (AC-1, AC-2).
const GITHUB_TOOL = /^mcp__(?:.*_)?github(?:_[^_]*)?__(.+)$/i;
const GITHUB_HELD = /delete|remove|release|tag|setting|secret|collaborator|webhook|protection|ruleset|transfer|archive|visibility|create_repository|fork_repository|team|member|permission/i;

// Whether rfr-core allows this tool call by default. Returns the reason, or null.
export function defaultAllow(input, settings = guardSettings(input?.cwd ?? process.cwd())) {
  if (settings.permissions === 'ask') return null;
  const tool = String(input?.tool_name ?? '');
  if (WORK_TOOLS.has(tool)) return `rfr-core (default allow): ${tool} is one of the agent's working tools; the named asks still ask`;
  const github = GITHUB_TOOL.exec(tool);
  if (github && (/^(get|list|search|read)_/i.test(github[1]) || !GITHUB_HELD.test(github[1]))) return `rfr-core (default allow): ${github[1]} is a GitHub tool for the agent's own work; deletions, settings, and releases still ask`;
  return null;
}

async function main() {
  const input = await readInput();
  const reason = defaultAllow(input);
  if (!reason) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', permissionDecisionReason: reason } }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
