#!/usr/bin/env node
// PreToolUse (Bash): ask the user before destructive git, file, and database commands
// (rules WA-003 and, for databases, the node-services pack). Asking keeps the user in
// control without blocking legitimate use; headless runs treat "ask" as a denial.
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

// A shell command that writes to, moves, or deletes a test file: redirection, in-place
// editors, scripts that open files for writing, and file moves (TEST-001). Edits through
// the Edit and Write tools are handled by guard-test-edits.
const TEST_PATH = /(\.(test|spec)\.\w+|(^|[\s/'"=])(test|tests|Tests|__tests__|__snapshots__|e2e)\/[\w./-]+\.\w+)/;
const WRITES = /(>>?|\btee\b|\bsed\s+(-[a-zA-Z]*i|--in-place)|\bperl\s+-[a-zA-Z]*i|\bmv\b|\bcp\b|\brm\b|\btruncate\b|open\([^)]*['"][wa]['"]|writeFile|write_text|\.write\()/;

export function writesTestFile(command) {
  return TEST_PATH.test(command) && WRITES.test(command);
}

export function findRisk(command) {
  if (typeof command !== 'string') return null;
  if (writesTestFile(command)) return 'this command appears to change a test file outside the Edit tool (TEST-001)';
  if (isForcedRecursiveRm(command)) return 'recursive forced delete (rm -rf)';
  for (const [pattern, reason] of CHECKS) if (pattern.test(command)) return reason;
  return null;
}

async function main() {
  const input = await readInput();
  const risk = findRisk(input?.tool_input?.command);
  if (risk) ask(`rfr-core (WA-003): ${risk}. Approve only if this is intended and the target is not shared.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
