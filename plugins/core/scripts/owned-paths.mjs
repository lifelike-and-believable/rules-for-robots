// Owned-paths list (#47): a project that receives integrations from upstream lists the paths
// it owns in AGENTS.md, under a "## Owned paths" heading, as a bullet list of backticked
// globs:
//
//   ## Owned paths
//
//   - `Plugins/MyPlugin/**`
//   - `docs/`            (a trailing / means everything under that folder)
//
// Used by the guard-owned-paths hook and by checks/ci/owned-paths.mjs. It lives in the
// plugin because an installed plugin cannot import from outside its own folder;
// checks/lib/owned-paths.mjs re-exports it.
import path from 'node:path';

// Globs listed under "## Owned paths", or null when there is no such section. The section
// runs to the next heading of level 1 or 2; subheadings inside it are allowed.
export function parseOwnedPaths(text) {
  if (typeof text !== 'string') return null;
  let inFence = false;
  let inSection = false;
  let globs = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      if (/^owned paths$/i.test(heading[2]) && heading[1].length === 2) { inSection = true; globs ??= []; continue; }
      if (heading[1].length <= 2) inSection = false;
      continue;
    }
    if (!inSection) continue;
    const item = /^\s*[-*+]\s+`([^`]+)`/.exec(line);
    if (item) globs.push(item[1].trim());
  }
  return globs;
}

// file: a path relative to the project root, with / or \ separators.
export function isOwned(file, globs) {
  const rel = file.replace(/\\/g, '/').replace(/^\.\//, '');
  return globs.some(glob => {
    const g = glob.replace(/^\.\//, '');
    return path.posix.matchesGlob(rel, g.endsWith('/') ? `${g}**` : g);
  });
}
