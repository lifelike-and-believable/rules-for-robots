#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit|NotebookEdit): when the project's AGENTS.md lists the
// paths it owns ("## Owned paths"), refuse, with a next step (guard tiers tier 2), an edit to a file in the project that
// is not on the list (#47). Upstream code changed downstream is overwritten at the next
// integration, and the agent can act on the refusal itself. Files outside the project, and projects without the list, are left alone.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deny, readInput, refuseReason } from './lib.mjs';
import { isOwned, parseOwnedPaths } from './owned-paths.mjs';

// Returns the project-relative path when the edit needs approval, otherwise null.
export function outsideOwnedPaths(file, projectDir, cwd = projectDir) {
  if (typeof file !== 'string' || !file) return null;
  const agents = path.join(projectDir, 'AGENTS.md');
  if (!fs.existsSync(agents)) return null;
  const globs = parseOwnedPaths(fs.readFileSync(agents, 'utf8'));
  if (!globs) return null;
  const rel = path.relative(path.resolve(projectDir), path.resolve(cwd, file));
  if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
  return isOwned(rel, globs) ? null : rel.replace(/\\/g, '/');
}

export const ownedPathsReason = rel => refuseReason({
  source: 'rfr-core (owned paths, #47)',
  action: `${rel} is not in the "Owned paths" list in AGENTS.md, so the next integration would overwrite this edit`,
  next: 'Use upstream code only through its existing public interfaces. If the interface you need is missing, stop and report the missing interface so its owner can add it. If this project does own the file, add it to "Owned paths" in AGENTS.md and say so in your report',
});

async function main() {
  const input = await readInput();
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input?.cwd ?? process.cwd();
  const file = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
  const rel = outsideOwnedPaths(file, projectDir, input?.cwd ?? projectDir);
  if (rel) {
    deny(ownedPathsReason(rel));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
