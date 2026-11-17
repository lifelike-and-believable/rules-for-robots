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

const NAMED = /(~|\$HOME|\$\{HOME\}|\$env:USERPROFILE|%USERPROFILE%)[\\/]+\.claude[\\/]+rfr\.json(?![\w.-])/i;
const WRITES = /(>>?|\btee\b|\bsed\s+(-[a-zA-Z]*i|--in-place)|\bperl\s+-[a-zA-Z]*i|\bmv\b|\bcp\b|\brm\b|\btruncate\b|\b(Set-Content|Add-Content|Out-File|Move-Item|Copy-Item|Remove-Item|Rename-Item|Clear-Content|New-Item)\b|writeFile|write_text|\.write\()/i;

// Whether a shell command writes, moves, copies over, or deletes the person's settings file.
export function commandWritesSettings(command, { cwd = process.cwd(), home = os.homedir() } = {}) {
  if (typeof command !== 'string') return false;
  const escaped = settingsFile({ home }).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\\|\//g, '[\\\\/]+');
  const named = NAMED.test(command) || new RegExp(`${escaped}(?![\\w.-])`, 'i').test(command);
  // PowerShell, and a line the shell parser cannot read: the file named anywhere, with a write.
  const entries = writeTargetEntries(command);
  if (entries === null || /\b(Set-Content|Add-Content|Out-File|Move-Item|Copy-Item|Remove-Item|Rename-Item|Clear-Content|New-Item)\b/i.test(command)) {
    if (named && WRITES.test(command)) return true;
    if (entries === null) return false;
  }
  const dirs = commandFolders(command, cwd, home);
  return entries.some(e => dirs.some(dir => isPersonSettings(e.path, { cwd: dir, home })));
}
