// Mock-up images (docs/specs/revisions-and-foundations.md, AC-16, D5). A design's mock-ups are HTML
// pages under docs/design/ rendered to PNGs beside them by checks/mockup-render.mjs, which records in
// each folder's .rendered.json what every PNG was rendered from:
//   { "<png file name>": { "source": "<html file name>", "width": n, "height": n,
//                          "inputs": { "<repo-relative path>": "<sha256 hex>" } } }
// The process check compares those hashes with the files as they are now, so a style change that
// leaves an image out of date fails, with no browser. Used by the renderer and the process check.
// Dependency-free: nothing here may load Playwright.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const DESIGN = 'docs/design';
export const RECORD = '.rendered.json';
export const DESKTOP = { width: 1280, height: 800 };
// 320 CSS pixels wide: the width WCAG 2.2's reflow criterion (1.4.10) is checked at.
export const PHONE = { width: 320, height: 640 };
export const RENDER_COMMAND = 'node .rfr/checks/mockup-render.mjs';

const TEXT = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.svg', '.json', '.txt', '.xml', '.md', '.csv']);
const SKIP = new Set(['node_modules']);
const toPosix = p => p.split(path.sep).join('/');
// A folder with a space in its name is quoted in the command a message suggests.
const shellArg = p => (/\s/.test(p) ? `"${p}"` : p);
export const renderCommand = folder => `${RENDER_COMMAND} ${shellArg(folder)}`;

// SHA-256 of a file's bytes. For text files a CRLF pair counts as LF, so a checkout on Windows and
// one on Linux give the same hash.
export function hashFile(file) {
  let buf = fs.readFileSync(file);
  if (TEXT.has(path.extname(file).toLowerCase()) && buf.includes(13)) {
    const out = Buffer.alloc(buf.length);
    let n = 0;
    for (let i = 0; i < buf.length; i++) if (!(buf[i] === 13 && buf[i + 1] === 10)) out[n++] = buf[i];
    buf = out.subarray(0, n);
  }
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Every folder under docs/design/ (repository paths, sorted), with the names of the files in it.
export function designFolders(root) {
  const out = [];
  const walk = rel => {
    let entries;
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return; }
    const files = entries.filter(e => e.isFile()).map(e => e.name).sort();
    out.push({ folder: rel, files });
    for (const e of entries.filter(x => x.isDirectory() && !x.name.startsWith('.') && !SKIP.has(x.name)).sort((a, b) => (a.name < b.name ? -1 : 1))) walk(`${rel}/${e.name}`);
  };
  walk(DESIGN);
  return out;
}

// The HTML page a PNG is rendered from, by name: <page>.png is <page>.html at desktop size, and
// <page>-phone.png is <page>.html at phone size when there is no <page>-phone.html. Returns
// { source, size } or null when the PNG has no HTML source (a hand-made image, a design tool's export).
export function sourceOf(png, files) {
  if (!png.toLowerCase().endsWith('.png')) return null;
  const base = png.slice(0, -4);
  if (files.includes(`${base}.html`)) return { source: `${base}.html`, size: DESKTOP };
  const phone = /^(.+)-phone$/.exec(base);
  if (phone && files.includes(`${phone[1]}.html`)) return { source: `${phone[1]}.html`, size: PHONE };
  return null;
}

// The local files a page references, as references written in it: href on <link> (stylesheets,
// icons) and src on any element (scripts, images, frames), and url(...) and @import in its <style>
// elements and style attributes. Links between pages (<a href>) are not inputs.
function pageRefs(html) {
  const refs = [];
  for (const tag of html.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
    const name = tag[1].toLowerCase();
    for (const attr of tag[2].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
      const key = attr[1].toLowerCase();
      const value = attr[2] ?? attr[3] ?? attr[4];
      if (key === 'src' || (key === 'href' && name === 'link')) refs.push(value);
      if (key === 'style') refs.push(...cssRefs(value));
    }
  }
  for (const style of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) refs.push(...cssRefs(style[1]));
  return refs;
}

function cssRefs(css) {
  const refs = [];
  for (const m of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))\s*\)/gi)) refs.push(m[1] ?? m[2] ?? m[3]);
  for (const m of css.matchAll(/@import\s+(["'])(.*?)\1/gi)) refs.push(m[2]);
  return refs;
}

// A reference resolved against the file that makes it, as a repository path, or null when it is not
// a local file inside the repository: a URL with a scheme (http:, data:), a path from the root of the
// disk, a bare fragment, a file outside the repository, or one that does not exist.
function resolveRef(root, from, ref) {
  const raw = (ref ?? '').trim();
  if (!raw || raw.startsWith('#') || raw.startsWith('/') || raw.startsWith('\\') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  let clean = raw.replace(/[?#].*$/, '');
  try { clean = decodeURIComponent(clean); } catch { /* keep it as written */ }
  if (!clean) return null;
  const abs = path.resolve(path.dirname(from), clean);
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  try { if (!fs.statSync(abs).isFile()) return null; } catch { return null; }
  return toPosix(rel);
}

// The inputs of a page, as repository paths, sorted: the HTML itself, every local file it references,
// and the files its local stylesheets reference with url(...) or @import. Stylesheets are followed one
// level only: a stylesheet imported by a stylesheet is an input, but what that one references is not.
// That is enough for a shared wireframe or token file and keeps the reading simple.
export function pageInputs(root, htmlFile) {
  const abs = path.resolve(root, htmlFile);
  const inputs = new Set([toPosix(path.relative(root, abs))]);
  const html = fs.readFileSync(abs, 'utf8');
  for (const ref of pageRefs(html)) {
    const rel = resolveRef(root, abs, ref);
    if (!rel) continue;
    inputs.add(rel);
    if (rel.toLowerCase().endsWith('.css')) {
      const cssFile = path.join(root, rel);
      for (const inner of cssRefs(fs.readFileSync(cssFile, 'utf8'))) {
        const innerRel = resolveRef(root, cssFile, inner);
        if (innerRel) inputs.add(innerRel);
      }
    }
  }
  return [...inputs].sort();
}

// Reads a folder's .rendered.json: { record } (null when there is none), or { error } saying why it
// cannot be used.
export function readRecord(root, folder) {
  const file = path.join(root, folder, RECORD);
  if (!fs.existsSync(file)) return { record: null };
  let record;
  try { record = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { error: `it is not JSON (${e.message.split('\n')[0]})` }; }
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { error: 'it is not an object of PNG file names' };
  for (const [png, entry] of Object.entries(record)) {
    const ok = entry && typeof entry === 'object' && typeof entry.source === 'string' && Number.isInteger(entry.width) && Number.isInteger(entry.height)
      && entry.inputs && typeof entry.inputs === 'object' && !Array.isArray(entry.inputs) && Object.values(entry.inputs).every(h => typeof h === 'string');
    if (!ok) return { error: `the entry for ${png} needs source, width, height, and inputs` };
  }
  return { record };
}

// A record as written: PNG names sorted, each entry's fields in one order, and inputs sorted.
export function formatRecord(record) {
  const out = {};
  for (const png of Object.keys(record).sort()) {
    const { source, width, height, inputs } = record[png];
    const sortedInputs = {};
    for (const k of Object.keys(inputs).sort()) sortedInputs[k] = inputs[k];
    out[png] = { source, width, height, inputs: sortedInputs };
  }
  return `${JSON.stringify(out, null, 2)}\n`;
}

const list = items => items.join(', ');

// The process check's part (AC-16). For each folder under docs/design/: an error for each recorded
// PNG one of whose inputs changed or is gone; a warning for each PNG that has an HTML source by name
// and no record entry, or one warning for the folder when it has no record at all, so a large project
// that has never rendered its mock-ups gets a readable log. A PNG with no HTML source is not checked,
// and neither is a recorded PNG that has since been deleted.
export function mockupProblems(root) {
  const errors = [];
  const warnings = [];
  for (const { folder, files } of designFolders(root)) {
    const { record, error } = readRecord(root, folder);
    if (error) { errors.push(`${folder}/${RECORD} cannot be read: ${error}; render the folder again with ${renderCommand(folder)}`); continue; }
    const pngs = files.filter(f => f.toLowerCase().endsWith('.png'));
    const untracked = pngs.filter(png => sourceOf(png, files) && !(record && Object.hasOwn(record, png)));
    if (!record && untracked.length) {
      warnings.push(`${folder}: ${untracked.length === 1 ? '1 mock-up image is' : `${untracked.length} mock-up images are`} not tracked; render the folder once (${renderCommand(folder)}) so a change to their HTML or styles is caught`);
    } else {
      for (const png of untracked) warnings.push(`${folder}/${png} is not tracked; render its folder once (${renderCommand(folder)}) so a change to its HTML or styles is caught`);
    }
    for (const png of Object.keys(record ?? {}).sort()) {
      if (!pngs.includes(png)) continue;
      const entry = record[png];
      const changed = [];
      const gone = [];
      for (const input of Object.keys(entry.inputs).sort()) {
        const abs = path.join(root, input);
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) gone.push(input);
        else if (hashFile(abs) !== entry.inputs[input]) changed.push(input);
      }
      if (!changed.length && !gone.length) continue;
      const parts = [];
      if (changed.length) parts.push(`${list(changed)} changed since`);
      if (gone.length) parts.push(`${list(gone)} no longer ${gone.length === 1 ? 'exists' : 'exist'}`);
      errors.push(`${folder}/${png}: rendered from ${entry.source}, but ${parts.join(', and ')}; render it again with ${renderCommand(folder)}`);
    }
  }
  return { errors, warnings };
}
