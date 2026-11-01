#!/usr/bin/env node
// Runnable tutorials (docs/specs/project-process.md, stage 12). Every tutorial in docs/tutorials/
// names its runner in front matter:
//   runner: web     its steps run in a browser against the product (checks/lib/tutorial.mjs has
//                   the step grammar), so a tutorial that no longer matches the product fails;
//   runner: unreal  an automation test follows it and cites its id in a comment (checked here,
//                   run by the engine in Tier 2 CI);
//   runner: manual  a person follows it before release.
// Usage:
//   node checks/tutorial-run.mjs [root] --coverage            check runners and step grammar only
//   node checks/tutorial-run.mjs [root] --base-url <url>      also run every web tutorial
//   ... --record <dir>   save a screenshot per step, failure.png, and video.webm per tutorial
// Playwright is loaded from the project being checked (its own dependency), so this script works
// from an .rfr checkout.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseArtifact } from './lib/process.mjs';
import { parseSteps } from './lib/tutorial.mjs';

const RUNNERS = new Set(['web', 'unreal', 'manual']);
const TUTORIALS = 'docs/tutorials';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'docs', 'Binaries', 'Intermediate', 'Saved', 'DerivedDataCache', '.rfr']);

const runnerOf = text => /^runner:\s*(\S+)\s*$/m.exec(/^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '')?.[1] ?? null;

function listTutorials(root) {
  const out = [];
  const walk = rel => {
    let entries;
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child);
      else if (e.name.endsWith('.md')) out.push(child);
    }
  };
  walk(TUTORIALS);
  return out.map(file => {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const parsed = parseArtifact(text);
    return { file, text, id: parsed.front?.id ?? null, runner: runnerOf(text), body: parsed.body };
  });
}

// Files outside docs/ that mention each id, for runner: unreal.
function citations(root, ids) {
  const found = new Set();
  if (!ids.length) return found;
  const walk = rel => {
    let entries;
    try { entries = fs.readdirSync(path.join(root, rel || '.'), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(child);
      else if (e.isFile() && fs.statSync(path.join(root, child)).size < 1_000_000) {
        const text = fs.readFileSync(path.join(root, child), 'utf8');
        for (const id of ids) if (new RegExp(`(?<![\\w-])${id}(?![\\w-])`).test(text)) found.add(id);
      }
    }
  };
  walk('');
  return found;
}

export function checkCoverage(root) {
  const errors = [];
  const tutorials = listTutorials(root);
  for (const t of tutorials) {
    const name = t.id ?? t.file;
    if (!t.runner) { errors.push(`${name}: no runner in front matter (runner: web, unreal, or manual)`); continue; }
    if (!RUNNERS.has(t.runner)) { errors.push(`${name}: unknown runner "${t.runner}" (web, unreal, or manual)`); continue; }
    if (t.runner === 'web') for (const e of parseSteps(t.body).errors) errors.push(`${name}: ${e}`);
  }
  const unreal = tutorials.filter(t => t.runner === 'unreal' && t.id);
  const cited = citations(root, unreal.map(t => t.id));
  for (const t of unreal) {
    if (!cited.has(t.id)) errors.push(`${t.id}: no automation test cites it; add a test that follows the tutorial and names ${t.id} in a comment`);
  }
  return { errors, tutorials };
}

async function perform(page, action, timeout) {
  const exact = { exact: true };
  switch (action.type) {
    case 'goto': {
      const response = await page.goto(action.path, { timeout });
      if (response && !response.ok()) throw new Error(`${action.path} answered HTTP ${response.status()}`);
      return;
    }
    case 'fill': return page.getByLabel(action.label, exact).fill(action.value, { timeout });
    case 'select': return page.getByLabel(action.label, exact).selectOption(action.value, { timeout });
    case 'check': return page.getByLabel(action.label, exact).check({ timeout });
    case 'uncheck': return page.getByLabel(action.label, exact).uncheck({ timeout });
    case 'click': {
      const name = { name: action.label, exact: true };
      const target = page.getByRole('button', name)
        .or(page.getByRole('link', name))
        .or(page.getByRole('tab', name))
        .or(page.getByRole('menuitem', name))
        .or(page.getByText(action.label, exact));
      return target.first().click({ timeout });
    }
    case 'see': return page.getByText(action.text).first().waitFor({ state: 'visible', timeout });
    default: throw new Error(`unknown action ${action.type}`);
  }
}

const describe = a => ({
  goto: `open ${a.path}`,
  fill: `type into "${a.label}"`,
  select: `choose "${a.value}" from "${a.label}"`,
  check: `check "${a.label}"`,
  uncheck: `uncheck "${a.label}"`,
  click: `find a button, link, tab, or text named "${a.label}"`,
  see: `see "${a.text}"`,
}[a.type]);

function loadPlaywright(root) {
  for (const from of [path.join(root, 'package.json'), fileURLToPath(import.meta.url)]) {
    try { return createRequire(from)('playwright'); } catch { /* try the next place */ }
  }
  throw new Error('playwright is not installed in this project; add it as a dev dependency to run web tutorials');
}

// Runs one web tutorial. Returns { ok, steps, failure: { step, text, message } | null, artifacts }.
// With `record`, writes <record>/<tutorial id>/step-NN.png after each step, failure.png at a failing
// step, and video.webm of the whole run, so a passing run is also the stage 12 demo.
// `headers` are added only to requests to baseUrl's origin (for example a preview deployment's
// protection bypass), so a page that loads other hosts never sends them the secret.
export async function runTutorial({ text, baseUrl, root = process.cwd(), timeout = 5000, browser = null, record = null, headers = null }) {
  const parsed = parseArtifact(text);
  const { steps, errors } = parseSteps(parsed.body);
  if (errors.length) return { ok: false, steps: steps.length, failure: { step: null, text: '', message: errors.join('\n') }, artifacts: [] };
  const out = record ? path.join(record, parsed.front?.id ?? 'tutorial') : null;
  if (out) fs.mkdirSync(out, { recursive: true });
  const artifacts = [];
  const own = !browser;
  const b = browser ?? await loadPlaywright(root).chromium.launch();
  const context = await b.newContext({ baseURL: baseUrl, ...(out ? { recordVideo: { dir: out } } : {}) });
  if (headers && Object.keys(headers).length) {
    const origin = new URL(baseUrl).origin;
    await context.route('**/*', route => {
      const request = route.request();
      let same = false;
      try { same = new URL(request.url()).origin === origin; } catch { /* data: and other non-URL requests */ }
      return same ? route.continue({ headers: { ...request.headers(), ...headers } }) : route.continue();
    });
  }
  const page = await context.newPage();
  let result;
  try {
    run: {
      for (const step of steps) {
        for (const action of step.actions) {
          try {
            await perform(page, action, timeout);
          } catch (e) {
            const why = (e.message ?? String(e)).split('\n')[0];
            let message = `step ${step.n} ("${step.text}"): could not ${describe(action)} (${why})`;
            if (out) {
              const shot = path.join(out, 'failure.png');
              await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
              if (fs.existsSync(shot)) { artifacts.push(shot); message += `; the page at that point is in ${shot}`; }
            }
            result = { ok: false, steps: steps.length, failure: { step: step.n, text: step.text, message } };
            break run;
          }
        }
        if (out) {
          const shot = path.join(out, `step-${String(step.n).padStart(2, '0')}.png`);
          await page.screenshot({ path: shot, fullPage: true });
          artifacts.push(shot);
        }
      }
      result = { ok: true, steps: steps.length, failure: null };
    }
  } finally {
    const video = out ? page.video() : null;
    await context.close();
    if (video) {
      const target = path.join(out, 'video.webm');
      await video.saveAs(target);
      await video.delete().catch(() => {});
      artifacts.push(target);
    }
    if (own) await b.close();
  }
  return { ...result, artifacts };
}

async function main(argv) {
  const args = [...argv];
  const i = args.indexOf('--base-url');
  const baseUrl = i === -1 ? null : args.splice(i, 2)[1];
  const j = args.indexOf('--record');
  const record = j === -1 ? null : path.resolve(args.splice(j, 2)[1]);
  const coverageOnly = args.includes('--coverage');
  const root = path.resolve(args.find(a => !a.startsWith('--')) ?? '.');
  const { errors, tutorials } = checkCoverage(root);
  for (const e of errors) console.error(e);
  if (errors.length) process.exit(1);
  const web = tutorials.filter(t => t.runner === 'web');
  if (coverageOnly || !web.length) { console.log(`${tutorials.length} tutorial(s): runners and steps are in order.`); return; }
  if (!baseUrl) { console.error('--base-url is required to run web tutorials (or pass --coverage)'); process.exit(2); }
  // RFR_TUTORIAL_HEADER="Name: value" adds a header for the base URL's origin only, such as a
  // preview deployment's protection bypass. It is read from the environment so it stays out of logs.
  const raw = process.env.RFR_TUTORIAL_HEADER ?? '';
  const sep = raw.indexOf(':');
  const headers = sep > 0 ? { [raw.slice(0, sep).trim().toLowerCase()]: raw.slice(sep + 1).trim() } : null;
  const { chromium } = loadPlaywright(root);
  const browser = await chromium.launch();
  let failed = 0;
  try {
    for (const t of web) {
      const r = await runTutorial({ text: t.text, baseUrl, root, browser, record, headers });
      if (r.ok) console.log(`ok   ${t.id} (${r.steps} steps)`);
      else { failed++; console.error(`FAIL ${t.id}: ${r.failure.message}`); }
    }
  } finally {
    await browser.close();
  }
  if (failed) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exit(1); });
