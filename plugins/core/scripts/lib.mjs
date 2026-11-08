// Shared helpers for rfr-core hook scripts. Hooks receive JSON on stdin and, for
// PreToolUse, may print a JSON decision on stdout. See the Claude Code hooks reference.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';

let lastInput = {};

export async function readInput() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    lastInput = JSON.parse(raw || '{}') ?? {};
  } catch {
    lastInput = {};
  }
  return lastInput;
}

// Guard decision log: one JSON line per ask or deny, so prompts can be counted and calibrated
// (which guards ask, how often, and why). It records the hook, the tool, the decision, and the
// first 200 characters of the reason, never the command or file contents. The file is
// guard-decisions.jsonl in the plugin's data folder (CLAUDE_PLUGIN_DATA), or in rfr-core/ under the
// temp directory. RFR_GUARD_LOG=0 turns it off. A failure to write is ignored.
export const guardLogEnabled = () => process.env.RFR_GUARD_LOG !== '0';
export const guardDataDir = () => process.env.CLAUDE_PLUGIN_DATA || nodePath.join(os.tmpdir(), 'rfr-core');
export const pendingDir = () => nodePath.join(guardDataDir(), 'pending-asks');
// A tool_use_id as a file name: letters, digits, _ and - only.
export const safeId = id => String(id).replace(/[^\w-]/g, '_').slice(0, 120);

export function appendGuardLog(entry) {
  const dir = guardDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(nodePath.join(dir, 'guard-decisions.jsonl'), `${JSON.stringify(entry)}\n`);
}

function logDecision(decision, reason) {
  if (!guardLogEnabled()) return;
  try {
    const hook = nodePath.basename(process.argv[1] ?? '', '.mjs') || null;
    const entry = { time: new Date().toISOString(), session: lastInput.session_id ?? null, hook, tool: lastInput.tool_name ?? null, decision, reason: String(reason).slice(0, 200) };
    appendGuardLog(entry);
    // An ask leaves a pending record keyed by the tool call; guard-outcome turns it into an
    // `approved` line if the call then runs (guard-tiers AC-6). One record per guard, because two
    // guards can ask about the same call.
    if (decision === 'ask' && lastInput.tool_use_id) {
      fs.mkdirSync(pendingDir(), { recursive: true });
      fs.writeFileSync(nodePath.join(pendingDir(), `${safeId(lastInput.tool_use_id)}__${safeId(hook)}.json`), JSON.stringify({ hook, tool: entry.tool, reason: entry.reason }));
    }
  } catch {
    // Logging never blocks a decision.
  }
}

export function deny(reason) {
  logDecision('deny', reason);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
}

export function ask(reason) {
  logDecision('ask', reason);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  }));
}

// Whether a file existed where the current branch started: at the merge base of HEAD and the
// default branch (origin/HEAD, origin/main, origin/master, main, master, in that order). A test
// file added on the branch is new, as the CI test guard (test-change-guard) counts it, so
// editing it is not changing an existing test. Returns true, false, or null when git cannot tell
// (no repository, no default branch); callers treat null as "existed".
function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 5000 });
  return r.status === 0 ? r.stdout.trim() : null;
}

const bases = new Map();

// The repository a file is in, its merge base with the default branch, and its path there; null
// when git cannot tell.
function baseOf(file, cwd) {
  if (typeof file !== 'string' || !file) return null;
  // The repository the file is in, which for an agent's worktree is the worktree, not the project.
  const fileDir = nodePath.dirname(nodePath.resolve(cwd, file));
  const top = git(fs.existsSync(fileDir) ? fileDir : cwd, ['rev-parse', '--show-toplevel']);
  if (!top) return null;
  if (!bases.has(top)) {
    let base = null;
    for (const ref of ['origin/HEAD', 'origin/main', 'origin/master', 'main', 'master']) {
      if (git(top, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) === null) continue;
      base = git(top, ['merge-base', 'HEAD', ref]);
      if (base) break;
    }
    bases.set(top, base);
  }
  const base = bases.get(top);
  if (!base) return null;
  const rel = nodePath.relative(top, nodePath.resolve(cwd, file)).replace(/\\/g, '/');
  if (!rel || rel.startsWith('../') || nodePath.isAbsolute(rel)) return null;
  return { top, base, rel };
}

// The file's text where the current branch started, or null when it did not exist there or git
// cannot tell.
export function textAtBase(file, cwd = process.cwd()) {
  const b = baseOf(file, cwd);
  if (!b) return null;
  const r = spawnSync('git', ['show', `${b.base}:${b.rel}`], { cwd: b.top, encoding: 'utf8', timeout: 5000, maxBuffer: 1 << 26 });
  return r.status === 0 ? r.stdout : null;
}

export function existedAtBase(file, cwd = process.cwd()) {
  const b = baseOf(file, cwd);
  if (!b) return null;
  const { top, base, rel } = b;
  // ls-tree takes a pathspec, so a glob such as tests/*.test.ts matches any file it covers.
  const listed = git(top, ['ls-tree', '-r', '--name-only', base, '--', rel]);
  return listed === null ? null : listed.length > 0;
}
