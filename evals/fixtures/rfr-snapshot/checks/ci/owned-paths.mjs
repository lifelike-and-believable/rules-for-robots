#!/usr/bin/env node
// CI owned-paths check (#47): when AGENTS.md lists the paths the project owns
// ("## Owned paths"), fail a change that touches any other path, because the next
// integration from upstream overwrites edits there. Passes with a note when there is no list.
// Usage: node owned-paths.mjs <base-ref>
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isOwned, parseOwnedPaths } from '../lib/owned-paths.mjs';

// agentsText: the contents of AGENTS.md, or null when it does not exist.
export function checkOwnedPaths(agentsText, files) {
  const globs = parseOwnedPaths(agentsText);
  if (!globs) {
    return { ok: true, globs, outside: [], message: 'owned-paths: AGENTS.md has no "## Owned paths" section; nothing to check.' };
  }
  const outside = files.filter(f => !isOwned(f, globs));
  if (!outside.length) return { ok: true, globs, outside, message: `owned-paths: OK (${files.length} changed file(s) inside the owned paths)` };
  const list = outside.map(f => `  ${f}`).join('\n');
  return {
    ok: false, globs, outside,
    message: `owned-paths: this change touches paths outside the "Owned paths" list in AGENTS.md (#47):\n${list}\nThe next integration from upstream overwrites edits there. Use the upstream code's existing public interfaces, and report a missing interface to its owner. If the project does own these paths, add them to the list.`,
  };
}

function main() {
  const [base] = process.argv.slice(2);
  if (!base) { console.error('usage: node owned-paths.mjs <base-ref>'); process.exit(2); }
  const diff = spawnSync('git', ['diff', '--name-only', '--no-renames', `${base}...HEAD`], { encoding: 'utf8' });
  if (diff.status !== 0) { console.error(diff.stderr); process.exit(2); }
  const files = diff.stdout.split('\n').filter(Boolean);
  const agents = fs.existsSync('AGENTS.md') ? fs.readFileSync('AGENTS.md', 'utf8') : null;
  const { ok, message } = checkOwnedPaths(agents, files);
  if (ok) { console.log(message); return; }
  console.error(message);
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
