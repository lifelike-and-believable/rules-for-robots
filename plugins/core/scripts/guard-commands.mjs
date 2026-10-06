#!/usr/bin/env node
// PreToolUse (Bash, PowerShell): ask the user before destructive git, file, and database commands
// (rules WA-003 and, for databases, the node-services pack). Asking keeps the user in
// control without blocking legitimate use; headless runs treat "ask" as a denial. Also asks
// when an Unreal editor run's -ExecCmds list never quits, which leaves the editor hanging.
import { fileURLToPath } from 'node:url';
import { ask, readInput } from './lib.mjs';

const CHECKS = [
  [/\bgit\s+reset\b[^;&|]*--hard/, 'git reset --hard discards uncommitted work'],
  [/\bgit\s+clean\b[^;&|]*\s-[a-zA-Z]*f/, 'git clean -f deletes untracked files'],
  [/\bgit\s+(checkout|restore)\b[^;&|]*\s(--\s+)?\.(\s|$)/, 'discarding all working-tree changes'],
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

export function writesTestFile(command) {
  const stripped = command.replace(STREAM_REDIRECTS, ' ');
  return TEST_PATH.test(stripped) && (WRITES.test(stripped) || psWrites(stripped));
}

export function findRisk(command) {
  if (typeof command !== 'string') return null;
  if (writesTestFile(command)) return 'this command appears to change a test file outside the Edit tool (TEST-001)';
  if (execCmdsWithoutQuit(command)) return 'the editor -ExecCmds list does not end with Quit, so the editor will keep running after its commands finish (add ";Quit")';
  if (isForcedRecursiveRm(command)) return 'recursive forced delete (rm -rf)';
  if (isForcedRecursiveRemoveItem(command)) return 'recursive forced delete (Remove-Item -Recurse -Force)';
  for (const [pattern, reason] of CHECKS) if (pattern.test(command)) return reason;
  return null;
}

async function main() {
  const input = await readInput();
  const risk = findRisk(input?.tool_input?.command);
  if (risk) ask(`rfr-core (WA-003): ${risk}. Approve only if this is intended and the target is not shared.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
