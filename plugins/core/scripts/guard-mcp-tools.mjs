#!/usr/bin/env node
// PreToolUse (MCP tools): refuse the MCP calls on the never list (docs/specs/unattended.md): a tool
// that changes something through another service, and a GitHub tool that deletes, changes settings or
// access, or publishes a release. Nobody is asked; the reason says what to do instead. Reads, the
// GitHub tools for the agent's own work, and subscribing to a pull request (unattended AC-9) are not
// refused. Nor is making something in a service the project declares (unattended AC-10): "services"
// in .claude/rfr.json, as merged to the default branch. Vercel tools are rfr-web's guard to decide.
// This hook only refuses: whether Claude Code
// prompts for the rest is the session's permission mode. It is the refusal half of the default-allow
// hook that rewrite plan 25e removed.
import { fileURLToPath } from 'node:url';
import { isFreestyle } from './freestyle-lib.mjs';
import { ask, askReason, declaredServices, readInput } from './lib.mjs';

const MCP_TOOL = /^mcp__(.+?)__(.+)$/;
const GITHUB_SERVER = /(?:^|_)github(?:_|$)/i;
const GITHUB_HELD = /delete|remove|release|tag|setting|secret|collaborator|webhook|protection|ruleset|transfer|archive|visibility|create_repository|fork_repository|team|member|permission/i;
// An action that only reads has a read word anywhere in its name (microsoft_docs_search, recordings_list,
// capabilities_invoke_read, a bare search) and no word that changes something. A change word always
// wins, so capabilities_invoke_write and create_file stay refused. Until the MCP refusal audit of
// rewrite plan 25f, only a read verb at the start counted, which refused 45 tools that change nothing.
const READ_WORDS = /^(get|list|search|read|fetch|query|find|describe|discover|explore|show|view|count|aggregate|download|export|balance|estimates?|recommend|suggest|wait|display|ask|init|readiness|markdown|scanning)$/i;
const CHANGE_WORDS = /^(create|delete|remove|update|write|edit|set|add|send|share|trash|untrash|save|generate|post|put|patch|merge|approve|publish|upload|deploy|buy|purchase|move|copy|rename|archive|unarchive|invite|cancel|start|stop|fire|trigger|interrupt|switch|confirm|request|respond|label|unlabel|mark|unmark|apply|enable|disable|resolve|unresolve|fork|import|transfer|rollback|promote|pause|unpause|kill|rent|register|issue|revoke|activate|attach|assign|stage|restore|invalidate|record|exec|license|invoke_write)$/i;
// A name that starts with a read verb (get_trigger, list_events) was always a read, and still is.
const READ_PREFIX = /^(get|list|search|read|fetch|query|find|describe|show|view|count|aggregate)_/i;
export function onlyReads(action) {
  if (READ_PREFIX.test(action)) return true;
  const words = String(action).toLowerCase().split(/[_\-]+/).filter(Boolean);
  return words.some(w => READ_WORDS.test(w)) && !words.some(w => CHANGE_WORDS.test(w));
}

// Servers whose tools act on this machine only: a local test browser, a PDF viewer, and drawing
// canvases. A browser on a public site could submit a form; the maintainer accepted that (2026-11-13).
const LOCAL_SERVER = /(^|_)(playwright|pdf[-_]viewer|tldraw|draw_io)(_|$)/i;

// This session's own tools on claude-code-remote: reading another repository (add_repo for read, and
// marking its clone ready), a reminder back into this session, its own webhook, and the port of a server
// it runs. add_repo with push access mints credentials that can change the other repository.
const SESSION_TOOLS = /^(send_later|register_repo_root|report_preview_port|watch_url|unwatch_url|(un)?subscribe_pr_activity)$/;

// A project that makes content declares the services it makes it in (unattended AC-10). There, a tool
// that generates, creates, edits, or uploads is the work itself, and what it makes comes back into the
// project. What destroys, reaches other people, or buys something is still refused, declared or not.
// remove_background is an edit to a picture, not a removal.
const HELD_ON_DECLARED = /^(delete|remove|trash|share|publish|send|post|invite|buy|purchase|rent|license|transfer|deploy)$/i;
export const serviceName = server => String(server).replace(/^(plugin|claude_ai)_/, '').toLowerCase();
export function declaredAllows(server, action, services) {
  if (!services.includes(serviceName(server))) return false;
  const words = String(action).toLowerCase().replace(/remove_background/g, 'cutout').split(/[_\-]+/).filter(Boolean);
  return !words.some(w => HELD_ON_DECLARED.test(w));
}

// The refusal reason for an MCP call on the never list, or null. services is the project's declared
// services; left out, it is read from the project the call was made in.
export function mcpNever(input, services) {
  const tool = String(input?.tool_name ?? '');
  const mcp = MCP_TOOL.exec(tool);
  if (!mcp) return null;
  const [, server, action] = mcp;
  if (/^claude[-_]code[-_]remote$/i.test(server)) {
    if (SESSION_TOOLS.test(action)) return null;
    if (action === 'add_repo' && (input?.tool_input?.access ?? 'read') === 'read') return null;
  }
  if (onlyReads(action)) return null;
  if (LOCAL_SERVER.test(server)) return null;
  if (GITHUB_SERVER.test(server) && (!GITHUB_HELD.test(action) || action === 'run_secret_scanning')) return null;
  if (/vercel/i.test(server)) return null;
  const declared = services ?? declaredServices(input?.cwd || process.cwd());
  if (declaredAllows(server, action, declared)) return null;
  const name = server.replace(/^(plugin|claude_ai)_/, '');
  const instead = declared.includes(serviceName(server))
    ? 'say in your report what you would have done there'
    : `say in your report what you would have done there; if the project should make things in this service, propose it: add "${name}" to "services" in .claude/rfr.json in a pull request that says what it is for, and it counts once that has merged`;
  return askReason({ source: 'rfr-core (never list)', action: `${action.replace(/_/g, ' ')} through ${name.replace(/_/g, ' ')}`, why: 'it changes something outside the project, in another service', instead });
}

async function main() {
  const input = await readInput();
  // In a freestyle folder rfr does nothing (freestyle AC-2).
  if (isFreestyle(input?.cwd || process.cwd())) return;
  const reason = mcpNever(input);
  if (reason) ask(reason);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
