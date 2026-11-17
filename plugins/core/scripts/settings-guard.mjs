// The person's own settings file, ~/.claude/rfr.json, lists their freestyle folders, where every rfr
// guard is off (docs/specs/freestyle.md, AC-4). An agent that could write it could free any folder,
// so outside freestyle folders rfr-core refuses a write to it through the file tools
// (guard-owned-paths) or a shell command (guard-commands). Reading it is allowed, and a project's own
// .claude/rfr.json is a different file.
import os from 'node:os';
import path from 'node:path';
import { canonical, refuseReason } from './lib.mjs';
import { settingsFile } from './freestyle-lib.mjs';
import { parseCommand, writeTargetEntries } from './shell-writes.mjs';

export const settingsReason = refuseReason({
  source: 'rfr-core (freestyle)',
  action: "~/.claude/rfr.json is the person's own settings file, which lists their freestyle folders, so agents do not change it",
  next: 'Leave it as it is: tell them what to change in it and why, and they make the change themselves',
});

const fold = p => (process.platform === 'win32' || process.platform === 'darwin' ? p.toLowerCase() : p);

// A path as the shell would expand its home folder prefix: ~, $HOME, ${HOME}, and on Windows
// $env:USERPROFILE and %USERPROFILE%.
export function expandHome(p, home = os.homedir()) {
  const m = /^(~|\$HOME|\$\{HOME\}|\$env:USERPROFILE|%USERPROFILE%)(?=[\\/]|$)/i.exec(p);
  return m ? home + p.slice(m[0].length) : p;
}

// Whether file, written as a tool or command names it and resolved from cwd, is the person's
// settings file.
export function isPersonSettings(file, { cwd = process.cwd(), home = os.homedir() } = {}) {
  if (typeof file !== 'string' || !file) return false;
  const target = fold(canonical(path.resolve(cwd, expandHome(file, home))));
  return target === fold(canonical(settingsFile({ home })));
}

// Every folder a command line runs a command in: the starting folder and each one cd or pushd
// moves to. A relative write target is checked against each, which errs on the side of refusing.
function commandFolders(command, cwd, home) {
  const dirs = [cwd];
  let dir = cwd;
  for (const { words } of parseCommand(command) ?? []) {
    if ((words[0] === 'cd' || words[0] === 'pushd') && words[1] && !words[1].startsWith('-')) {
      dir = path.resolve(dir, expandHome(words[1], home));
      dirs.push(dir);
    }
  }
  return dirs;
}

const HOME_PREFIX = /(~|\$HOME|\$\{HOME\}|\$env:USERPROFILE|%USERPROFILE%)/.source;
const NAMED = new RegExp(`${HOME_PREFIX}[\\\\/]+\\.claude[\\\\/]+rfr\\.json(?![\\w.-])`, 'i');
const POWERSHELL = /\b(Set-Content|Add-Content|Out-File|Move-Item|Copy-Item|Remove-Item|Rename-Item|Clear-Content|New-Item)\b/i;
// A write anywhere on a line that names the file. The shell parser cannot follow a write inside an
// interpreter's code, so a line that names the file and has any of these is refused; reading the
// file and redirecting the result elsewhere is refused with it. Copying the file elsewhere is not:
// cp is in the list only for lines the parser cannot read, since it reads cp's operands itself.
const WRITE_WORDS = [
  />>?/, /\btee\b/, /\bsed\s+(-[a-zA-Z]*i|--in-place)/, /\bperl\s+-[a-zA-Z]*i/, /\bmv\b/, /\brm\b/, /\btruncate\b/,
  /\bln\b/, /\blink\b/, POWERSHELL,
  /writeFile|write_text|write_bytes|\.write\(|createWriteStream|copyFile|\b(?:unlink|rename|rm|truncate)(?:Sync)?\s*\(/,
  /\bopen\s*\(.*?,\s*(?:mode\s*=\s*)?['"][rbt]*[wax][+bt]*['"]/, /\bshutil\.\w+\s*\(/, /\bos\.(?:remove|unlink|rename|replace|truncate)\s*\(/,
];
const WRITES = new RegExp(WRITE_WORDS.map(r => r.source).join('|'), 'i');
const WRITES_OR_CP = new RegExp(`${WRITES.source}|\\bcp\\b`, 'i');

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A path as a regular expression that takes either slash, and any number of them, between parts.
const anySlash = p => escapeRe(p).replace(/\\\\|\//g, '[\\\\/]+');

// The command with each mention of ~/.claude (or ~/.claude/rfr.json), by the home prefix or the
// absolute path, written with forward slashes. On Windows a bash command can name the file as
// C:\Users\...\rfr.json, which the shell parser would read as escapes.
function forwardSlashes(command, home) {
  const mention = new RegExp(`(?:${HOME_PREFIX}|${anySlash(home)})[\\\\/]+\\.claude(?:[\\\\/]+rfr\\.json)?(?![\\w.-])`, 'gi');
  return command.replace(mention, m => m.replace(/\\/g, '/'));
}

// How a path, as a command names it and resolved from cwd, relates to the settings file: 'file',
// 'dir' (~/.claude), or null. A folder above ~/.claude (the home folder, /) is left to the never
// list, which already asks before deleting it.
function relation(file, { cwd, home }) {
  if (typeof file !== 'string' || !file) return null;
  const target = fold(canonical(path.resolve(cwd, expandHome(file, home))));
  const settings = fold(canonical(settingsFile({ home })));
  const claude = path.dirname(settings);
  if (target === settings) return 'file';
  return target === claude ? 'dir' : null;
}

const PREFIXES = new Set(['sudo', 'command', 'env', 'time', 'nohup', 'exec', 'nice', 'builtin', 'xargs']);
const EXEC_WRITES = /^(rm|mv|cp|ln|tee|truncate|shred|unlink|dd|sed|perl|install|rsync|bash|sh|zsh|dash|ksh|python[\d.]*|node|ruby)$/;
const RECURSIVE = /^(-[a-zA-Z]*[rRa][a-zA-Z]*|--recursive|--archive)$/;

// Whether one simple command links, copies, moves, removes, or downloads in a way that reaches the
// settings file through ~/.claude, which the write targets alone do not show:
// a link to or of the file or ~/.claude, ~/.claude itself moved or deleted, a copy into ~/.claude of a file named rfr.json or of a whole folder, and curl or wget
// saving to the file.
function reachesSettings(words, at) {
  let k = 0;
  while (k < words.length && (PREFIXES.has(words[k]) || /^\w+=/.test(words[k]) || (k > 0 && PREFIXES.has(words[k - 1]) && words[k].startsWith('-')))) k++;
  const cmd = (words[k] ?? '').split(/[\\/]/).pop();
  const args = words.slice(k + 1);
  const ops = args.filter(a => !a.startsWith('-'));
  const rel = at;
  if (cmd === 'ln' || cmd === 'link') return args.some(a => ['file', 'dir'].includes(rel(a)));
  if (['rm', 'rmdir', 'unlink', 'shred'].includes(cmd)) return ops.some(a => ['file', 'dir'].includes(rel(a)));
  if (cmd === 'find') {
    // The folders find starts from come before its first test or action.
    const first = args.findIndex(a => a.startsWith('-') || a === '(' || a === '!');
    const roots = first === -1 ? args : args.slice(0, first);
    const removes = args.includes('-delete') || args.some((a, i) => ['-exec', '-execdir', '-ok', '-okdir'].includes(a) && EXEC_WRITES.test((args[i + 1] ?? '').split('/').pop()));
    return removes && roots.some(a => ['file', 'dir'].includes(rel(a)));
  }
  if (['cp', 'mv', 'install', 'rsync'].includes(cmd)) {
    const t = args.findIndex(a => a === '-t' || a === '--target-directory' || a.startsWith('--target-directory='));
    let dest = null;
    let sources = ops;
    if (t !== -1) {
      dest = args[t].includes('=') ? args[t].split('=').slice(1).join('=') : args[t + 1];
      sources = ops.filter(a => a !== dest);
    } else if (ops.length > 1) {
      dest = ops[ops.length - 1];
      sources = ops.slice(0, -1);
    }
    const to = dest === null ? null : rel(dest);
    if (to === 'file') return true;
    if (to === 'dir') {
      if (cmd === 'mv' || cmd === 'rsync') return true;
      if (args.some(a => RECURSIVE.test(a))) return true;
      if (sources.some(s => s.replace(/[\\/]+$/, '').split(/[\\/]/).pop().toLowerCase() === 'rfr.json')) return true;
    }
    // Moving ~/.claude, or the file, away; rsync deleting its sources.
    if (cmd === 'mv' && sources.some(s => ['file', 'dir'].includes(rel(s)))) return true;
    if (cmd === 'rsync' && args.includes('--remove-source-files') && sources.some(s => ['file', 'dir'].includes(rel(s)))) return true;
    return false;
  }
  if (cmd === 'curl') {
    for (let a = 0; a < args.length; a++) {
      const m = /^(-o|--output|--output-dir)(?:=(.*))?$/.exec(args[a]) ?? /^-o(.+)$/.exec(args[a]);
      if (!m) continue;
      const value = m[2] ?? (m[1].startsWith('-') ? args[a + 1] : m[1]);
      const r = rel(value);
      if (r === 'file' || (m[1] === '--output-dir' && r === 'dir')) return true;
    }
    return false;
  }
  if (cmd === 'wget') {
    for (let a = 0; a < args.length; a++) {
      const m = /^(-O|--output-document|-P|--directory-prefix)(?:=(.*))?$/.exec(args[a]) ?? /^-([OP])(.+)$/.exec(args[a]);
      if (!m) continue;
      const flag = m[1].length === 1 ? `-${m[1]}` : m[1];
      const value = m[2] ?? args[a + 1];
      const r = rel(value);
      if (r === 'file' || (/^(-P|--directory-prefix)$/.test(flag) && r === 'dir')) return true;
    }
    return false;
  }
  return false;
}

// Every simple command on the line, with those in bash -c strings and heredocs fed to a shell.
function simpleCommands(command, depth = 0) {
  const parsed = parseCommand(command);
  if (!parsed) return null;
  const out = [];
  for (const c of parsed) {
    out.push(c.words);
    const i = c.words.findIndex(w => /^(bash|sh|zsh|dash|ksh)$/.test(w.split('/').pop()));
    if (i === -1 || depth >= 3) continue;
    const flag = c.words.indexOf('-c', i);
    for (const inner of [...(flag !== -1 && c.words[flag + 1] ? [c.words[flag + 1]] : []), ...c.scripts]) {
      const nested = simpleCommands(inner, depth + 1);
      if (nested) out.push(...nested);
    }
  }
  return out;
}

// Whether a shell command writes, moves, copies over, links, or deletes the person's settings file.
export function commandWritesSettings(command, { cwd = process.cwd(), home = os.homedir() } = {}) {
  if (typeof command !== 'string') return false;
  const named = NAMED.test(command) || new RegExp(`${anySlash(settingsFile({ home }))}(?![\\w.-])`, 'i').test(command);
  const line = forwardSlashes(command, home);
  const entries = writeTargetEntries(line);
  // A line that names the file and writes anywhere (AC-4). PowerShell, and a line the shell parser
  // cannot read, count cp too.
  if (named && (entries === null || POWERSHELL.test(command) ? WRITES_OR_CP : WRITES).test(command)) return true;
  if (entries === null) return false;
  const dirs = commandFolders(line, cwd, home);
  if (entries.some(e => dirs.some(dir => isPersonSettings(e.path, { cwd: dir, home })))) return true;
  const at = p => dirs.map(dir => relation(p, { cwd: dir, home })).find(r => r !== null) ?? null;
  return (simpleCommands(line) ?? []).some(words => reachesSettings(words, at));
}
