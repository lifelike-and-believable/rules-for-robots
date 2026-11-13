#!/usr/bin/env node
// PreToolUse (Bash, PowerShell): refuse the web stack's command-line actions that reach past the
// project: database commands that apply schema changes without a reviewed migration (PG-001), and
// Vercel CLI calls that deploy to production, change the live account, delete on it, or pull its
// secrets (NODE-002, WA-003, SEC-001). Moved from rfr-core's guard-commands in rewrite plan 25e
// (verify inventory slice f2), with the same patterns and the same reading of a command line: wrappers
// (bash -c, $(...)), Windows executable names, package runners, and Vercel's global options.
// "ask" is a refusal the agent acts on, with no prompt.
import { fileURLToPath } from 'node:url';
import { ask, askReason, readInput } from './lib.mjs';
import { commandWords, commandsWithDirs, executedText, innerScripts, runnerTarget } from './command-words.mjs';

// [pattern, action, rule, why, instead], matched against what the command line runs.
const DATABASE = [
  [/\bdrizzle-kit\s+push\b/, 'drizzle-kit push applies schema changes directly to a database', 'PG-001', 'it changes a database outside the repository, and data it drops has no snapshot', "generate a migration and apply it through the project's reviewed migration step"],
  [/\bdrizzle-kit\b[^;&|]*\s--force\b/, 'drizzle-kit --force accepts data-loss statements', 'PG-001', 'it applies statements that drop data, without review', 'run it without --force and report the statements it wants to run'],
  [/\bprisma\s+migrate\s+(dev|reset)\b/, 'prisma migrate dev/reset can reset or alter a database', 'PG-001', 'it can reset a database outside the repository, losing its data', 'create the migration with --create-only and report it for review, or run it against a disposable database'],
  [/\bprisma\s+db\s+(push|migrate)\b/, 'prisma db push/migrate applies changes, including destructive ones, without review', 'PG-001', 'it changes a database outside the repository, and data it drops has no snapshot', 'create a reviewed migration instead'],
];

const PROD_DEPLOY = { rule: 'NODE-002', action: 'a production deploy, promotion, alias, or domain change', why: 'it changes what users of the live site see', instead: 'deploy a preview and report its URL' };
const REMOTE_DELETE = { rule: 'WA-003', action: 'deleting a deployment, project, DNS record, or certificate on Vercel', why: 'it removes what the live site depends on, outside the project folder', instead: 'leave it in place and report what you would delete' };
const READ_SECRET = { rule: 'SEC-001', action: 'reading secret values into the session (vercel env pull, or vercel pull for production)', why: 'a secret read into the session cannot be unread, and it can reach logs, transcripts, and pull requests', instead: 'refer to the variable by name, or read the .env.example file that lists the names' };

// The words of a Vercel CLI call from its subcommand on, with the global options before it removed.
const VERCEL_VALUE_FLAGS = /^(--scope|-S|--token|-t|--cwd|--team|-T|--local-config|-A|--global-config|-Q)$/;
function vercelArgs(words) {
  const rest = words.slice(1);
  const out = [];
  let sub = false;
  for (let k = 0; k < rest.length; k++) {
    if (!sub && VERCEL_VALUE_FLAGS.test(rest[k])) { k++; continue; }
    if (!sub && /^--(scope|token|cwd|team|local-config|global-config)=/.test(rest[k])) continue;
    if (!sub && !rest[k].startsWith('-')) sub = true;
    out.push(rest[k]);
  }
  return out;
}

// The Vercel action one simple command takes, or null.
function vercelRisk(words) {
  if (words[0] !== 'vercel') return null;
  const rest = vercelArgs(words);
  // vercel env pull and vercel pull --environment production write the variables' values to a file.
  if ((/^env$/i.test(rest[0] ?? '') && /^pull$/i.test(rest[1] ?? '')) || (/^pull$/i.test(rest[0] ?? '') && rest.some((w, k) => /^--environment=prod/i.test(w) || (w === '--environment' && /^prod/i.test(rest[k + 1] ?? ''))))) return READ_SECRET;
  if (/^(dns|certs|cert)$/i.test(rest[0] ?? '') && /^(rm|remove|add|issue)$/i.test(rest[1] ?? '')) return REMOTE_DELETE;
  // Removing a deployment or project, or changing its environment variables, changes the live
  // account; a redeploy keeps the original's target unless it says preview.
  if (/^(remove|rm)$/i.test(rest[0] ?? '') || (/^(project|projects)$/i.test(rest[0] ?? '') && /^(rm|remove)$/i.test(rest[1] ?? ''))) return REMOTE_DELETE;
  if (/^env$/i.test(rest[0] ?? '') && /^(add|rm|remove|update)$/i.test(rest[1] ?? '')) return PROD_DEPLOY;
  if (/^redeploy$/i.test(rest[0] ?? '') && !rest.some((w, k) => /^--target=preview$/i.test(w) || (w === '--target' && /^preview$/i.test(rest[k + 1] ?? '')))) return PROD_DEPLOY;
  if (rest.some(w => /^(--prod(=(?!false\b)\S*)?|--production|--target=prod(uction)?)$/i.test(w)) || /^(promote|alias|aliases|domains|rollback)$/i.test(rest[0] ?? '') || rest.some((w, k) => w === '--target' && /^prod/i.test(rest[k + 1] ?? ''))) return PROD_DEPLOY;
  return null;
}

// The Vercel action a command line takes, reading each simple command, the scripts a shell or a
// substitution runs inside it, and the command a package runner runs.
function vercelInLine(command, cwd, depth = 0) {
  for (const { words: raw, dir } of commandsWithDirs(command, cwd) ?? []) {
    let words = commandWords(raw);
    if (depth < 3) {
      for (const inner of innerScripts(words)) {
        const found = vercelInLine(inner, dir, depth + 1);
        if (found) return found;
      }
    }
    words = runnerTarget(words);
    const risk = vercelRisk(words);
    if (risk) return risk;
  }
  return null;
}

// The hook's decision: { decision: 'ask', reason } (a refusal) or null to let the command run.
export function decideWebCommand(command, { cwd = process.cwd() } = {}) {
  if (typeof command !== 'string') return null;
  const asking = r => ({ decision: 'ask', reason: askReason({ source: `rfr-web (${r.rule})`, action: r.action, why: r.why, instead: r.instead }) });
  const text = executedText(command) ?? command;
  for (const [pattern, action, rule, why, instead] of DATABASE) {
    if (pattern.test(text)) return asking({ rule, action, why, instead });
  }
  const risk = vercelInLine(command, cwd);
  return risk ? asking(risk) : null;
}

async function main() {
  const input = await readInput();
  const result = decideWebCommand(input?.tool_input?.command, { cwd: input?.cwd ?? process.cwd() });
  if (result) ask(result.reason);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
