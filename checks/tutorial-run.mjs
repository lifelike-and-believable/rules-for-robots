#!/usr/bin/env node
// Runnable tutorials (docs/specs/project-process.md, stage 12). Every tutorial in docs/tutorials/
// names its runner in front matter:
//   runner: web     its steps run in a browser against the product (checks/lib/tutorial.mjs has
//                   the step grammar), so a tutorial that no longer matches the product fails;
//   runner: unreal  an automation test follows it and cites its id in a comment (checked here,
//                   run by the engine in Tier 2 CI);
//   runner: manual  a person follows it before release.
// A web tutorial can be done by several people, each in a browser session of their own ("As **Name**:"),
// and can start where another tutorial ends ("starts-from: <id>" in front matter); see runTutorial
// and runTutorials below (docs/specs/lasting-tutorials.md, AC-3 and AC-4).
// Usage:
//   node checks/tutorial-run.mjs [root] --coverage            check runners and step grammar only
//   node checks/tutorial-run.mjs [root] --base-url <url>      also run every web tutorial
//   ... --record <dir>   save a screenshot per step, failure.png, and a video per tutorial (video.webm,
//                        or video-<person>.webm for each person a tutorial names)
//   ... --sign-in <path> the path that signs a session in as a named person, with {name} in it
//                        (for example /try/sign-in?as={name}); without it, the runner uses try.sign-in
//                        from docs/product/process.yml, and with neither, sign-in steps are manual
//   ... --provides <list> the services this place provides, comma-separated (lasting-tutorials AC-14):
//                        a tutorial whose needs: names one not in the list is not run here, which is
//                        reported and does not fail the run; without the option, needs are ignored
//   ... --place <name>   local, preview, or staging: take that list from try.provides in process.yml
// Playwright is loaded from the project being checked (its own dependency), so this script works
// from an .rfr checkout.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseArtifact, readConfig } from './lib/process.mjs';
import { bodyProblems, needsOf, parseSteps, startsFromOf, startsFromProblems } from './lib/tutorial.mjs';

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
    const needs = needsOf(text);
    return { file, text, id: parsed.front?.id ?? null, runner: runnerOf(text), startsFrom: startsFromOf(text), needs: needs.needs ?? [], needsError: needs.error, body: parsed.body };
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

export function checkCoverage(root, { lasting = 'fail' } = {}) {
  const errors = [];
  const warnings = [];
  const tutorials = listTutorials(root);
  for (const t of tutorials) {
    const name = t.id ?? t.file;
    if (!t.runner) { errors.push(`${name}: no runner in front matter (runner: web, unreal, or manual)`); continue; }
    if (!RUNNERS.has(t.runner)) { errors.push(`${name}: unknown runner "${t.runner}" (web, unreal, or manual)`); continue; }
    if (t.runner === 'web') for (const e of parseSteps(t.body).errors) errors.push(`${name}: ${e}`);
    // What a lasting tutorial may not hold (lasting-tutorials AC-2). With lasting: 'warn' these are
    // warnings, for a project whose tutorials were written before the rule (AC-15).
    for (const p of bodyProblems(t.body, t.runner)) (lasting === 'warn' ? warnings : errors).push(`${name}: ${p}`);
    if (t.needsError) errors.push(`${name}: ${t.needsError}`);
  }
  // A tutorial named like a spec is probably a spec in the wrong place (AC-2): a warning only.
  let specs = [];
  try { specs = fs.readdirSync(path.join(root, 'docs/specs')).filter(f => f.endsWith('.md')); } catch { /* no specs */ }
  for (const t of tutorials) {
    const base = path.posix.basename(t.file, '.md');
    if (specs.includes(`${base}.md`)) warnings.push(`${t.id ?? t.file}: ${t.file} has the same file name as the spec docs/specs/${base}.md; name a tutorial for the task the reader does, not for the feature it came from`);
  }
  // starts-from names a tutorial, and the chain ends (AC-4), or the runner could not order them.
  for (const p of startsFromProblems(tutorials)) errors.push(p.message);
  const unreal = tutorials.filter(t => t.runner === 'unreal' && t.id);
  const cited = citations(root, unreal.map(t => t.id));
  for (const t of unreal) {
    if (!cited.has(t.id)) errors.push(`${t.id}: no automation test cites it; add a test that follows the tutorial and names ${t.id} in a comment`);
  }
  return { errors, warnings, tutorials };
}

// The first page can hit a cold deployment, so it, and the rest of the step that opens it, wait
// longer than the steps after it (AC-51): a cold page can finish loading and still render late.
const FIRST_LOAD_TIMEOUT = 30000;
const PROTECTED = 'the deployment is protected; give the runner its bypass token (RFR_PREVIEW_BYPASS in the preview workflow, or RFR_TUTORIAL_HEADER="<header>: <token>" locally)';

async function perform(page, action, timeout, baseUrl, first = false) {
  const exact = { exact: true };
  switch (action.type) {
    // A sign-in opens the project's sign-in path for the person (runTutorial fills in action.path).
    case 'signin':
    case 'goto': {
      const response = await page.goto(action.path, { timeout: first ? Math.max(timeout, FIRST_LOAD_TIMEOUT) : timeout });
      const status = response?.status();
      if (status === 401 || status === 403) throw new Error(`${action.path} answered HTTP ${status}: ${PROTECTED}`);
      // A login page on another host (Vercel, Netlify, an identity provider) instead of the product.
      if (baseUrl) {
        const landed = new URL(page.url());
        if (landed.origin !== new URL(baseUrl).origin) throw new Error(`${action.path} led to ${landed.host}${landed.pathname}, not the product: ${PROTECTED}`);
      }
      if (response && !response.ok()) throw new Error(`${action.path} answered HTTP ${status}`);
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
      // A hidden copy of a control (for another screen size) must not be picked (AC-49).
      return target.filter({ visible: true }).first().click({ timeout });
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
  signin: `sign in as ${a.name} (open ${a.path})`,
}[a.type]);

// The video file for a person's session: video.webm for the one unnamed session of a tutorial that
// names nobody (as before people existed), video-<name>.webm for each named person ("Morgan Lee" is
// video-morgan-lee.webm).
// Names are cut to 60 characters, a name with no letter or digit is "person", and a second person
// whose name comes to the same file gets -2, so no video overwrites another.
export function videoNames(people) {
  const names = new Map();
  const used = new Set();
  for (const person of people) {
    if (person === null) { names.set(null, 'video.webm'); continue; }
    const slug = person.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'person';
    let file = `video-${slug}.webm`;
    for (let n = 2; used.has(file); n += 1) file = `video-${slug}-${n}.webm`;
    used.add(file);
    names.set(person, file);
  }
  return names;
}

function loadPlaywright(root) {
  for (const from of [path.join(root, 'package.json'), fileURLToPath(import.meta.url)]) {
    try { return createRequire(from)('playwright'); } catch { /* try the next place */ }
  }
  throw new Error('playwright is not installed in this project; add it as a dev dependency to run web tutorials');
}

// Runs one web tutorial. Returns { ok, steps, failure: { step, text, message } | null, artifacts,
// manual, end }.
// With `record`, writes <record>/<tutorial id>/step-NN.png after each step (of the page of the person
// who did it), failure.png at a failing step, and a video of each session (videoName above), so a
// passing run is also the stage 12 demo.
// `headers` are added only to requests to baseUrl's origin (for example a preview deployment's
// protection bypass), so a page that loads other hosts never sends them the secret.
//
// People (lasting-tutorials AC-3). Each person gets a browser context of their own, created when
// they first do a step and kept to the end of the tutorial, so what one person did reaches another
// only through the product. Steps with no name are done by the tutorial's first person (parseSteps),
// or, in a tutorial that names nobody, by the first person of the tutorial it starts from, or else
// by one unnamed session. `signIn` is the project's sign-in path with {name} in it; a "Sign in as"
// step opens it on the base URL in that person's session, with the name URL-encoded. Without it,
// a step that signs in is manual: it is skipped like a "(manual)" step, and listed in `manual` as
// { step, person }. A failing step stops the whole tutorial, whoever did it.
//
// Starting from another tutorial (AC-4). `from` is the `end` of the tutorial this one starts from:
// { first, states }, its first person and each person's cookies and storage when it finished. Each
// person here whose session ended there begins a fresh context with that saved state, so they are
// still signed in. `end` is returned for passing runs only.
export async function runTutorial({ text, baseUrl, root = process.cwd(), timeout = 5000, browser = null, record = null, headers = null, signIn = null, from = null }) {
  const parsed = parseArtifact(text);
  const { steps, errors } = parseSteps(parsed.body);
  if (errors.length) return { ok: false, steps: steps.length, failure: { step: null, text: '', message: errors.join('\n') }, artifacts: [] };
  // A tutorial can name its browser size, "viewport: 390x844" (AC-50).
  const viewportLine = /^viewport:\s*(.*?)\s*$/m.exec(/^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '');
  let viewport = null;
  if (viewportLine) {
    const m = /^(\d{2,4})x(\d{2,4})$/.exec(viewportLine[1]);
    if (!m) return { ok: false, steps: steps.length, failure: { step: null, text: '', message: `viewport "${viewportLine[1]}" is not WIDTHxHEIGHT in pixels, for example 390x844` }, artifacts: [] };
    viewport = { width: Number(m[1]), height: Number(m[2]) };
  }
  const out = record ? path.join(record, parsed.front?.id ?? 'tutorial') : null;
  if (out) fs.mkdirSync(out, { recursive: true });
  const artifacts = [];
  const manual = [];
  const own = !browser;
  const b = browser ?? await loadPlaywright(root).chromium.launch();
  // Who does the steps that name nobody: null is the single unnamed session.
  const firstPerson = steps[0]?.person ?? from?.first ?? null;
  const sessions = new Map(); // person (null for the unnamed session) -> { context, page }
  const sessionFor = async person => {
    if (sessions.has(person)) return sessions.get(person);
    const state = from?.states?.get(person);
    const context = await b.newContext({
      baseURL: baseUrl,
      ...(viewport ? { viewport } : {}),
      ...(out ? { recordVideo: { dir: out, ...(viewport ? { size: viewport } : {}) } } : {}),
      ...(state ? { storageState: state } : {}),
    });
    if (headers && Object.keys(headers).length) {
      const origin = new URL(baseUrl).origin;
      await context.route('**/*', route => {
        const request = route.request();
        let same = false;
        try { same = new URL(request.url()).origin === origin; } catch { /* data: and other non-URL requests */ }
        return same ? route.continue({ headers: { ...request.headers(), ...headers } }) : route.continue();
      });
    }
    // Registered before its page opens, so the context is closed with the others if that throws.
    const session = { context, page: null };
    sessions.set(person, session);
    session.page = await context.newPage();
    return session;
  };
  let opened = false;
  let cold = false;
  let result;
  let end;
  try {
    run: {
      for (const step of steps) {
        const person = step.person ?? firstPerson;
        const { page } = await sessionFor(person);
        // With no sign-in path, a step that signs in is a manual step (AC-3).
        const signsIn = step.actions.some(a => a.type === 'signin');
        if (signsIn && !signIn) manual.push({ step: step.n, person });
        for (const written of signsIn && !signIn ? [] : step.actions) {
          const action = written.type === 'signin' ? { ...written, path: signIn.replaceAll('{name}', encodeURIComponent(written.name)) } : written;
          try {
            const opens = action.type === 'goto' || action.type === 'signin';
            const first = opens && !opened;
            if (first) cold = true;
            await perform(page, action, cold ? Math.max(timeout, FIRST_LOAD_TIMEOUT) : timeout, baseUrl, first);
            if (opens) opened = true;
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
        cold = false;
        if (out) {
          const shot = path.join(out, `step-${String(step.n).padStart(2, '0')}.png`);
          await page.screenshot({ path: shot, fullPage: true });
          artifacts.push(shot);
        }
      }
      result = { ok: true, steps: steps.length, failure: null };
      // What a tutorial that starts from this one begins with: the saved state of every person who
      // had a session here or in the tutorials before it.
      const states = new Map(from?.states ?? []);
      for (const [person, { context }] of sessions) states.set(person, await context.storageState({ indexedDB: true }));
      end = { first: firstPerson, states };
    }
  } finally {
    const files = videoNames(sessions.keys());
    for (const [person, { context, page }] of sessions) {
      // One session that cannot be closed or saved does not stop the others from closing.
      try {
        const video = out && page ? page.video() : null;
        await context.close();
        if (video) {
          const target = path.join(out, files.get(person));
          await video.saveAs(target);
          await video.delete().catch(() => {});
          artifacts.push(target);
        }
      } catch { /* the run's result stands; this session's video is missing */ }
    }
    if (own) await b.close();
  }
  return { ...result, artifacts, manual, ...(end ? { end } : {}) };
}

// Runs web tutorials, each after the tutorial it starts from (lasting-tutorials AC-4), and returns
// one result for each, in the order they ran: { id, status: 'ok' | 'fail' | 'skip', reason, ... }.
// A tutorial that several start from runs once. One whose starting tutorial failed, was skipped, or
// cannot be run here (it is not a web tutorial) is skipped, with the reason. Each tutorial that
// starts from another begins with that tutorial's people still signed in (runTutorial's `from`),
// against whatever the product holds by then, which includes what earlier tutorials in the run did.
// The services the place being tried has (AC-14): the --provides list when given; otherwise, when the
// run names its place (--place local, preview, or staging), what the project's try.provides lists for
// it. null means needs are not checked: no list was given, and the project lists nothing for the place.
export function providesFor({ given = null, place = null, config = null }) {
  if (given) return given;
  const listed = place ? config?.try?.provides?.[place] : null;
  return Array.isArray(listed) ? listed : null;
}

// `report` is called with each result as it is known, so a long run prints as it goes.
//
// Needs (lasting-tutorials AC-14). `provides` is the list of services this place has, or null. With a
// list, a tutorial whose needs are not all in it is not run here: { status: 'not-run', reason:
// 'needs <service>, ...' }, and so is one that starts from a tutorial not run here. That is not a
// failure. With null, needs are ignored and every tutorial runs.
export async function runTutorials({ tutorials, baseUrl, root = process.cwd(), timeout, browser = null, record = null, headers = null, signIn = null, provides = null, report = () => {} }) {
  const byId = new Map(tutorials.filter(t => t.id).map(t => [t.id, t]));
  const done = new Map();
  const running = new Set();
  const results = [];
  const own = !browser;
  const b = browser ?? await loadPlaywright(root).chromium.launch();
  const run = async t => {
    // Two tutorials with one id both run, each under its file (the process check reports the duplicate).
    const key = t.id && byId.get(t.id) === t ? t.id : t.file;
    if (done.has(key)) return done.get(key);
    running.add(key);
    let r = null;
    let from = null;
    const unmet = provides ? (t.needs ?? []).filter(n => !provides.includes(n)) : [];
    if (unmet.length) r = { id: key, status: 'not-run', reason: `needs ${unmet.join(', ')}` };
    else if (t.startsFrom) {
      const start = byId.get(t.startsFrom);
      let why = null;
      if (!start) why = 'is not a tutorial';
      else if (start.runner !== 'web') why = `is runner: ${start.runner}, so the runner cannot reach the state it leaves`;
      else if (running.has(start.id)) why = 'starts from it in turn';
      else {
        const before = await run(start);
        if (before.status === 'fail') why = 'failed';
        else if (before.status === 'skip') why = 'was skipped';
        else if (before.status === 'not-run') r = { id: key, status: 'not-run', reason: `starts from ${t.startsFrom}, which was not run here` };
        else from = before.end;
      }
      if (why) r = { id: key, status: 'skip', reason: `starts from ${t.startsFrom}, which ${why}` };
    }
    if (!r) {
      const x = await runTutorial({ text: t.text, baseUrl, root, browser: b, record, headers, signIn, from, ...(timeout ? { timeout } : {}) });
      r = { id: key, status: x.ok ? 'ok' : 'fail', ...x };
    }
    running.delete(key);
    done.set(key, r);
    results.push(r);
    report(r);
    return r;
  };
  try {
    for (const t of tutorials.filter(x => x.runner === 'web')) await run(t);
  } finally {
    if (own) await b.close();
  }
  return results;
}

async function main(argv) {
  const args = [...argv];
  const i = args.indexOf('--base-url');
  const baseUrl = i === -1 ? null : args.splice(i, 2)[1];
  const j = args.indexOf('--record');
  const record = j === -1 ? null : path.resolve(args.splice(j, 2)[1]);
  const k = args.indexOf('--sign-in');
  const given = k === -1 ? null : args.splice(k, 2)[1] ?? '';
  if (given !== null && !given.includes('{name}')) { console.error('--sign-in must contain {name}, for example /try/sign-in?as={name}'); process.exit(2); }
  const p = args.indexOf('--provides');
  const givenProvides = p === -1 ? null : (args.splice(p, 2)[1] ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const q = args.indexOf('--place');
  const place = q === -1 ? null : args.splice(q, 2)[1] ?? null;
  const coverageOnly = args.includes('--coverage');
  const root = path.resolve(args.find(a => !a.startsWith('--')) ?? '.');
  const provides = providesFor({ given: givenProvides, place, config: readConfig(root)?.config ?? null });
  // The command line wins; otherwise the project's own sign-in path, from try.sign-in (AC-5).
  const signIn = given ?? readConfig(root)?.config?.try?.signIn ?? null;
  const { errors, warnings, tutorials } = checkCoverage(root, { lasting: process.env.RFR_LASTING_TUTORIALS === 'warn' ? 'warn' : 'fail' });
  for (const w of warnings) console.warn(`warning: ${w}`);
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
  const report = r => {
    if (r.status === 'ok') console.log(`ok   ${r.id} (${r.steps} steps)`);
    else if (r.status === 'fail') console.error(`FAIL ${r.id}: ${r.failure.message}`);
    else if (r.status === 'not-run') console.log(`n/a  ${r.id}: not run here: ${r.reason}`);
    else console.error(`SKIP ${r.id}: not run, because it ${r.reason}`);
    for (const m of r.manual ?? []) console.log(`note ${r.id}: step ${m.step} signs in as ${m.person} by hand: no --sign-in was given, so the runner skipped it`);
  };
  let results;
  try {
    results = await runTutorials({ tutorials, baseUrl, root, browser, record, headers, signIn, provides, report });
  } finally {
    await browser.close();
  }
  const away = results.filter(r => r.status === 'not-run').length;
  if (away) console.log(`${away} tutorial(s) not run here, because they need a service this run does not provide (it provides: ${provides.length ? provides.join(', ') : 'nothing'}).`);
  const skipped = results.filter(r => r.status === 'skip').length;
  if (skipped) console.error(`${skipped} tutorial(s) skipped because a tutorial they start from did not pass.`);
  if (skipped || results.some(r => r.status === 'fail')) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exit(1); });
