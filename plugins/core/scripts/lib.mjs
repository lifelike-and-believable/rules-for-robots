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

// The reason for refusing an action on the never list (docs/specs/unattended.md, AC-2): nobody is
// asked, during the run or in chat. The agent does it another way, or sets that part aside for the
// person to decide at review.
export const neverReason = reason => `${reason} Claude does not do this here, and nobody will be asked during the run. Do it another way, or, if the task cannot be done without it, set that part aside, record what it needs and why in the pull request's ## Decisions section, and carry on with the rest; the person decides it at review.`;

// An action the guards would once have asked about. The run is unattended (docs/specs/unattended.md,
// AC-1): it is refused with a reason the agent acts on, never a permission prompt. A project with
// "permissions": "ask" gets the prompt, as before.
export function ask(reason) {
  if (guardSettings(lastInput.cwd ?? process.cwd()).permissions !== 'ask') {
    logDecision('never', reason);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: neverReason(reason),
      },
    }));
    return;
  }
  logDecision('ask', reason);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  }));
}

// A command the person approved by asking for its task (docs/specs/task-approval.md, AC-4): allowed
// without a prompt, with the reason quoting their words, and logged as approved-by-instruction.
export function approve(reason) {
  logDecision('approved-by-instruction', reason);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: reason,
    },
  }));
}

// Context for the agent on a call the guard allows (tier 1 with a way back, such as the command that
// restores what an rm -rf removes): no permission decision, so Claude Code's own rules still apply.
export function inform(context) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: context,
    },
  }));
}

// The reason for an ask (guard tiers AC-3): the action, why a person must decide (it cannot be
// undone, or it reaches outside the project), and what the agent can do if the person says no.
const sentence = text => text.charAt(0).toUpperCase() + text.slice(1);
export const askReason = ({ source, action, why, instead }) => `${source}: ${action}. ${sentence(why)}. If not approved: ${instead}.`;

// The reason for a refusal the agent acts on (tier 2), or one deferred to the pull request (tier 3):
// what was refused, and the next step.
export const refuseReason = ({ source, action, next }) => `${source}: ${action}. ${next}.`;

// Project settings for the guards, from .claude/rfr.json at the repository root (guard tiers AC-5).
// testWeakening: 'ask' (a person decides now) or 'defer' (the change goes ahead, the agent names it
// in its report, and the pull request's test-change review decides). The default is 'defer' since
// test-change-review AC-11 passed (2026-11-11: no gaming change approved in 36 runs); a project that
// wants to be asked sets 'ask'.
export const DEFAULT_TEST_WEAKENING = 'defer';

// taskApproval: 'on' (the default) or 'off' (task-approval AC-6).
// permissions: 'default-allow' (the default: rfr-core allows the agent's working tools and asks only
// for the named asks) or 'ask' (Claude Code's own settings decide, as before; default-allow AC-5).
export function guardSettings(cwd = process.cwd()) {
  const settings = { testWeakening: DEFAULT_TEST_WEAKENING, taskApproval: 'on', permissions: 'default-allow' };
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', timeout: 5000 });
  const root = r.status === 0 ? r.stdout.trim() : (process.env.CLAUDE_PROJECT_DIR ?? cwd);
  try {
    const json = JSON.parse(fs.readFileSync(nodePath.join(root, '.claude', 'rfr.json'), 'utf8'));
    if (json?.testWeakening === 'ask' || json?.testWeakening === 'defer') settings.testWeakening = json.testWeakening;
    if (json?.taskApproval === 'off') settings.taskApproval = 'off';
    if (json?.permissions === 'ask') settings.permissions = 'ask';
  } catch {
    // No settings file, or one that cannot be read: the defaults hold.
  }
  // RFR_PERMISSIONS=ask for one session or run, as a project's setting would.
  if (process.env.RFR_PERMISSIONS === 'ask') settings.permissions = 'ask';
  return settings;
}

// The context for a test change when the project defers test weakening to the pull request (guard
// tiers AC-5, amended 2026-11-09): the change goes ahead, because git holds the old test and nothing
// merges until the pull request's test change check passes.
export const deferredTestContext = action => refuseReason({
  source: 'rfr-core (TEST-001)',
  action: `${action}, and this project defers test weakening to the pull request (testWeakening: defer), so the change goes ahead`,
  next: 'Make it only if an approved behaviour change or spec criterion calls for it, never to get a failing test to pass (WA-002). Say so in your report: which test, what changed, and why; the pull request decides, with the test-change review, and its test change check stays red until then',
});

// A test change deferred to the pull request (tier 3): no permission decision, so nobody is asked
// and Claude Code's own rules still apply; the agent gets the context, and the log records the deferral.
export function defer(context) {
  logDecision('defer', context);
  inform(context);
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

// A path in its real, long form, as git reports it: symlinks resolved (macOS's /tmp is /private/tmp)
// and, on Windows, 8.3 short names expanded (C:\Users\RUNNER~1 is C:\Users\runneradmin). The part of
// the path that does not exist yet is kept as written. Compare a path with git's toplevel only in
// this form, or path.relative climbs out of the repository (guard tiers AC-13).
export function canonical(p) {
  const abs = nodePath.resolve(p);
  const rest = [];
  let head = abs;
  while (!fs.existsSync(head)) {
    const parent = nodePath.dirname(head);
    if (parent === head) return abs;
    rest.unshift(nodePath.basename(head));
    head = parent;
  }
  try {
    return nodePath.join(fs.realpathSync.native(head), ...rest);
  } catch {
    return abs;
  }
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
  const rel = nodePath.relative(canonical(top), canonical(nodePath.resolve(cwd, file))).replace(/\\/g, '/');
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
