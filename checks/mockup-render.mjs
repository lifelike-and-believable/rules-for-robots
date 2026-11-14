#!/usr/bin/env node
// Renders mock-ups (docs/specs/revisions-and-foundations.md, AC-16). Each HTML page in a design folder
// is rendered to <page>.png beside it at 1280 by 800, full page, and also to <page>-phone.png at 320
// by 640 when that image exists or the folder's record lists a phone render of the page. A size in
// the record wins over these defaults. The folder's .rendered.json then records, for each PNG, its
// source page, the size, and the hash of every input (checks/lib/mockups.mjs), so the process check
// can tell, with no browser, when an image is out of date.
// Pages are opened from file:// with no network: every request that is not for a file inside the
// repository is blocked, so a page cannot fetch anything and the image depends only on recorded files.
// Usage:
//   node checks/mockup-render.mjs [root] [design folder ...] [--only <page.html>]
// With no folder, every folder under docs/design/ that holds .html files. Folders are relative to the
// root, which is the current folder unless the first argument is a folder that has docs/design/ in it.
// --only renders one page (a file name, or a path from the root) and keeps the rest of the record.
// Playwright is loaded from the project being checked, then from this repository (loadPlaywright).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadPlaywright } from './tutorial-run.mjs';
import { DESIGN, DESKTOP, RECORD, designFolders, formatRecord, hashFile, pageInputs, readRecord, sourceOf } from './lib/mockups.mjs';

const toPosix = p => p.split(path.sep).join('/');
const isHtml = f => f.toLowerCase().endsWith('.html');
const inside = (root, abs) => { const rel = path.relative(root, abs); return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel); };

function filesIn(root, folder) {
  try { return fs.readdirSync(path.join(root, folder), { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name).sort(); } catch { return null; }
}

// What to render in a folder: one job { html, png, size } for each image of each page.
export function renderJobs(files, record, only = null) {
  const jobs = [];
  for (const html of files.filter(f => isHtml(f) && (!only || f === only))) {
    const base = html.slice(0, -'.html'.length);
    const pngs = new Set([`${base}.png`]);
    if (files.includes(`${base}-phone.png`) && !files.includes(`${base}-phone.html`)) pngs.add(`${base}-phone.png`);
    for (const [png, entry] of Object.entries(record ?? {})) if (entry.source === html) pngs.add(png);
    for (const png of [...pngs].sort()) {
      const recorded = record?.[png]?.source === html ? record[png] : null;
      const size = recorded ? { width: recorded.width, height: recorded.height } : (sourceOf(png, files)?.size ?? DESKTOP);
      jobs.push({ html, png, size });
    }
  }
  return jobs;
}

// Renders the pages of each folder (repository paths; by default every folder under docs/design/
// with .html files) and writes each folder's .rendered.json. Returns { folders: [{ folder, rendered,
// blocked }] }: the PNGs written (repository paths), and the URLs that were refused.
export async function renderMockups(rootArg, { folders = null, only = null, browser = null, log = () => {} } = {}) {
  const root = path.resolve(rootArg);
  const targets = (folders ?? designFolders(root).filter(f => f.files.some(isHtml)).map(f => f.folder))
    .map(f => toPosix(path.isAbsolute(f) ? path.relative(root, f) : path.normalize(f)).replace(/\/$/, ''));
  const own = !browser;
  const b = browser ?? await loadPlaywright(root, 'to render mock-ups').chromium.launch();
  const contexts = new Map(); // "WxH" -> browser context
  let blocked = null; // the list for the folder being rendered
  const allowed = url => {
    if (/^(data|blob|about):/i.test(url)) return true;
    if (!url.startsWith('file:')) return false;
    try { return inside(root, fileURLToPath(url)); } catch { return false; }
  };
  const contextFor = async size => {
    const key = `${size.width}x${size.height}`;
    if (!contexts.has(key)) {
      const context = await b.newContext({ viewport: size, deviceScaleFactor: 1, offline: true, serviceWorkers: 'block' });
      await context.route('**/*', route => {
        const url = route.request().url();
        if (allowed(url)) return route.continue();
        if (!blocked.includes(url)) blocked.push(url);
        return route.abort('blockedbyclient');
      });
      contexts.set(key, context);
    }
    return contexts.get(key);
  };
  const results = [];
  try {
    for (const folder of targets) {
      if (!inside(root, path.join(root, folder))) throw new Error(`${folder} is not inside ${root}`);
      const files = filesIn(root, folder);
      if (!files) throw new Error(`${folder} is not a folder`);
      const read = readRecord(root, folder);
      if (read.error) log(`warning: ${folder}/${RECORD} could not be read (${read.error}); starting a new one`);
      // An entry whose page is gone is dropped; the rest of the record is kept.
      const record = Object.fromEntries(Object.entries(read.record ?? {}).filter(([, e]) => files.includes(e.source)));
      const jobs = renderJobs(files, record, only);
      const result = { folder, rendered: [], blocked: [] };
      blocked = result.blocked;
      for (const job of jobs) {
        const htmlFile = path.join(root, folder, job.html);
        const page = await (await contextFor(job.size)).newPage();
        try {
          await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
          await page.evaluate(() => document.fonts?.ready.then(() => true));
          await page.screenshot({ path: path.join(root, folder, job.png), fullPage: true, animations: 'disabled' });
        } finally {
          await page.close();
        }
        const inputs = {};
        for (const input of pageInputs(root, htmlFile)) inputs[input] = hashFile(path.join(root, input));
        record[job.png] = { source: job.html, width: job.size.width, height: job.size.height, inputs };
        result.rendered.push(`${folder}/${job.png}`);
        log(`rendered ${folder}/${job.png} (${job.size.width}x${job.size.height}) from ${job.html}`);
      }
      if (jobs.length) fs.writeFileSync(path.join(root, folder, RECORD), formatRecord(record));
      for (const url of result.blocked) log(`blocked ${url}: a mock-up may load only files inside the repository`);
      results.push(result);
    }
  } finally {
    for (const context of contexts.values()) await context.close().catch(() => {});
    if (own) await b.close();
  }
  return { folders: results };
}

async function main(argv) {
  const args = [...argv];
  const o = args.indexOf('--only');
  let only = o === -1 ? null : args.splice(o, 2)[1] ?? '';
  if (o !== -1 && !only) { console.error('--only needs a page, for example --only board.html'); process.exit(2); }
  let positional = args.filter(a => !a.startsWith('--'));
  let root = process.cwd();
  if (positional.length && fs.existsSync(path.join(positional[0], DESIGN)) && fs.statSync(positional[0]).isDirectory()) {
    root = path.resolve(positional[0]);
    positional = positional.slice(1);
  }
  let folders = positional.length ? positional.map(f => toPosix(path.relative(root, path.resolve(root, f)))) : null;
  // --only with a path names its folder too.
  if (only && /[\\/]/.test(only)) {
    const rel = toPosix(path.relative(root, path.resolve(root, only)));
    folders ??= [path.posix.dirname(rel)];
    only = path.posix.basename(rel);
  }
  const started = Date.now();
  const r = await renderMockups(root, { folders, only, log: line => console.log(line) });
  const count = r.folders.reduce((n, f) => n + f.rendered.length, 0);
  if (only && !count) { console.error(`no page named ${only} in ${(folders ?? [DESIGN]).join(', ')}`); process.exit(2); }
  if (!r.folders.length) { console.log(`No mock-up HTML pages under ${DESIGN}/.`); return; }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Rendered ${count} image(s) in ${r.folders.length} folder(s) in ${seconds} s, and recorded them in ${RECORD} in each folder. Commit the images and the records.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exit(1); });
