#!/usr/bin/env node
// PreToolUse (Bash, PowerShell): refuse destructive git and file commands and the never list (rule
// WA-003); "ask" is a refusal the agent acts on, with no prompt. Database and Vercel CLI commands are
// rfr-web's guard-cli (rewrite plan 25e), and the Unreal editor -ExecCmds check is rfr-unreal's
// guard-unreal (docs/specs/plugin-split.md, AC-2).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appendGuardLog, ask, askReason, canonical, defer, deferredTestContext, deny, existedAtBase, guardLogEnabled, guardSettings, inform, readInput, refuseReason } from './lib.mjs';
import { pruneSnapshots, snapshotStashes, snapshotTree } from './snapshot.mjs';
import { isTestPath } from './guard-test-edits.mjs';
import { parseCommand, writeTargetEntries } from './shell-writes.mjs';
import { commandWords, commandsWithDirs, executedText, innerScripts, resolveFromShell, runnerTarget } from './command-words.mjs';

export { commandsWithDirs, executedText, resolveFromShell };
import { approveReason, commandApprovesPr, unreadReason } from './pr-approval.mjs';

// [pattern, action, kind, rule, why, instead]: why a person must decide, and what the agent can do
// if the person says no (guard tiers AC-3).
const LOCAL_LOSS = 'the uncommitted work it removes is in no commit, so git cannot bring it back';
const CHECKS = [
  [/\bgit\s+reset\b[^;&|]*--hard/, 'git reset --hard discards uncommitted work', 'discard', 'WA-003', LOCAL_LOSS, 'commit or stash the changes first (git stash push -u), then run it'],
  [/\bgit\s+clean\b[^;&|]*\s-[a-zA-Z]*f/, 'git clean -f deletes untracked files', 'discard', 'WA-003', 'untracked files are in no commit, so git cannot bring them back', 'list them with git clean -n and delete only the files you made, or move them aside'],
  [/\bgit\s+push\b[^;&|]*(\s--force\b|\s--force-with-lease\b|\s-[a-zA-Z]*f\b|\s\+\S)/, 'force-push rewrites remote history', null, 'WA-003', 'it replaces history on the remote that others may already have pulled', 'push to a new branch, or bring the remote changes in and push normally'],
  [/\bgit(\.exe)?\b[^;&|\n]*\sbranch\b[^;&|\n]*(\s-[a-zA-Z]*D|\s-[a-zA-Z]*(d[a-zA-Z]*f|f[a-zA-Z]*d)\b|\s--del[a-z]*\b[^;&|\n]*\s(-f\b|--fo[a-z]*\b)|\s(-f\b|--fo[a-z]*\b)[^;&|\n]*\s--del[a-z]*\b|\s-d\b[^;&|\n]*\s(-f\b|--fo[a-z]*\b)|\s(-f\b|--fo[a-z]*\b)[^;&|\n]*\s-d\b)/, 'force-deleting a branch', 'branch', 'WA-003', 'commits only on that branch then survive only in the reflog', 'use git branch -d, which refuses to delete unmerged work'],
  [/\bgit\s+stash\s+(drop|clear)\b/, 'dropping stashed work', 'stash', 'WA-003', 'a dropped stash is hard to find again', 'apply the stash, or leave it in place'],
  [/\bgit\s+(filter-branch|filter-repo)\b/, 'rewriting repository history', null, 'WA-003', 'it rewrites every commit, and pushing the result replaces shared history', 'stop and report what you want removed from history'],
  [/\bgit\b[^;&|]*\s--no-verify\b/, 'skipping commit or push hooks (--no-verify)', null, 'WA-003', 'it skips the checks the project set for every commit and push', 'run the hooks and fix what they report'],
  [/\bgit\s+config\b(?![^;&|\n]*\s(--get\S*|--list|-l)\b)[^;&|\n]*\s--(global|system)\b/, 'changing machine-wide git configuration', null, 'WA-003', 'it changes git for every repository on this machine, outside the project', 'pass the setting for one command with git -c instead'],
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

// The command's text without quoted strings and heredoc bodies, where a cmdlet's name is only text:
// a commit message that says "Copy-Item refused to copy the file" runs no Copy-Item.
const unquotedText = command => command
  .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2[ \t]*(?=\n|$)/g, ' ')
  .replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, ' ');

// Whether a PowerShell cmdlet that writes would run. A command that starts PowerShell
// (pwsh or powershell, whose -Command is usually quoted) counts whatever its quoting.
const psWritesRun = command => psWrites(command)
  && (/\b(pwsh|powershell)(\.exe)?\b/i.test(command) || psWrites(unquotedText(command)));

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
  if (psWritesRun(command) && broadWritesTestFile(command)) return 'broad';
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
  const abs = resolveFromShell(cwd, file);
  const rel = path.relative(canonical(root), canonical(abs));
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
// { decision: 'ask', reason } for an action on the never list, which is refused (docs/specs/guard-tiers.md,
// docs/specs/unattended.md).
export function decideCommand(command, { cwd, settings, snapshot = takeSnapshots } = {}) {
  if (typeof command !== 'string') return null;
  // Approving a pull request is refused before anything else (github-gate AC-9).
  const approves = commandApprovesPr(command);
  if (approves) return { decision: 'deny', reason: approves === 'approve' ? approveReason : unreadReason };
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
  const restores = [];
  const asking = r => ({ decision: 'ask', reason: askReason({ source: `rfr-core (${r.rule})`, action: r.action, why: r.why, instead: r.instead }) });
  const risk = findOtherRisk(command, cwd, hints, snaps, restores);
  if (risk) return asking(risk);
  // Actions on the never list that reach outside the project: pushing to the default branch,
  // deleting on the remote, reading secrets, and skipping hooks.
  const named = namedAsk(command, cwd);
  if (named) return asking(named);
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
  if (restores.length) notes.push(`the deleted branch's commits stay in the repository; to bring it back: ${restores.join('; ')}`);
  const noted = notes.length ? `rfr-core (WA-003): ${notes.join('. ')}.` : null;
  if (deferred) return { decision: 'defer', reason: noted ? `${deferred} ${noted}` : deferred, snapshots };
  if (noted) return { decision: 'inform', reason: noted, snapshots };
  return null;
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
      if (words[k] === '-C' && words[k + 1]) { where = resolveFromShell(where, words[k + 1]); k += 2; } else k += words[k] === '-c' ? 2 : 1;
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
  // /var/tmp is the other temp folder on Linux and macOS: cloud sessions copy repositories there.
  const roots = new Set([os.tmpdir(), process.env.TMPDIR, '/tmp', ...(process.platform === 'win32' ? [] : ['/var/tmp'])].filter(Boolean).map(p => path.resolve(p)));
  for (const r of [...roots]) {
    try {
      roots.add(fs.realpathSync.native(r));
    } catch {
      // A root that does not exist adds nothing.
    }
  }
  return [...roots];
}

function insideTemp(abs, depth = 2) {
  const real = canonical(abs);
  return tempRoots().some(root => {
    const rel = path.relative(root, real);
    return rel && !rel.startsWith('..') && !path.isAbsolute(rel) && rel.split(path.sep).length >= depth;
  });
}

// The folders a command creates (default-allow, 2026-11-12): the destination of cp -r, mkdir, git
// clone, and git worktree add, resolved from the folder the command runs in. Only one that did not
// exist when the line started counts, so its contents are all the line's own.
function createdFolders(words, dir) {
  const plain = words.filter(w => !w.startsWith('-'));
  let made = [];
  if (words[0] === 'cp' && words.slice(1).some(w => /^-[a-zA-Z]*[rRa]/.test(w) || w === '--recursive' || w === '--archive') && plain.length >= 3) made = [plain.at(-1)];
  else if (words[0] === 'mkdir') made = plain.slice(1);
  else if (words[0] === 'git' && words[1] === 'clone' && plain.length >= 4) made = [plain[3]];
  else if (words[0] === 'git' && words[1] === 'worktree' && words[2] === 'add') {
    const args = words.slice(3);
    for (let k = 0; k < args.length; k++) {
      if (/^(-b|-B|--reason)$/.test(args[k])) { k++; continue; }
      if (!args[k].startsWith('-')) { made = [args[k]]; break; }
    }
  }
  // A ~ only at the start is the home folder; inside a name (C:/Users/RUNNER~1) it is a character.
  return made.filter(w => !/[*?[{$]/.test(w) && !w.startsWith('~')).map(w => resolveFromShell(dir, w)).filter(abs => !fs.existsSync(abs));
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
  // Folders this line made inside a temp folder: deleting one later in the line loses nothing that
  // was there before ("cp -r . /var/tmp/check && ... && rm -rf /var/tmp/check").
  const made = [];
  // The session's own project: the repository the command line starts in.
  const start = entries[0]?.dir;
  const startTop = start ? git(start, ['rev-parse', '--show-toplevel']) : { status: 1 };
  const project = startTop.status === 0 ? canonical(startTop.out.trim()) : null;
  for (const { words, dir } of entries) {
    for (const abs of createdFolders(words, dir)) if (insideTemp(abs, 1)) made.push(abs);
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
    const within = (abs, m) => abs === m || abs.startsWith(m + path.sep) || abs.startsWith(`${m}/`);
    for (const word of args.filter(w => !w.startsWith('-'))) {
      const target = word.includes('$') ? expand(word, vars) : word;
      // Inside a folder this line made, a relative target, globs included, stays inside it.
      if (target !== null && made.some(m => within(dir, m)) && !/(^|\/)\.\.(\/|$)/.test(target) && !/^[/~\\]|^[A-Za-z]:/.test(target)) continue;
      // A glob, an unexpanded variable, or a leading ~ (the shell's home folder) asks. A ~ inside a
      // name, as in an 8.3 short name (C:/Users/RUNNER~1), is an ordinary character to the shell.
      if (target === null || /[*?[{$]/.test(target) || target.startsWith('~') || ['.', './', '..', '/'].includes(target)) return RM;
      const abs = resolveFromShell(dir, target);
      if (made.some(m => within(abs, m))) continue;
      // Inside a temp folder, anything but the session's own project is throwaway, including a copy or
      // clone of it: the person is never asked about scratch folders (default-allow decision 6). The
      // project itself, even when it lives in a temp folder, keeps the git checks below.
      if (insideTemp(abs, 1)) {
        let near = abs;
        while (!fs.existsSync(near) && path.dirname(near) !== near) near = path.dirname(near);
        const top = git(fs.existsSync(near) && fs.statSync(near).isDirectory() ? near : path.dirname(near), ['rev-parse', '--show-toplevel']);
        if (top.status !== 0 || (project && canonical(top.out.trim()) !== project)) continue;
      }
      // A target in no git repository is throwaway only inside the temp directory; one in a
      // repository (even a repository under the temp directory) gets the git checks below.
      let near = path.dirname(abs);
      while (!fs.existsSync(near) && path.dirname(near) !== near) near = path.dirname(near);
      if (git(near, ['rev-parse', '--show-toplevel']).status !== 0 && insideTemp(abs)) continue;
      const top = git(dir, ['rev-parse', '--show-toplevel']);
      if (top.status !== 0) return RM;
      const root = top.out.trim();
      const rel = path.relative(canonical(root), canonical(abs));
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

// The first risk a person must decide about, or null. Losses a snapshot can undo go to snaps
// instead (guard tiers AC-11), and tracked, unchanged deletes add their restore command to hints.
// git branch -D (or -d --force): a local branch's commits stay in the repository after the delete,
// so the command that recreates the branch at its last commit is a way back (rewrite plan 25e: a
// local delete is not on the never list). A branch the guard cannot resolve is refused as before.
const BRANCH_DELETE = { rule: 'WA-003', action: 'force-deleting a branch', why: 'the guard could not find the commit it points at, so nothing records how to bring it back', instead: 'use git branch -d, which refuses to delete unmerged work' };
// The allowance applies only to the plain form, as the one command on the line: `git branch -D <names>`
// or `git branch -d -f <names>`, with no wrapper, no global options (-C, --git-dir, -c), and nothing
// before it that could move the branch. Any other form is left to the refusal in CHECKS, which also
// catches bundled and abbreviated flags (security review of #237).
function branchRestores(entries, restores) {
  if (entries.length !== 1) return null;
  const [{ words, dir }] = entries;
  if (words[0] !== 'git' || words[1] !== 'branch') return null;
  const args = words.slice(2);
  const flags = args.filter(a => a.startsWith('-')).map(a => ({ '--delete': '-d', '--force': '-f' }[a] ?? a)).sort().join(' ');
  if (flags !== '-D' && flags !== '-d -f') return null;
  const names = args.filter(a => !a.startsWith('-'));
  if (!names.length) return null;
  const found = [];
  for (const name of names) {
    const sha = git(dir, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]).out.trim();
    if (!sha) return BRANCH_DELETE;
    found.push(`git branch ${shellPath(name)} ${sha}`);
  }
  restores.push(...found);
  return null;
}

function findOtherRisk(command, cwd, hints = [], snaps = [], restores = []) {
  // With the folder known, discards, stash drops, and rm -rf are checked against what they would remove.
  const entries = cwd ? commandsWithDirs(command, cwd) : null;
  if (entries) {
    const branch = branchRestores(entries, restores);
    if (branch) return branch;
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
    if (kind === 'branch' && restores.length) continue;
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
    const rel = snap.kind === 'tree' ? path.relative(canonical(root), canonical(path.resolve(snap.dir, snap.path))).split(path.sep).join('/') || '.' : null;
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
      const where = canonical(root) === canonical(snap.dir) || rel === '.' ? '' : `-C ${shellPath(root)} `;
      const restore = `git ${where}restore --source=${sha} --worktree -- ${rel === '.' ? ':/' : shellPath(rel)}`;
      lines.push(snap.moves ? `git ${where}reset --hard ${sha}~1 && ${restore} (kept as ${ref})` : `${restore} (kept as ${ref})`);
    } catch {
      return { failed: snap.risk };
    }
  }
  for (const root of trees.keys()) pruneSnapshots(root, { now });
  return { lines: [...new Set(lines)], refs };
}

const PUSH_DEFAULT = { rule: 'WA-003', action: 'pushing to the default branch', why: 'it changes the shared branch directly, without a pull request or its checks', instead: 'push a branch and open a pull request' };
const REMOTE_DELETE = { rule: 'WA-003', action: 'deleting a branch, tag, release, or repository on the remote', why: 'it removes shared work from the remote, outside the project folder', instead: 'leave it in place and report what you would delete' };

const REMOTE_REWRITE = { rule: 'WA-003', action: 'moving a branch or tag on the remote through the API', why: 'it can rewrite shared history on the remote, as a force-push does', instead: 'push a branch and open a pull request' };
const SKIP_HOOKS = { rule: 'WA-003', action: 'skipping the project\'s commit or push hooks (git commit -n, core.hooksPath, HUSKY=0, SKIP=)', why: 'it skips the checks the project set for every commit and push', instead: 'run the hooks and fix what they report' };
const READ_SECRET = { rule: 'SEC-001', action: 'reading secret values into the session (a .env or key file, or the environment)', why: 'a secret read into the session cannot be unread, and it can reach logs, transcripts, and pull requests', instead: 'refer to the variable by name, or read the .env.example file that lists the names' };
const BYPASS_GATE = { rule: 'WA-003', action: 'bypassing or changing branch protection (gh pr merge --admin, or a change to protection or rulesets)', why: 'branch protection is how the approver\'s review gates a merge, and changing it reaches outside the project', instead: 'leave the pull request for its checks and the approver\'s review, and report what you would change' };

// A gh api call that changes branch protection or rulesets: a method other than GET on a
// .../branches/<b>/protection... or .../rulesets... path.
function changesProtection(args) {
  const path = args.find(a => /(^|\/)(branches\/[^\s]+\/protection|rulesets)(\/|$|\?)/.test(a));
  if (!path) return false;
  return apiMethod(args) !== 'GET';
}

// The HTTP method of a gh api call: -X or --method, else POST when it sends fields or a body, else GET.
function apiMethod(args) {
  // gh takes the last -X, and accepts -X DELETE, -XDELETE, -X=DELETE, --method DELETE, --method=DELETE.
  const k = args.findLastIndex(a => a === '-X' || a === '--method' || /^(-X=?|--method=)\S+/.test(a));
  const method = k === -1 ? (args.some(a => /^(-f|-F|--field|--raw-field|--input)$/.test(a)) ? 'POST' : 'GET')
    : (args[k] === '-X' || args[k] === '--method' ? args[k + 1] : args[k].replace(/^(-X=?|--method=)/, ''));
  return String(method ?? '').toUpperCase();
}

// A gh api graphql call whose mutation deletes something or moves a ref (deleteRef, updateRef,
// updateRefs, deleteRepository, and other delete mutations).
const graphqlRewrites = args => args.some(a => /\bmutation\b/.test(a) && /\b(delete\w*|updateRefs?)\s*\(/.test(a));

// A hooks path that runs no hooks: /dev/null, NUL, an empty value, or a folder that is not there.
function emptyHooksPath(value, dir) {
  const v = String(value ?? '').replace(/^['"]|['"]$/g, '');
  if (!v || /^(\/dev\/null|nul)$/i.test(v)) return true;
  return !fs.existsSync(resolveFromShell(dir, v));
}

// The letters of a short-option bundle up to the first that takes a value (git commit -uno is
// --untracked-files=no, -m"x" is a message): -n counts only before them.
const shortFlags = (word, takesValue) => {
  if (!/^-[a-zA-Z]/.test(word) || word.startsWith('--')) return '';
  let out = '';
  for (const c of word.slice(1)) {
    if (takesValue.includes(c)) break;
    out += c;
  }
  return out;
};

// A file that holds secret values: .env and .env.<name> (not a copy with an example, sample, template,
// or dist part, which holds names only), .envrc, cloud and package-registry credentials, and private
// keys (a .pem whose name says key, or an SSH key). A leading .\ (PowerShell) reaches the parser as ..
const SECRET_FILE = /(^\.?|[\\/])(\.env(?![\w.-]*\.(example|sample|template|dist)\b)(\.[\w.-]+)?|\.envrc|\.npmrc|\.netrc|credentials|(?![\w.-]*(cert|chain|ca|pub|public)[\w.-]*\.pem$)[\w.-]+\.pem|id_(rsa|ed25519|ecdsa))$/i;
// Commands that print a file's contents. source and . load a file into the shell without printing it,
// so they are not readers (security review of #237: `source .env && npm run dev` is ordinary work).
const READERS = /^(cat|type|less|more|head|tail|bat|nl|tac|strings|xxd|od|grep|egrep|rg|awk|sed|cut|sort|get-content|gc|select-string|sls|import-csv)$/i;
const SECRET_WORDS = 'TOKEN|SECRET|PASSWORD|PASSWD|PRIVATE_KEY|API_KEY|ACCESS_KEY|CREDENTIAL|DATABASE_URL|_KEY\\b';
const SECRET_NAME = new RegExp(`\\$(\\{|env:)?\\w*(${SECRET_WORDS})\\w*\\}?`, 'i');
const SECRET_PATTERN = new RegExp(SECRET_WORDS, 'i');

// Whether one simple command prints a secret: a secrets file read by a reader (grep -q, -l, -c and
// sed -i print no values), a secret-named variable printed, gh auth token, or a PowerShell read of a
// secret-named environment variable.
function readsSecret(words) {
  const cmd = (words[0] ?? '').replace(/^.*[\\/]/, '').replace(/\.exe$/i, '');
  const args = words.slice(1);
  const quiet = (/^(grep|egrep|rg)$/i.test(cmd) && args.some(a => /^-[a-zA-Z]*[qlLc][a-zA-Z]*$|^--(quiet|files-with-matches|count)$/.test(a))) || (/^sed$/i.test(cmd) && args.some(a => /^-[a-zA-Z]*i|^--in-place/.test(a)));
  if (READERS.test(cmd) && !quiet && args.some(a => !a.startsWith('-') && SECRET_FILE.test(a.replace(/^-Path:?/i, '')))) return true;
  if (/^printenv$/i.test(cmd) && args.some(w => !w.startsWith('-') && SECRET_PATTERN.test(w))) return true;
  if (/^(echo|printf|write-output|write-host)$/i.test(cmd) && args.some(w => SECRET_NAME.test(w))) return true;
  // A bare $env:NAME prints it in PowerShell; $env:NAME = ... only sets it.
  if (words.length === 1 && /^\$env:/i.test(words[0] ?? '') && SECRET_PATTERN.test(words[0])) return true;
  if (/^(get-item|gi|get-content|gc|get-childitem|gci)$/i.test(cmd) && args.some(w => /^env:\\?\w*$/i.test(w) && SECRET_PATTERN.test(w))) return true;
  if (cmd === 'gh' && args[0] === 'auth' && (args[1] === 'token' || args.includes('--show-token'))) return true;
  return false;
}

// Whether the line lists the whole environment where the session sees it: env, printenv, set, export -p,
// declare -x or -p, [Environment]::GetEnvironmentVariables(), or Get-ChildItem env:, unless that
// command's output goes straight into a filter by name (env | grep PXR) whose pattern names no secret.
const FILTERS = /^(grep|egrep|rg|findstr|select-string|sls|where-object|\?)$/i;
function dumpsEnvironment(command) {
  const text = command.replace(/'[^']*'/g, m => m.replace(/[;&|\n]/g, ' ')).replace(/"(?:[^"\\]|\\.)*"/g, m => m.replace(/[;&|\n]/g, ' '));
  const segments = text.split(/(\|\||&&|;|\n|\||&)/);
  for (let k = 0; k < segments.length; k += 2) {
    const words = segments[k].trim().split(/\s+/).filter(Boolean);
    while (words.length && /^(sudo|command|exec|\w+=\S*)$/.test(words[0])) words.shift();
    const cmd = (words[0] ?? '').replace(/\.exe$/i, '');
    const rest = words.slice(1);
    const onlyFlags = rest.every(w => w.startsWith('-'));
    const dump = (/^(env|printenv)$/i.test(cmd) && onlyFlags)
      || (cmd === 'set' && rest.length === 0)
      || (cmd === 'export' && (rest.length === 0 || (rest.length === 1 && rest[0] === '-p')))
      || (/^(declare|typeset)$/.test(cmd) && rest.length > 0 && onlyFlags && rest.every(w => /^-[px]+$/.test(w)))
      || /^\[environment\]::getenvironmentvariables\(/i.test(cmd)
      || (/^(get-childitem|gci|ls|dir)$/i.test(cmd) && rest.some(w => /^env:\\?\*?$/i.test(w)));
    if (!dump) continue;
    const piped = segments[k + 1] === '|';
    const next = piped ? segments[k + 2].trim().split(/\s+/) : [];
    if (piped && FILTERS.test(next[0] ?? '') && !SECRET_PATTERN.test(next.slice(1).join(' '))) continue;
    return true;
  }
  return false;
}

// The branches a push must not reach: main, master, and the remote's default branch.
export function defaultBranches(cwd) {
  const head = git(cwd, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).out.trim().replace(/^origin\//, '');
  return new Set(['main', 'master', ...(head ? [head] : [])]);
}

// The words of a git command from its subcommand on: git -C <dir>, -c <k=v>, and other global
// options are skipped. null when the words are not a git command.
function gitArgs(words) {
  if (words[0] !== 'git') return null;
  let k = 1;
  while (k < words.length && words[k].startsWith('-')) k += ['-C', '-c', '--git-dir', '--work-tree', '--namespace'].includes(words[k]) ? 2 : 1;
  return words.slice(k);
}

// The never-list action a command line takes outside the project, or null. Pushes are read with the folder
// each runs in, so a push of the current branch is checked against the default branch.
export function namedAsk(command, cwd, depth = 0) {
  if (typeof command !== 'string') return null;
  // Heredoc bodies and quoted strings are text, not commands (a script that mentions env runs no env);
  // a shell given a script (bash -c '...') is checked below, on that script.
  if (dumpsEnvironment(unquotedText(command))) return READ_SECRET;
  // Hooks skipped by a variable exported earlier in the line, then a commit or push.
  if (/(^|[;&|\n]\s*)(export\s+|\$env:)(HUSKY\s*=\s*['"]?0|HUSKY_SKIP_HOOKS|SKIP\s*=)/i.test(command) && /\bgit(\.exe)?\s+(\S+\s+)*?(commit|push)\b/.test(command)) return SKIP_HOOKS;
  // A secrets file read by input redirection (cat < .env).
  for (const { words = [], redirects = [] } of parseCommand(command) ?? []) {
    if ((!words.length || READERS.test(words[0])) && redirects.some(r => r.op === '<' && SECRET_FILE.test(String(r.target ?? '')))) return READ_SECRET;
  }
  const entries = commandsWithDirs(command, cwd ?? process.cwd()) ?? [];
  for (const { words: raw, dir } of entries) {
    let words = commandWords(raw);
    // A command a shell or a substitution runs is checked as a line of its own.
    if (depth < 3) {
      for (const inner of innerScripts(words, command)) {
        const found = namedAsk(inner, dir, depth + 1);
        if (found) return found;
      }
    }
    words = runnerTarget(words);
    const g = gitArgs(words);
    if (g?.[0] === 'push') {
      const args = g.slice(1);
      const flags = args.filter(a => a.startsWith('-'));
      if (flags.some(f => /^(-d|--delete|--mirror|--prune)$/.test(f))) return REMOTE_DELETE;
      if (flags.some(f => /^(--all|--branches)$/.test(f))) return PUSH_DEFAULT;
      const positional = [];
      for (let k = 0; k < args.length; k++) {
        if (/^(-o|--push-option|--repo|--receive-pack|--exec)$/.test(args[k])) { k++; continue; }
        if (!args[k].startsWith('-')) positional.push(args[k]);
      }
      const defaults = defaultBranches(dir);
      const refspecs = positional.slice(1);
      if (!refspecs.length) {
        // --tags pushes the tags and not the current branch; --follow-tags pushes both.
        if (flags.includes('--tags')) continue;
        const current = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']).out.trim();
        if (current && defaults.has(current)) return PUSH_DEFAULT;
        continue;
      }
      for (const spec of refspecs) {
        if (spec.startsWith(':')) return REMOTE_DELETE;
        const [src, dst = src] = spec.replace(/^\+/, '').split(':');
        // The destination decides: a tag pushed to refs/tags/ is not a branch, but a tag (or any
        // source) pushed to the default branch, or a glob that can reach it, moves that branch.
        if (/^refs\/tags\//.test(dst)) continue;
        if (dst.includes('*')) return PUSH_DEFAULT;
        if (dst === src && git(dir, ['show-ref', '--verify', '--quiet', `refs/tags/${src}`]).status === 0) continue;
        const target = dst === 'HEAD' ? git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']).out.trim() : dst.replace(/^refs\/heads\//, '');
        if (defaults.has(target)) return PUSH_DEFAULT;
      }
      continue;
    }
    if (words[0] === 'gh' && ((words[1] === 'release' && words[2] === 'delete') || (words[1] === 'repo' && /^(delete|archive|rename)$/.test(words[2] ?? '')))) return REMOTE_DELETE;
    // Replacing a published release's assets removes what was there.
    if (words[0] === 'gh' && words[1] === 'release' && words[2] === 'upload' && words.includes('--clobber')) return REMOTE_DELETE;
    // The gate is branch protection: an agent neither bypasses it nor changes it (github-gate AC-9).
    if (words[0] === 'gh' && words[1] === 'pr' && words[2] === 'merge' && words.includes('--admin')) return BYPASS_GATE;
    if (words[0] === 'gh' && words[1] === 'api' && changesProtection(words.slice(2))) return BYPASS_GATE;
    // Deleting through the API, or moving a branch or tag on the remote (a PATCH of git/refs can
    // force it), as git push --delete and a force-push are refused.
    if (words[0] === 'gh' && words[1] === 'api') {
      const method = apiMethod(words.slice(2));
      if (method === 'DELETE') return REMOTE_DELETE;
      if (method !== 'GET' && method !== 'POST' && words.slice(2).some(a => /(^|\/)git\/refs\//.test(a))) return REMOTE_REWRITE;
    }
    // Skipping the project's hooks in any form: git commit -n, a hooks path set for one command or in
    // the repository's configuration, and the variables Husky and pre-commit read.
    const committing = g && /^(commit|push|merge|am|rebase)$/.test(g[0] ?? '');
    if (raw.some(w => /^(HUSKY=0|HUSKY_SKIP_HOOKS=1)$/.test(w)) && (committing || /^(npx|npm|pnpm|yarn)$/.test(words[0] ?? ''))) return SKIP_HOOKS;
    if (raw.some(w => /^SKIP=\S+$/.test(w)) && (committing || words[0] === 'pre-commit')) return SKIP_HOOKS;
    if (words[0] === 'git') {
      const globals = words.slice(1, words.length - (g?.length ?? 0));
      const hooksValue = globals.map((w, k) => (w === '-c' ? globals[k + 1] : /^-c\S/.test(w) ? w.slice(2) : null)).find(v => /^core\.hooksPath=/i.test(v ?? ''));
      if (hooksValue !== undefined && emptyHooksPath(hooksValue.split('=').slice(1).join('='), dir)) return SKIP_HOOKS;
      if (globals.some(w => /^--config-env=core\.hooksPath=/i.test(w))) return SKIP_HOOKS;
      if (g?.[0] === 'config') {
        const parts = g.slice(1).filter(a => !a.startsWith('-'));
        const key = parts.findIndex(a => /^core\.hooksPath$/i.test(a));
        const reading = g.some(a => /^(--get\S*|--list|-l)$/.test(a)) || /^(get|list)$/.test(parts[0] ?? '');
        if (key !== -1 && !reading && (g.some(a => /^--unset/.test(a)) || /^(unset)$/.test(parts[0] ?? '') || emptyHooksPath(parts[key + 1], dir))) return SKIP_HOOKS;
      }
      if (g?.[0] === 'commit' && g.slice(1).some(a => shortFlags(a, 'mcCFuSt').includes('n'))) return SKIP_HOOKS;
      if (committing && g.slice(1).some(a => /^--no-v(e(r(i(f(y)?)?)?)?)?$/.test(a))) return SKIP_HOOKS;
    }
    // Reading secret values into the session: a secrets file read by a shell command, the whole
    // environment, or a secret-named variable printed (vercel env pull is rfr-web's guard-cli).
    if (readsSecret(words)) return READ_SECRET;
    if (words[0] === 'gh' && words[1] === 'api' && words[2] === 'graphql' && graphqlRewrites(words.slice(3))) return REMOTE_REWRITE;
  }
  return null;
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
