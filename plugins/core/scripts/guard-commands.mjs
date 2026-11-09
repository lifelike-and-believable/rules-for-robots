#!/usr/bin/env node
// PreToolUse (Bash, PowerShell): ask the user before destructive git, file, and database commands
// (rules WA-003 and, for databases, the node-services pack). Asking keeps the user in
// control without blocking legitimate use; headless runs treat "ask" as a denial. The Unreal
// editor -ExecCmds check moved to rfr-unreal's guard-unreal (docs/specs/plugin-split.md, AC-2).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appendGuardLog, ask, askReason, defer, deferredTestContext, deny, existedAtBase, guardLogEnabled, guardSettings, inform, readInput, refuseReason } from './lib.mjs';
import { pruneSnapshots, snapshotStashes, snapshotTree } from './snapshot.mjs';
import { isTestPath } from './guard-test-edits.mjs';
import { parseCommand, writeTargetEntries } from './shell-writes.mjs';

// [pattern, action, kind, rule, why, instead]: why a person must decide, and what the agent can do
// if the person says no (guard tiers AC-3).
const LOCAL_LOSS = 'the uncommitted work it removes is in no commit, so git cannot bring it back';
const CHECKS = [
  [/\bgit\s+reset\b[^;&|]*--hard/, 'git reset --hard discards uncommitted work', 'discard', 'WA-003', LOCAL_LOSS, 'commit or stash the changes first (git stash push -u), then run it'],
  [/\bgit\s+clean\b[^;&|]*\s-[a-zA-Z]*f/, 'git clean -f deletes untracked files', 'discard', 'WA-003', 'untracked files are in no commit, so git cannot bring them back', 'list them with git clean -n and delete only the files you made, or move them aside'],
  [/\bgit\s+push\b[^;&|]*(\s--force\b|\s--force-with-lease\b|\s-[a-zA-Z]*f\b|\s\+\S)/, 'force-push rewrites remote history', null, 'WA-003', 'it replaces history on the remote that others may already have pulled', 'push to a new branch, or bring the remote changes in and push normally'],
  [/\bgit\s+branch\b[^;&|]*\s-D\b/, 'force-deleting a branch', null, 'WA-003', 'commits only on that branch then survive only in the reflog', 'use git branch -d, which refuses to delete unmerged work'],
  [/\bgit\s+stash\s+(drop|clear)\b/, 'dropping stashed work', 'stash', 'WA-003', 'a dropped stash is hard to find again', 'apply the stash, or leave it in place'],
  [/\bgit\s+(filter-branch|filter-repo)\b/, 'rewriting repository history', null, 'WA-003', 'it rewrites every commit, and pushing the result replaces shared history', 'stop and report what you want removed from history'],
  [/\bgit\b[^;&|]*\s--no-verify\b/, 'skipping commit or push hooks (--no-verify)', null, 'WA-003', 'it skips the checks the project set for every commit and push', 'run the hooks and fix what they report'],
  [/\bgit\s+config\b(?![^;&|\n]*\s(--get\S*|--list|-l)\b)[^;&|\n]*\s--(global|system)\b/, 'changing machine-wide git configuration', null, 'WA-003', 'it changes git for every repository on this machine, outside the project', 'pass the setting for one command with git -c instead'],
  [/\bdrizzle-kit\s+push\b/, 'drizzle-kit push applies schema changes directly to a database', null, 'PG-001', 'it changes a database outside the repository, and data it drops has no snapshot', "generate a migration and apply it through the project's reviewed migration step"],
  [/\bdrizzle-kit\b[^;&|]*\s--force\b/, 'drizzle-kit --force accepts data-loss statements', null, 'PG-001', 'it applies statements that drop data, without review', 'run it without --force and report the statements it wants to run'],
  [/\bprisma\s+migrate\s+(dev|reset)\b/, 'prisma migrate dev/reset can reset or alter a database', null, 'PG-001', 'it can reset a database outside the repository, losing its data', 'create the migration with --create-only and report it for review, or run it against a disposable database'],
  [/\bprisma\s+db\s+(push|migrate)\b/, 'prisma db push/migrate applies changes, including destructive ones, without review', null, 'PG-001', 'it changes a database outside the repository, and data it drops has no snapshot', 'create a reviewed migration instead'],
];

// rm with both recursive and force flags, in any order or form (-rf, -r -f, --recursive --force).
function isForcedRecursiveRm(command) {
  for (const segment of command.split(/&&|\|\||;|\||\n/)) {
    const words = segment.trim().split(/\s+/);
    const at = words.findIndex(w => w === 'rm' || w.endsWith('/rm'));
    if (at === -1 || words.slice(0, at).some(w => !/^(sudo|command|env|\w+=\S*)$/.test(w))) continue;
    const flags = words.slice(at + 1).filter(w => w.startsWith('-'));
    const recursive = flags.some(f => f === '--recursive' || (/^-[a-zA-Z]+$/.test(f) && /[rR]/.test(f)));
    const force = flags.some(f => f === '--force' || (/^-[a-zA-Z]+$/.test(f) && f.includes('f')));
    if (recursive && force) return true;
  }
  return false;
}

// PowerShell's Remove-Item (or an alias) with both -Recurse and -Force, in any order, as
// any unambiguous prefix (-r, -Rec; -fo, -Force) or with :$true. A bare -f is ambiguous
// in PowerShell (Filter or Force) and fails to bind, so it does not count.
const REMOVE_ITEM = new Set(['remove-item', 'rm', 'del', 'erase', 'rd', 'ri', 'rmdir']);
const PS_RECURSE = /^-r(e(c(u(r(s(e)?)?)?)?)?)?(:\$true)?$/i;
const PS_FORCE = /^-fo(r(c(e)?)?)?(:\$true)?$/i;

function isForcedRecursiveRemoveItem(command) {
  for (const segment of command.split(/&&|\|\||;|\||\n/)) {
    const words = segment.trim().split(/\s+/);
    if (!REMOVE_ITEM.has(words[0]?.toLowerCase())) continue;
    if (words.some(w => PS_RECURSE.test(w)) && words.some(w => PS_FORCE.test(w))) return true;
  }
  return false;
}

// A shell command that writes to, moves, or deletes a test file: redirection, in-place
// editors, scripts that open files for writing, and file moves (TEST-001). Edits through
// the Edit and Write tools are handled by guard-test-edits.
// Paths may use / or \ (PowerShell). Unreal test modules (Source/<Name>Tests/) and
// Unreal test files (*Tests.cpp, *Test.cpp, *Spec.cpp under Source/) count too (#37).
const TEST_PATH = new RegExp([
  /\.(test|spec)\.\w+/.source,
  /(^|[\s/\\'"=])(test|tests|Tests|__tests__|__snapshots__|e2e)[/\\][\w./\\-]+\.\w+/.source,
  /(^|[\s/\\'"=])Source[/\\]\w+Tests[/\\]/.source,
  /(^|[\s/\\'"=])Source[/\\][\w./\\-]*\w(Tests?|Spec)\.(cpp|h)\b/.source,
].join('|'));
const WRITES = /(>>?|\btee\b|\bsed\s+(-[a-zA-Z]*i|--in-place)|\bperl\s+-[a-zA-Z]*i|\bmv\b|\bcp\b|\brm\b|\btruncate\b|open\([^)]*['"][wa]['"]|writeFile|write_text|\.write\()/;
// PowerShell cmdlets that write, move, or delete files (anywhere in the command), their
// common aliases (only as the command word, so prose such as "move" in a commit message
// does not count), and New-Item only with -Force, which overwrites an existing file.
const PS_CMDLETS = /\b(Set-Content|Add-Content|Out-File|Move-Item|Copy-Item|Remove-Item|Rename-Item|Clear-Content)\b/i;
const PS_ALIASES = /(^|[;&|(]|\n)\s*(sc|ac|mi|move|cpi|copy|ri|del|erase|rni|ren|clc)\s/i;
const PS_NEW_ITEM_FORCE = /\bNew-Item\b[^;&|\n]*\s-fo(r(c(e)?)?)?\b/i;
const psWrites = command => PS_CMDLETS.test(command) || PS_ALIASES.test(command) || PS_NEW_ITEM_FORCE.test(command);

// Redirects that only join or discard streams (2>&1, >/dev/null, &>/dev/null) write no file.
const STREAM_REDIRECTS = /\d*>&\d+|&>>?\s*\/dev\/null|\d*>>?\s*\/dev\/null/g;

// The broad check: a test path anywhere in the command, and a write anywhere in it. Used for
// PowerShell, for Windows paths, and when the command cannot be read as a shell command.
function broadWritesTestFile(command) {
  const stripped = command.replace(STREAM_REDIRECTS, ' ');
  return TEST_PATH.test(stripped) && (WRITES.test(stripped) || psWrites(stripped));
}

// A test path in a write target: a file or glob guard-test-edits counts as a test, or a test
// directory (tests, e2e) that find or xargs works through.
const isTestTarget = target => {
  const p = target.replace(/\\/g, '/').replace(/^\.\//, '');
  return isTestPath(p) || isTestPath(`${p.replace(/\/$/, '')}/x`) || /(^|\/)e2e\//.test(p) || TEST_PATH.test(` ${p}`);
};

// How the command changes existing test files: 'remove' when it deletes or moves one, 'write' when
// it only writes to one, 'broad' when it cannot be read and a test path and a write appear in it,
// or null. existed(path) says whether a path existed where the branch started (see existedAtBase);
// a test file added on the branch is new, as the CI test guard counts it. Without it, every test
// path counts as existing.
export function testFileChange(command, existed = () => true) {
  if (psWrites(command) && broadWritesTestFile(command)) return 'broad';
  // Windows paths (Source\\X\\Tests\\Y.cpp) are not shell words: use the broad check.
  if ([...command.matchAll(/[\w.:-]+(?:\\[\w.-]+)+/g)].some(m => TEST_PATH.test(` ${m[0].replace(/\\/g, '/')}`))) return broadWritesTestFile(command) ? 'broad' : null;
  const entries = writeTargetEntries(command);
  if (entries === null) return broadWritesTestFile(command) ? 'broad' : null;
  const hits = entries.filter(e => isTestTarget(e.path) && existed(e.path) !== false);
  if (hits.some(e => e.op !== 'write')) return 'remove';
  return hits.length ? 'write' : null;
}

export function writesTestFile(command, existed) {
  return testFileChange(command, existed) !== null;
}

// Snapshot updates rewrite expected values (TEST-001): vitest and jest -u, playwright --update-snapshots.
const UPDATE_FLAGS = /^(-u|--update|--updateSnapshot|--update-snapshots(=\S+)?)$/;
export function updatesSnapshots(command) {
  const commands = parseCommand(command) ?? [];
  return commands.some(({ words }) => {
    const runner = words.some(w => /(^|\/)(vitest|jest|playwright)$/.test(w)) || (/(^|\/)(npm|pnpm|yarn|bun)$/.test(words[0] ?? '') && /^(test|t)$/.test(words[1] ?? ''));
    return runner && words.some(w => UPDATE_FLAGS.test(w));
  });
}

// git checkout or git restore of the whole tree discards uncommitted changes; git restore --staged
// without --worktree only unstages them, and loses nothing.
export function discardsWorkingTree(command) {
  for (const { words } of parseCommand(command) ?? []) {
    const g = words.indexOf('git');
    if (g === -1) continue;
    const sub = words[g + 1];
    if (sub !== 'checkout' && sub !== 'restore') continue;
    const rest = words.slice(g + 2);
    if (!rest.some(w => w === '.' || w === './')) continue;
    if (sub === 'checkout') return true;
    const short = rest.filter(w => /^-[a-zA-Z]+$/.test(w)).join('');
    const staged = rest.includes('--staged') || short.includes('S');
    const worktree = rest.includes('--worktree') || short.includes('W');
    if (!staged || worktree) return true;
  }
  return false;
}

// The hook's decision: { decision: 'deny' | 'ask', reason } or null to let the command run.
// A shell write to an existing test is refused with a pointer to the Edit tool, whose input shows
// the change so guard-test-edits can check it (test-change-review AC-6); deleting or moving an
// existing test, a command the hook cannot read, and snapshot updates still ask.
// Whether a path the command names is an existing test of this project: inside the project, on
// disk (a glob is taken to match something), and not added on the current branch.
export function existingProjectFile(file, cwd, root = process.env.CLAUDE_PROJECT_DIR ?? cwd) {
  const abs = path.resolve(cwd, file);
  const rel = path.relative(path.resolve(root), abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  if (!/[*?[{]/.test(file) && !fs.existsSync(abs)) return false;
  return existedAtBase(file, cwd);
}

// Snapshot updates rewrite expected values; the agent may run one only when it states why in the
// command, so the reason reaches the log and its report (guard tiers AC-4).
const SNAPSHOT_REASON = /(^|[\s;&|(])RFR_SNAPSHOT_REASON=(?:"[^"]+"|'[^']+'|[^\s"';&|]+)/;

// The decision for a shell command: null to allow, { decision: 'inform', reason } to allow with
// context for the agent, { decision: 'defer', reason } to allow a test removal for the pull request
// to judge, { decision: 'deny', reason } for the agent to act on, or
// { decision: 'ask', reason } for a person (docs/specs/guard-tiers.md).
export function decideCommand(command, { cwd, settings, snapshot = takeSnapshots } = {}) {
  if (typeof command !== 'string') return null;
  const existed = cwd ? file => existingProjectFile(file, cwd) : undefined;
  const change = testFileChange(command, existed);
  if (change === 'write') {
    return { decision: 'deny', reason: refuseReason({ source: 'rfr-core (TEST-001)', action: 'this command writes to an existing test file, so the change cannot be checked', next: 'Make the change with the Edit tool instead (one Edit per change, or MultiEdit for several in one file), so the test-change check can see it; additive and neutral changes then go through without asking' }) };
  }
  // With testWeakening: defer, removing a test goes ahead with context (tier 3), but the rest of the
  // command is still checked: a deferral never lets through something that would otherwise ask.
  let deferred = null;
  if (change === 'remove' || change === 'broad') {
    const action = change === 'remove' ? 'this command deletes or moves an existing test file' : 'this command appears to change an existing test file outside the Edit tool';
    if ((settings ?? guardSettings(cwd)).testWeakening !== 'defer') {
      return { decision: 'ask', reason: askReason({ source: 'rfr-core (TEST-001)', action, why: 'a person decides whether a test is wrong, because the agent that wants it gone is the one it checks', instead: 'leave the test in place and report why you think it should change' }) };
    }
    deferred = deferredTestContext(action);
  }
  if (updatesSnapshots(command) && !SNAPSHOT_REASON.test(command)) {
    return { decision: 'deny', reason: refuseReason({ source: 'rfr-core (TEST-001)', action: 'this command updates test snapshots, which rewrites their expected values', next: 'If the output changed on purpose, run it again with the reason in the command, for example RFR_SNAPSHOT_REASON="the header now shows the plan name" npx vitest -u, and give the same reason in your report; otherwise leave the snapshots and report which ones fail' }) };
  }
  const hints = [];
  const snaps = [];
  const asking = r => ({ decision: 'ask', reason: askReason({ source: `rfr-core (${r.rule})`, action: r.action, why: r.why, instead: r.instead }) });
  const risk = findOtherRisk(command, cwd, hints, snaps);
  if (risk) return asking(risk);
  const notes = [];
  let snapshots = [];
  if (snaps.length) {
    const taken = snapshot(snaps, command);
    // No snapshot, no way back: a person decides, and the reason says the snapshot failed.
    if (taken.failed) return asking({ ...taken.failed, why: `${taken.failed.why}, and the guard could not take a snapshot first` });
    snapshots = taken.refs;
    notes.push(`the guard took a snapshot of what this command removes; to undo it: ${taken.lines.join('; ')}`);
  }
  if (hints.length) notes.push(`the files this command deletes are committed with no changes, so git can restore them: ${hints.join('; ')}`);
  const noted = notes.length ? `rfr-core (WA-003): ${notes.join('. ')}.` : null;
  if (deferred) return { decision: 'defer', reason: noted ? `${deferred} ${noted}` : deferred, snapshots };
  if (noted) return { decision: 'inform', reason: noted, snapshots };
  return null;
}

// The simple commands of a command line, each with the folder it runs in: the starting folder,
// changed by any cd (or pushd) before it, and by git -C. null when the line cannot be read.
export function commandsWithDirs(command, cwd) {
  const commands = parseCommand(command);
  if (!commands) return null;
  let dir = cwd;
  return commands.map(({ words }) => {
    if ((words[0] === 'cd' || words[0] === 'pushd') && words[1] && !words[1].startsWith('-')) dir = path.resolve(dir, words[1].replace(/^~(?=\/|$)/, os.homedir()));
    return { words, dir };
  });
}

const git = (dir, args) => {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', timeout: 5000 });
  return r.error ? { status: -1, out: '' } : { status: r.status, out: r.stdout ?? '' };
};

// A worktree Claude Code made for an agent (isolation: worktree) lives under .claude/worktrees/;
// discarding changes there touches only that agent's checkout.
export const inAgentWorktree = dir => path.resolve(dir).split(path.sep).join('/').includes('/.claude/worktrees/');

// Commands that discard uncommitted work (checkout or restore of the whole tree, reset --hard,
// clean -f), asked about only when there is something to lose in the folder they run in.
function discardRisk(entries, snaps) {
  for (const { words, dir } of entries) {
    const g = words.indexOf('git');
    if (g === -1) continue;
    let k = g + 1;
    let where = dir;
    while (words[k]?.startsWith('-')) {
      if (words[k] === '-C' && words[k + 1]) { where = path.resolve(where, words[k + 1]); k += 2; } else k += words[k] === '-c' ? 2 : 1;
    }
    const sub = words[k];
    const rest = words.slice(k + 1);
    const short = rest.filter(w => /^-[a-zA-Z]+$/.test(w)).join('');
    let kind = null;
    if ((sub === 'checkout' || sub === 'restore') && rest.some(w => w === '.' || w === './')) {
      const staged = sub === 'restore' && (rest.includes('--staged') || short.includes('S'));
      const worktree = rest.includes('--worktree') || short.includes('W');
      if (!staged || worktree) kind = 'worktree';
    } else if (sub === 'reset' && rest.includes('--hard')) {
      const target = rest.find(w => !w.startsWith('-'));
      if (target && target !== 'HEAD' && !inAgentWorktree(where)) {
        // The snapshot's parent is the commit HEAD points at now, so it keeps both the commits the
        // reset leaves behind and the uncommitted work (guard tiers AC-11).
        snaps.push({ kind: 'tree', dir: where, path: '.', moves: true, risk: { rule: 'WA-003', action: 'git reset --hard to another commit can drop commits as well as uncommitted work', why: 'the commits it leaves behind survive only in the reflog, and uncommitted work is lost', instead: 'commit or stash first; to undo commits on a shared branch, use git revert' } });
        continue;
      }
      kind = 'index';
    } else if (sub === 'clean' && (rest.includes('--force') || /f/.test(short))) {
      kind = /x/.test(short) ? 'untracked-all' : /X/.test(short) ? 'ignored' : 'untracked';
    }
    if (!kind || inAgentWorktree(where)) continue;
    const check = {
      worktree: () => git(where, ['diff', '--quiet']).status !== 0,
      index: () => git(where, ['diff', '--quiet', 'HEAD']).status !== 0,
      untracked: () => { const r = git(where, ['ls-files', '--others', '--exclude-standard']); return r.status !== 0 || r.out.trim() !== ''; },
      'untracked-all': () => { const r = git(where, ['ls-files', '--others']); return r.status !== 0 || r.out.trim() !== ''; },
      ignored: () => { const r = git(where, ['ls-files', '--others', '--ignored', '--exclude-standard']); return r.status !== 0 || r.out.trim() !== ''; },
    }[kind];
    if (check()) {
      // Something would be lost: a snapshot first makes it undoable (guard tiers AC-11). Ignored
      // files that git clean -x or -X deletes are build output, as for rm -rf, and are not kept.
      const risk = kind.startsWith('untracked') || kind === 'ignored'
        ? { rule: 'WA-003', action: 'git clean -f deletes untracked files', why: 'untracked files are in no commit, so git cannot bring them back', instead: 'list them with git clean -n and delete only the files you made, or move them aside' }
        : { rule: 'WA-003', action: 'discarding all working-tree changes', why: 'the uncommitted work it removes is in no commit, so git cannot bring it back', instead: 'commit or stash the changes first (git stash push -u), then run it' };
      snaps.push({ kind: 'tree', dir: where, path: '.', risk });
    }
  }
  return null;
}

// Folders that hold only throwaway files: the system temp directory (where session scratchpads and
// test fixtures live) and TMPDIR. A target at least two levels inside one (inside a folder someone
// made there, such as /tmp/claude-0/<session>/scratchpad/x or a mkdtemp fixture), after resolving
// `..` and symlinks in its existing parent, loses nothing a project holds. A folder directly under
// the temp directory may be another tool's or project's working area, so it still asks.
function tempRoots() {
  const roots = new Set([os.tmpdir(), process.env.TMPDIR, '/tmp'].filter(Boolean).map(p => path.resolve(p)));
  for (const r of [...roots]) {
    try {
      roots.add(fs.realpathSync(r));
    } catch {
      // A root that does not exist adds nothing.
    }
  }
  return [...roots];
}

function insideTemp(abs) {
  let real = abs;
  try {
    real = path.join(fs.realpathSync(path.dirname(abs)), path.basename(abs));
  } catch {
    // The parent does not exist: judge the path as written.
  }
  return tempRoots().some(root => {
    const rel = path.relative(root, real);
    return rel && !rel.startsWith('..') && !path.isAbsolute(rel) && rel.split(path.sep).length >= 2;
  });
}

// $NAME and ${NAME} in a word, from assignments made earlier in the same command (`R=/tmp/x; rm -rf $R/y`).
// Returns null when a variable has no known value, or its value came from a substitution.
function expand(word, vars) {
  let unknown = false;
  const out = word.replace(/\$(?:\{(\w+)\}|(\w+))/g, (_, a, b) => {
    const v = vars.get(a ?? b);
    if (v === undefined) unknown = true;
    return v ?? '';
  });
  return unknown ? null : out;
}

// rm -rf whose every target is untracked and either ignored by git (build output such as dist/) or
// not there at all loses nothing a commit or the project's sources hold, and neither does one inside
// the temp directory. Anything tracked, outside the repository and temp, a glob, or a root-like path asks.
const RM = { rule: 'WA-003', action: 'recursive forced delete (rm -rf)', why: 'it deletes files that no commit holds, or that the guard cannot identify, so git cannot bring them back', instead: 'delete specific paths inside the repository, or move the files aside instead of deleting them' };
const RM_CHANGED = { ...RM, why: 'some of these files have uncommitted changes or are untracked, so git cannot bring them back', instead: 'commit or stash the changes first (git stash push -u), then delete' };

function rmRisk(entries, hints = [], snaps = []) {
  const vars = new Map();
  for (const { words, dir } of entries) {
    if (words.length && words.every(w => /^\w+=/.test(w))) {
      for (const w of words) {
        const [name, ...rest] = w.split('=');
        const value = rest.join('=');
        if (/[`]|\$\(/.test(value)) vars.delete(name);
        else {
          const expanded = expand(value, vars);
          if (expanded === null) vars.delete(name);
          else vars.set(name, expanded);
        }
      }
      continue;
    }
    let k = 0;
    while (k < words.length && /^(sudo|command|env|\w+=\S*)$/.test(words[k])) k++;
    if (words[k] !== 'rm' && !words[k]?.endsWith('/rm')) continue;
    const args = words.slice(k + 1);
    const flags = args.filter(w => w.startsWith('-'));
    const recursive = flags.some(f => f === '--recursive' || (/^-[a-zA-Z]+$/.test(f) && /[rR]/.test(f)));
    const force = flags.some(f => f === '--force' || (/^-[a-zA-Z]+$/.test(f) && f.includes('f')));
    if (!recursive || !force) continue;
    for (const word of args.filter(w => !w.startsWith('-'))) {
      const target = word.includes('$') ? expand(word, vars) : word;
      if (target === null || /[*?[{$~]/.test(target) || ['.', './', '..', '/'].includes(target)) return RM;
      const abs = path.resolve(dir, target);
      // A target in no git repository is throwaway only inside the temp directory; one in a
      // repository (even a repository under the temp directory) gets the git checks below.
      let near = path.dirname(abs);
      while (!fs.existsSync(near) && path.dirname(near) !== near) near = path.dirname(near);
      if (git(near, ['rev-parse', '--show-toplevel']).status !== 0 && insideTemp(abs)) continue;
      const top = git(dir, ['rev-parse', '--show-toplevel']);
      if (top.status !== 0) return RM;
      const root = top.out.trim();
      const rel = path.relative(root, abs);
      if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return RM;
      const tracked = git(root, ['ls-files', '--', rel]);
      if (tracked.status !== 0) return RM;
      if (tracked.out.trim()) {
        // Tracked files with nothing uncommitted and nothing untracked: git holds them, so the
        // delete can be undone (guard tiers AC-12). Ignored files inside are build output.
        const status = git(root, ['status', '--porcelain', '--', rel]);
        if (status.status !== 0) return RM;
        if (status.out.trim()) {
          snaps.push({ kind: 'tree', dir: root, path: rel, risk: RM_CHANGED });
          continue;
        }
        hints.push(`git checkout -- ${rel.split(path.sep).join('/')}`);
        continue;
      }
      // Untracked files that are not ignored: a snapshot keeps them (AC-11).
      if (fs.existsSync(abs) && git(root, ['check-ignore', '-q', '--', rel]).status !== 0) snaps.push({ kind: 'tree', dir: root, path: rel, risk: RM_CHANGED });
    }
  }
  return null;
}

const STASH_RISK = { rule: 'WA-003', action: 'dropping stashed work', why: 'a dropped stash is hard to find again', instead: 'apply the stash, or leave it in place' };

// git stash drop and git stash clear: the stash commits they would drop, kept by a snapshot first.
function stashSnaps(entries, snaps) {
  for (const { words, dir } of entries) {
    const g = words.indexOf('git');
    if (g === -1 || words[g + 1] !== 'stash' || !['drop', 'clear'].includes(words[g + 2])) continue;
    let shas;
    if (words[g + 2] === 'clear') {
      const r = git(dir, ['stash', 'list', '--format=%H']);
      if (r.status !== 0) return STASH_RISK;
      shas = r.out.split('\n').filter(Boolean);
    } else {
      const which = words.slice(g + 3).find(w => !w.startsWith('-')) ?? 'stash@{0}';
      const ref = /^\d+$/.test(which) ? `stash@{${which}}` : which;
      if (!/^stash@\{\d+\}$/.test(ref)) return STASH_RISK;
      const r = git(dir, ['rev-parse', '--verify', '--quiet', ref]);
      shas = r.status === 0 ? [r.out.trim()] : [];
    }
    if (shas.length) snaps.push({ kind: 'stash', dir, shas, risk: STASH_RISK });
  }
  return null;
}

// What a command line runs, for the pattern checks: each simple command's words, and a heredoc's
// body only when a shell reads it (bash <<EOF). A script that only mentions git push --force in a
// heredoc, such as Python that edits a file, runs nothing (guard tiers replay, 15d). null when the
// line cannot be parsed, so the caller falls back to the whole text.
const SHELLS = /^(?:.*\/)?(bash|sh|zsh|dash|ksh|ssh|pwsh|powershell)$/;
export function executedText(command) {
  const commands = parseCommand(command);
  if (!commands) return null;
  return commands.map(({ words, scripts = [] }) => {
    let k = 0;
    while (k < words.length && /^(sudo|command|env|exec|\w+=\S*)$/.test(words[k])) k++;
    return [words.join(' '), ...(SHELLS.test(words[k] ?? '') ? scripts : [])].join(' ; ');
  }).join(' ; ');
}

// The first risk a person must decide about, or null. Losses a snapshot can undo go to snaps
// instead (guard tiers AC-11), and tracked, unchanged deletes add their restore command to hints.
function findOtherRisk(command, cwd, hints = [], snaps = []) {
  // With the folder known, discards, stash drops, and rm -rf are checked against what they would remove.
  const entries = cwd ? commandsWithDirs(command, cwd) : null;
  if (entries) {
    discardRisk(entries, snaps);
    const stash = stashSnaps(entries, snaps);
    if (stash) return stash;
  } else if (discardsWorkingTree(command)) return { rule: 'WA-003', action: 'discarding all working-tree changes', why: 'the uncommitted work it removes is in no commit, so git cannot bring it back', instead: 'commit or stash the changes first (git stash push -u), then run it' };
  const rm = entries ? rmRisk(entries, hints, snaps) : (isForcedRecursiveRm(command) ? RM : null);
  if (rm) return rm;
  if (isForcedRecursiveRemoveItem(command)) return { ...RM, action: 'recursive forced delete (Remove-Item -Recurse -Force)' };
  const text = executedText(command) ?? command;
  for (const [pattern, action, kind, rule, why, instead] of CHECKS) {
    if (!pattern.test(text)) continue;
    if (entries && (kind === 'discard' || kind === 'stash')) continue;
    return { rule, action, why, instead };
  }
  return null;
}

const shellPath = p => (/^[\w./@:+-]+$/.test(p) ? p : `'${p.replace(/'/g, "'\\''")}'`);

// Takes the snapshots snaps call for, at most one of the working tree per repository. Returns
// { lines, refs } with a restore command for each, or { failed } with the risk to ask about.
export function takeSnapshots(snaps, command, { now = new Date(), deadline = Date.now() + 6000 } = {}) {
  const lines = [];
  const refs = [];
  const trees = new Map();
  for (const snap of snaps) {
    const top = git(snap.dir, ['rev-parse', '--show-toplevel']);
    if (top.status !== 0) return { failed: snap.risk };
    const root = top.out.trim();
    const rel = snap.kind === 'tree' ? path.relative(root, path.resolve(snap.dir, snap.path)).split(path.sep).join('/') || '.' : null;
    try {
      if (snap.kind === 'stash') {
        for (const { ref, sha } of snapshotStashes(root, snap.shas, { now, deadline })) {
          refs.push(ref);
          lines.push(`git stash store -m "restored by rfr-core" ${sha} (kept as ${ref})`);
        }
        continue;
      }
      if (!trees.has(root)) {
        const taken = snapshotTree(root, { label: command.split('\n')[0], now, deadline });
        trees.set(root, taken);
        refs.push(taken.ref);
      }
      const { sha, ref } = trees.get(root);
      const where = root === path.resolve(snap.dir) || rel === '.' ? '' : `git -C ${shellPath(root)} `;
      const restore = `${where}git restore --source=${sha} --worktree -- ${rel === '.' ? ':/' : shellPath(rel)}`;
      lines.push(snap.moves ? `${where}git reset --hard ${sha}~1 && ${restore} (kept as ${ref})` : `${restore} (kept as ${ref})`);
    } catch {
      return { failed: snap.risk };
    }
  }
  for (const root of trees.keys()) pruneSnapshots(root, { now });
  return { lines: [...new Set(lines)], refs };
}

// The reason for any refusal or question, or null; kept for callers that only need to know whether
// the command is risky.
export function findRisk(command, options) {
  return decideCommand(command, options)?.reason ?? null;
}

async function main() {
  const input = await readInput();
  const result = decideCommand(input?.tool_input?.command, { cwd: input?.cwd ?? process.cwd() });
  if (result?.decision === 'deny') deny(result.reason);
  else if (result?.decision === 'inform' || result?.decision === 'defer') {
    // A snapshot goes in the decision log with its refs, so it can be found again (AC-11).
    if (result.snapshots?.length && guardLogEnabled()) {
      try {
        appendGuardLog({ time: new Date().toISOString(), session: input?.session_id ?? null, hook: 'guard-commands', tool: input?.tool_name ?? null, decision: 'snapshot', reason: result.reason.slice(0, 200), refs: result.snapshots });
      } catch {
        // Logging never blocks a decision.
      }
    }
    if (result.decision === 'defer') defer(result.reason);
    else inform(result.reason);
  }
  else if (result) ask(result.reason);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
