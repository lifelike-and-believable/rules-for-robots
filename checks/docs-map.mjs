#!/usr/bin/env node
// Map of the user documentation (docs/specs/lasting-tutorials.md, AC-18). Prints docs/user/ as a
// tree: the start page's title; each area in the order the start page links its overview (areas it
// does not link come last, alphabetically, marked); each area's pages in the order its overview links
// them (pages it does not link come last, marked); and under each page what it covers and the
// tutorials it links to. Pages directly in docs/user/, which belong in an area, are listed last.
// With --json it prints the same as data, for a project's help to be built from and its help link to
// read:
//   { start: { title, file } | null,
//     areas: [{ name, title, file, linked,
//               pages: [{ id, title, file, status, covers: [...], linked, tutorials: [{ title, file }] }] }] }
// An area with no overview has file and title null; the pages directly in docs/user/ come as a last
// area whose name is null. It reads files only: no network call, and it writes nothing.
// Usage: node checks/docs-map.mjs [project root] [--json]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArtifact, tutorialTitle, workingTree } from './lib/process.mjs';
import { USER_DOCS, coversOf, linksFrom, userDocsLayout } from './lib/user-docs.mjs';

const TUTORIALS = 'docs/tutorials/';
const isApproved = status => status === 'approved' || status === 'implemented';

// Orders files by where they first appear in `links`; the ones not linked come last, by file.
function inLinkOrder(files, links, key = f => f) {
  const at = f => { const i = links.indexOf(key(f)); return i === -1 ? Infinity : i; };
  return [...files].sort((a, b) => at(a) - at(b) || String(key(a)).localeCompare(String(key(b))));
}

export function docsMap(root) {
  const tree = workingTree(root);
  const layout = userDocsLayout(tree.listDir(USER_DOCS));
  const read = file => { try { return tree.read(file); } catch { return null; } };
  const linksOf = file => (file ? linksFrom(read(file), file) : []);

  const page = (file, listed) => {
    const text = read(file);
    const front = parseArtifact(text).front;
    const tutorials = linksOf(file).filter(f => f.startsWith(TUTORIALS)).map(f => ({ title: tutorialTitle(read(f)), file: f }));
    return { id: front?.id ?? null, title: tutorialTitle(text), file, status: front?.status ?? null, covers: coversOf(text).covers ?? [], linked: listed.includes(file), tutorials };
  };

  const fromStart = linksOf(layout.start);
  const areas = inLinkOrder(layout.areas, fromStart, a => a.overview ?? `${USER_DOCS}/${a.name}/`)
    .map(area => {
      const listed = linksOf(area.overview);
      return {
        name: area.name,
        title: area.overview ? tutorialTitle(read(area.overview)) : null,
        file: area.overview,
        linked: !!area.overview && fromStart.includes(area.overview),
        pages: inLinkOrder(area.pages, listed).map(f => page(f, listed)),
      };
    });
  if (layout.loose.length) areas.push({ name: null, title: null, file: null, linked: false, pages: layout.loose.map(f => page(f, [])) });

  return { start: layout.start ? { title: tutorialTitle(read(layout.start)), file: layout.start } : null, areas };
}

// The map as an indented tree, two spaces a level.
export function renderMap(map) {
  if (!map.start && !map.areas.length) return `No user documentation: ${USER_DOCS}/ has no pages.`;
  const lines = [map.start ? `${map.start.title ?? '(no title)'} (${map.start.file})` : `(no start page: ${USER_DOCS}/README.md is missing)`];
  for (const area of map.areas) {
    if (area.name === null) lines.push(`  Not in an area (move these into an area's folder)`);
    else lines.push(`  ${area.title ?? area.name} (${area.file ?? `${USER_DOCS}/${area.name}/, which has no README.md`})${area.linked ? '' : ' [not linked from the start page]'}`);
    for (const p of area.pages) {
      const marks = [isApproved(p.status) ? '' : ` [${p.status ?? 'no status'}]`, p.linked || area.name === null ? '' : ' [not linked from the overview]'].join('');
      lines.push(`    ${p.title ?? p.file} (${p.file})${marks}`);
      if (p.covers.length) lines.push(`      covers: ${p.covers.join('; ')}`);
      for (const t of p.tutorials) lines.push(`      tutorial: ${t.title ?? t.file} (${t.file})`);
    }
  }
  return lines.join('\n');
}

function main(argv) {
  const args = argv.filter(a => a !== '--json');
  const json = args.length !== argv.length;
  const map = docsMap(path.resolve(args[0] ?? '.'));
  console.log(json ? JSON.stringify(map, null, 2) : renderMap(map));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
