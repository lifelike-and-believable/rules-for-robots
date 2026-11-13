// Organised user documentation (docs/specs/lasting-tutorials.md, AC-16 to AC-18). User
// documentation lives in docs/user/: one start page, docs/user/README.md; one folder for each area of
// the product, docs/user/<area>/, with an overview, docs/user/<area>/README.md; and every other page
// inside an area's folder, at any depth. Used by the process check and by checks/docs-map.mjs.
// Dependency-free.
import { markdownLinks, parseArtifact } from './process.mjs';

export const USER_DOCS = 'docs/user';
export const START_PAGE = `${USER_DOCS}/README.md`;
// readme.md and Readme.md are the same page to a reader, and the same file on Windows and macOS.
const isReadme = name => name.toLowerCase() === 'readme.md';

const isApproved = status => status === 'approved' || status === 'implemented';

// Sorts the .md files under docs/user/ (repository paths) into the start page, the pages directly in
// docs/user/ (loose), and the areas. An area is an immediate subfolder of docs/user/ that holds any
// .md file at any depth; its overview is the README.md directly in it, and every other file below it
// is one of its pages, including a README.md in a subfolder.
export function userDocsLayout(files) {
  let start = null;
  const loose = [];
  const areas = new Map();
  for (const file of [...files].map(f => f.replace(/\\/g, '/')).sort()) {
    if (!file.startsWith(`${USER_DOCS}/`) || !file.endsWith('.md')) continue;
    const parts = file.slice(USER_DOCS.length + 1).split('/');
    if (parts.length === 1) { if (isReadme(parts[0])) start = file; else loose.push(file); continue; }
    if (!areas.has(parts[0])) areas.set(parts[0], { name: parts[0], overview: null, pages: [] });
    const area = areas.get(parts[0]);
    if (parts.length === 2 && isReadme(parts[1])) area.overview = file;
    else area.pages.push(file);
  }
  return { start, loose, areas: [...areas.values()] };
}

// The repository paths of the .md files a file links to, in the order they first appear. Links are
// read as for a tutorial's "Try it" link (lasting-tutorials AC-9), from the body after front matter.
export function linksFrom(text, file) {
  // A link may be written with %20 for a space in a folder or file name; compare the decoded path too.
  const decoded = t => { try { return decodeURIComponent(t); } catch { return t; } };
  return [...new Set(markdownLinks(parseArtifact(text ?? '').body ?? '', file).flatMap(l => [l.target, decoded(l.target)]))];
}

// What a user documentation page covers (AC-18): "covers: [/projects/{id}/board, Export panel]" in
// its front matter, or "covers:" followed by "- entry" lines, indented or not. Each entry is free text
// on one line, compared exactly after trimming. Returns { covers, error }: covers is null when the
// line is absent, and error says what is wrong with a value that cannot be read.
//
// A "#" that follows a space or tab, outside quotes, starts a comment, as in YAML; any other "#" is
// part of the entry, so "/settings#profile" keeps it. An entry in single or double quotes is taken
// as written, so "/help #keys" keeps its "#", and a quoted entry may hold a comma or a "]".
export function coversOf(text) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text ?? '')?.[1] ?? '';
  const lines = front.split(/\r?\n/);
  const at = lines.findIndex(l => /^covers:/.test(l));
  if (at === -1) return { covers: null, error: null };
  const how = 'list where in the product the page applies, like covers: [/projects/{id}/board, Export panel]';
  const value = lines[at].slice('covers:'.length);
  const start = skipSpace(value, 0);
  const covers = [];
  if (start === value.length || isComment(value, start)) {
    for (const line of lines.slice(at + 1)) {
      const item = /^\s*-(?:\s+|$)/.exec(line);
      if (!item) break;
      const read = readEntry(line, item[0].length, '');
      if (read.error || !restIsEmpty(line, read.i)) return { covers: null, error: `covers: cannot read the entry "${line.trim()}"; ${how}` };
      covers.push(read.entry);
    }
    if (!covers.length) return { covers: null, error: `covers: names nothing; ${how}, or remove the line` };
  } else if (value[start] === '[') {
    let i = start + 1;
    for (;;) {
      i = skipSpace(value, i);
      if (value[i] === ']') break;
      const read = readEntry(value, i, ',]');
      if (read.error) return { covers: null, error: `covers: ${read.error}; ${how}` };
      covers.push(read.entry);
      i = skipSpace(value, read.i);
      if (value[i] === ',') { i++; continue; }
      if (value[i] === ']') break;
      return { covers: null, error: `covers: cannot read "${value.trim()}"; ${how}` };
    }
    if (!restIsEmpty(value, i + 1)) return { covers: null, error: `covers: cannot read "${value.trim()}"; ${how}` };
  } else {
    return { covers: null, error: `covers: "${readEntry(value, start, '').entry}" is not a list; ${how}` };
  }
  return { covers: [...new Set(covers.filter(Boolean))], error: null };
}

const skipSpace = (s, i) => { while (i < s.length && /[ \t]/.test(s[i])) i++; return i; };
const isComment = (s, i) => s[i] === '#' && (i === 0 || /[ \t]/.test(s[i - 1]));
const restIsEmpty = (s, i) => { const j = skipSpace(s, i); return j === s.length || isComment(s, j); };

// One entry starting at i: a quoted string, or plain text up to one of `stops` or a comment.
function readEntry(s, i, stops) {
  if (s[i] === '"' || s[i] === "'") {
    const end = s.indexOf(s[i], i + 1);
    if (end === -1) return { error: `the entry starting ${s.slice(i)} has no closing quote` };
    return { entry: s.slice(i + 1, end).trim(), i: end + 1 };
  }
  let j = i;
  while (j < s.length && !stops.includes(s[j]) && !isComment(s, j)) j++;
  return { entry: s.slice(i, j).trim(), i: j };
}

// Problems with the shape of the user documentation (AC-16), with what reaches what (AC-17), and
// with covers: (AC-18). `files` lists the .md files under docs/user/; `read(file)` returns a file's
// text. Returns { shape, covers }, each a list of { id, message }: id is the page's id, or null.
// The caller decides whether shape problems are errors or warnings (the lasting setting, AC-15);
// covers problems are always errors, because covers: is new and opt-in.
export function userDocsProblems(files, read) {
  const shape = [];
  const coversProblems = [];
  const layout = userDocsLayout(files);
  const pages = new Map();
  const info = file => {
    if (!pages.has(file)) {
      const text = read(file);
      const front = parseArtifact(text).front;
      pages.set(file, { id: front?.id ?? null, status: front?.status ?? null, links: linksFrom(text, file), covers: coversOf(text) });
    }
    return pages.get(file);
  };
  // The shape is checked once a project has started it, by writing a start page or an area's
  // overview. Before that, docs/user/ is as it was kept before AC-16: flat, or with pages in folders
  // of its own choosing, as existing projects and fixtures have it. The setup skill writes the start
  // page, so a new project starts in the shape.
  const organised = !!layout.start || layout.areas.some(a => a.overview);

  // AC-16: the start page, no loose pages, and an overview in each area.
  if (organised && !layout.start) shape.push({ id: null, message: `${START_PAGE} is missing; add the start page there: say what the product is, list its areas in the order a user meets them with a link to each area's overview, and give each persona a place to start` });
  for (const file of organised ? layout.loose : []) {
    shape.push({ id: info(file).id, message: `${file} is directly in ${USER_DOCS}/; move it into the folder of the area it belongs to (${USER_DOCS}/<area>/), and link it from that area's README.md. Its id stays the same, so no derived-from link breaks` });
  }
  for (const area of organised ? layout.areas : []) {
    if (!area.overview) shape.push({ id: null, message: `${USER_DOCS}/${area.name}/ has no README.md; add an overview there that says what the area is for and who uses it, and links to each of its pages in the order a user needs them` });
  }

  // AC-17: an approved overview is linked from the start page, and an approved page from its area's
  // overview. A draft is not checked. Where the start page or an overview is missing, AC-16 has
  // already said so, and what it would link to is not reported again.
  const fromStart = new Set(layout.start ? info(layout.start).links : []);
  for (const area of layout.areas) {
    if (!area.overview) continue;
    const overview = info(area.overview);
    if (layout.start && isApproved(overview.status) && !fromStart.has(area.overview)) {
      shape.push({ id: overview.id, message: `${overview.id ?? area.overview}: the start page, ${START_PAGE}, does not link to ${area.overview}; add the area there with a link to its overview file (written inline, like [Board](board/README.md)), in the order a user meets it, so readers can reach it` });
    }
    const listed = new Set(overview.links);
    for (const file of area.pages) {
      const page = info(file);
      if (isApproved(page.status) && !listed.has(file)) {
        shape.push({ id: page.id, message: `${page.id ?? file}: its area's overview, ${area.overview}, does not link to ${file}; add a link to the page's file there (written inline, like [Move a card](move-card.md)), with one line saying what it is for, so readers can reach it` });
      }
    }
  }

  // AC-18: each covers entry can be read, and belongs to one page.
  const owner = new Map();
  for (const file of [layout.start, ...layout.loose, ...layout.areas.flatMap(a => [a.overview, ...a.pages])].filter(Boolean)) {
    const page = info(file);
    if (page.covers.error) { coversProblems.push({ id: page.id, message: `${page.id ?? file}: ${page.covers.error}` }); continue; }
    for (const entry of page.covers.covers ?? []) {
      if (!owner.has(entry)) { owner.set(entry, file); continue; }
      coversProblems.push({ id: page.id, message: `covers: "${entry}" is in both ${owner.get(entry)} and ${file}; each place in the product has one page, so keep the entry in the page that documents it and remove it from the other` });
    }
  }
  return { shape, covers: coversProblems };
}
