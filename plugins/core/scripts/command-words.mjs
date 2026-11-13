// Reading a shell command line as the commands it runs, for the guards. Shared by rfr-core's
// guard-commands and rfr-web's guard-cli: the build copies this file and shell-writes.mjs into
// rfr-web, since a plugin's hooks cannot import from another plugin's folder (plugin-split AC-5).
import os from 'node:os';
import path from 'node:path';
import { parseCommand } from './shell-writes.mjs';

// The folder a path written in a shell command names, resolved against base. On Windows, Git Bash
// writes drive C: as /c/ and the user's temp folder as /tmp, which Node's path module would read as
// folders on the current drive; they are mapped first. Native paths (C:\x, C:/x) need nothing.
export function resolveFromShell(base, p, platform = process.platform) {
  if (platform === 'win32') {
    const drive = /^\/([a-zA-Z])(?=\/|$)/.exec(p);
    if (drive) p = `${drive[1].toUpperCase()}:/${p.slice(3)}`;
    else if (p === '/tmp' || p.startsWith('/tmp/')) p = os.tmpdir() + p.slice(4);
  }
  return path.resolve(base, p);
}

// The simple commands of a command line, each with the folder it runs in: the starting folder,
// changed by any cd (or pushd) before it, and by git -C. null when the line cannot be read.
export function commandsWithDirs(command, cwd) {
  const commands = parseCommand(command);
  if (!commands) return null;
  let dir = cwd;
  return commands.map(({ words }) => {
    if ((words[0] === 'cd' || words[0] === 'pushd') && words[1] && !words[1].startsWith('-')) dir = resolveFromShell(dir, words[1].replace(/^~(?=\/|$)/, os.homedir()));
    return { words, dir };
  });
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
    // A word with spaces in it is one quoted argument, such as a commit message that mentions
    // --no-verify: its spaces are joined so the patterns do not read it as separate arguments. A script
    // a shell runs is matched as its own text (unattended AC-7, found replaying a real session).
    const shell = SHELLS.test(words[k] ?? '');
    const joined = words.map((w, i) => (/\s/.test(w) && !(shell && /^-\w*c$/.test(words[i - 1] ?? '')) ? w.replace(/\s+/g, '_') : w)).join(' ');
    return [joined, ...(SHELLS.test(words[k] ?? '') ? scripts : [])].join(' ; ');
  }).join(' ; ');
}

// A simple command's words with what only changes how it runs removed: sudo, command, env, exec,
// and variable assignments before it, and a Windows executable's extension (git.exe, gh.exe,
// vercel.exe are the same commands).
export function commandWords(raw) {
  let words = raw;
  while (words.length && /^(sudo|command|env|exec|\w+=\S*)$/.test(words[0])) words = words.slice(1);
  if (/^(git|gh|vercel|npx|npm|pnpm|yarn|bunx)\.(exe|cmd)$/i.test(words[0] ?? '')) words = [words[0].replace(/\.(exe|cmd)$/i, '').toLowerCase(), ...words.slice(1)];
  return words;
}

// The command substitutions the shell would run in a command line: $(...) and backquotes outside
// single quotes and outside a heredoc whose delimiter is quoted (<<'EOF'), where they are only text.
// A backquoted word in a quoted message (printf 'run `export` here') is not run (found by the
// delegated eval, rewrite plan 25f).
export function liveSubstitutions(command) {
  const text = String(command).replace(/<<-?\s*(['"])(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2[ \t]*(?=\n|$)/g, ' ');
  const found = new Set();
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote === "'") { if (c === "'") quote = null; continue; }
    if (c === '\\') { i++; continue; }
    if (c === '"') { quote = quote === '"' ? null : '"'; continue; }
    if (c === "'" && quote !== '"') { quote = "'"; continue; }
    if (c === '$' && text[i + 1] === '(') {
      let depth = 0;
      let j = i + 1;
      for (; j < text.length; j++) {
        if (text[j] === '(') depth++;
        else if (text[j] === ')' && --depth === 0) break;
      }
      found.add(text.slice(i + 2, j));
      i = j;
    } else if (c === '`') {
      const j = text.indexOf('`', i + 1);
      if (j === -1) break;
      found.add(text.slice(i + 1, j));
      i = j;
    }
  }
  return found;
}

// The command lines a simple command runs inside it, to be checked as lines of their own: a shell's
// script (bash -c '...', pwsh -Command ...) and each command substitution ($(...) or backquotes).
// With the whole command line, a substitution counts only where the shell would run it.
export function innerScripts(words, line = null) {
  const out = [];
  if (/^(bash|sh|zsh|dash|ksh|pwsh|powershell)(\.exe)?$/i.test(words[0] ?? '')) {
    const k = words.findIndex(w => /^(-c|-Command|-command|-EncodedCommand)$/.test(w));
    if (k !== -1) out.push(words[k + 1] ?? '');
  }
  const live = line === null ? null : liveSubstitutions(line);
  for (const w of words) {
    for (const m of w.matchAll(/\$\(([^()]*)\)|`([^`]*)`/g)) {
      const inner = m[1] ?? m[2] ?? '';
      if (!live || live.has(inner)) out.push(inner);
    }
  }
  return out;
}

// The command a package runner runs: npx and bunx with their own flags and a version
// (npx -y vercel@latest), pnpm dlx, pnpm exec, npm exec, and yarn; the version is dropped.
export function runnerTarget(words) {
  if (['npx', 'bunx'].includes(words[0])) {
    let k = 1;
    while (k < words.length && words[k].startsWith('-')) k += /^(-p|--package)$/.test(words[k]) ? 2 : 1;
    words = words.slice(k);
  } else if ((words[0] === 'pnpm' && /^(dlx|exec)$/.test(words[1] ?? '')) || (words[0] === 'npm' && words[1] === 'exec')) words = words.slice(2);
  else if (words[0] === 'yarn' && words[1] && !words[1].startsWith('-') && !/^(install|add|remove|run|test|build|dev|start)$/.test(words[1])) words = words.slice(1);
  if (words.length) words = [words[0].replace(/@[^/]*$/, ''), ...words.slice(1)];
  return words;
}
