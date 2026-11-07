#!/usr/bin/env node
// PreToolUse (Bash, PowerShell): ask the user before destructive git, file, and database commands
// (rules WA-003 and, for databases, the node-services pack). Asking keeps the user in
// control without blocking legitimate use; headless runs treat "ask" as a denial. Also asks
// when an Unreal editor run's -ExecCmds list never quits, which leaves the editor hanging.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ask, deny, existedAtBase, readInput } from './lib.mjs';
import { isTestPath } from './guard-test-edits.mjs';
import { parseCommand, writeTargetEntries } from './shell-writes.mjs';

const CHECKS = [
  [/\bgit\s+reset\b[^;&|]*--hard/, 'git reset --hard discards uncommitted work'],
  [/\bgit\s+clean\b[^;&|]*\s-[a-zA-Z]*f/, 'git clean -f deletes untracked files'],
  [/\bgit\s+push\b[^;&|]*(\s--force\b|\s--force-with-lease\b|\s-[a-zA-Z]*f\b|\s\+\S)/, 'force-push rewrites remote history'],
  [/\bgit\s+branch\b[^;&|]*\s-D\b/, 'force-deleting a branch'],
  [/\bgit\s+stash\s+(drop|clear)\b/, 'dropping stashed work'],
  [/\bgit\s+(filter-branch|filter-repo)\b/, 'rewriting repository history'],
  [/\bgit\b[^;&|]*\s--no-verify\b/, 'skipping commit or push hooks (--no-verify)'],
  [/\bgit\s+config\b(?![^;&|\n]*\s(--get\S*|--list|-l)\b)[^;&|\n]*\s--(global|system)\b/, 'changing machine-wide git configuration (pass the setting for one command with git -c instead)'],
  [/\bdrizzle-kit\s+push\b/, 'drizzle-kit push applies schema changes directly to a database'],
  [/\bdrizzle-kit\b[^;&|]*\s--force\b/, 'drizzle-kit --force accepts data-loss statements'],
  [/\bprisma\s+migrate\s+(dev|reset)\b/, 'prisma migrate dev/reset can reset or alter a database'],
  [/\bprisma\s+db\s+(push|migrate)\b/, 'prisma db push/migrate applies changes, including destructive ones, without review'],
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

// An editor run whose -ExecCmds list never quits keeps running after its commands finish,
// unless the only command is a test run (#56). Requiring Quit is simpler and always safe.
export function execCmdsWithoutQuit(command) {
  if (!/\bUnrealEditor(-Cmd)?(\.exe)?\b/i.test(command)) return false;
  const match = command.match(/-ExecCmds=("[^"]*"|'[^']*'|\S+)/i);
  return Boolean(match) && !/\bquit\b/i.test(match[1]);
}

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

export function decideCommand(command, { cwd } = {}) {
  if (typeof command !== 'string') return null;
  const existed = cwd ? file => existingProjectFile(file, cwd) : undefined;
  const change = testFileChange(command, existed);
  if (change === 'write') {
    return { decision: 'deny', reason: 'rfr-core (TEST-001): this command writes to an existing test file, so the change cannot be checked. Make the change with the Edit tool instead (one Edit per change, or MultiEdit for several in one file), so the test-change check can see it; additive and neutral changes then go through without asking.' };
  }
  const risk = change === 'remove' ? 'this command deletes or moves an existing test file (TEST-001)'
    : change === 'broad' ? 'this command appears to change an existing test file outside the Edit tool (TEST-001)'
    : findOtherRisk(command);
  return risk ? { decision: 'ask', reason: `rfr-core (WA-003): ${risk}. Approve only if this is intended and the target is not shared.` } : null;
}

function findOtherRisk(command) {
  if (updatesSnapshots(command)) return 'this command updates test snapshots, which rewrites their expected values (TEST-001)';
  if (discardsWorkingTree(command)) return 'discarding all working-tree changes';
  if (execCmdsWithoutQuit(command)) return 'the editor -ExecCmds list does not end with Quit, so the editor will keep running after its commands finish (add ";Quit")';
  if (isForcedRecursiveRm(command)) return 'recursive forced delete (rm -rf)';
  if (isForcedRecursiveRemoveItem(command)) return 'recursive forced delete (Remove-Item -Recurse -Force)';
  for (const [pattern, reason] of CHECKS) if (pattern.test(command)) return reason;
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
  else if (result) ask(result.reason);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
