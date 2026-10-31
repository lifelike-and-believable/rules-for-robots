#!/usr/bin/env node
// Records the current hash of each linked section in the named artifacts' derived-from lists
// (docs/specs/project-process.md, "Staleness and what a pull request must do"). Running it is not
// approval: the pull request that carries the new hashes is approved like any other change to a
// gated stage. Links to a missing id or section are left alone and reported.
// Usage: node checks/process-relink.mjs [--root <dir>] <id> [<id> ...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArtifacts, sectionHash, workingTree } from './lib/process.mjs';

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function relink(root, ids) {
  const { artifacts } = loadArtifacts(workingTree(root));
  const byId = new Map(artifacts.filter(a => a.id).map(a => [a.id, a]));
  const result = { changed: [], unchanged: [], problems: [] };
  for (const id of ids) {
    const a = byId.get(id);
    if (!a) { result.problems.push(`${id}: no such artifact`); continue; }
    const file = path.join(root, a.file);
    let text = fs.readFileSync(file, 'utf8');
    const end = text.indexOf('\n---', 4);
    let front = text.slice(0, end);
    let changed = false;
    for (const link of a.links) {
      const target = byId.get(link.target);
      const hash = target ? sectionHash(target.body, link.section) : null;
      if (hash === null) { result.problems.push(`${id}: cannot hash ${link.key} (missing id or section)`); continue; }
      if (hash === link.hash) continue;
      front = front.replace(new RegExp(`^(\\s+-\\s+${escapeRe(link.key)}:)[^\\n]*$`, 'm'), `$1 ${hash}`);
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(file, front + text.slice(end));
      result.changed.push(id);
    } else result.unchanged.push(id);
  }
  return result;
}

function main(argv) {
  const args = [...argv];
  const i = args.indexOf('--root');
  const root = path.resolve(i === -1 ? '.' : args.splice(i, 2)[1]);
  if (!args.length) { console.error('Usage: node checks/process-relink.mjs [--root <dir>] <id> [<id> ...]'); process.exit(2); }
  const r = relink(root, args);
  for (const p of r.problems) console.error(p);
  if (r.changed.length) console.log(`Recorded new hashes in: ${r.changed.join(', ')}`);
  if (r.unchanged.length) console.log(`Already current: ${r.unchanged.join(', ')}`);
  if (r.problems.length) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
