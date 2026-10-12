#!/usr/bin/env node
// Phase 5 smoke tests: run each rfr-core agent and skill on small tasks and check that it
// produces output in its declared format. Uses the eval case fixtures as repositories.
// Usage: node evals/agents/smoke.mjs [--only name,name] [--concurrency 4] [--out dir]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURES = path.join(ROOT, 'evals', 'cases');
// A fake key assembled at runtime so the source itself does not trip secret scanners.
const FAKE_KEY = ['sk', 'live', '51Hx9EXAMPLEEXAMPLEEXAMPLE'].join('_');
const FINDING = /\[(blocker|major|minor|nit)\][^\n]*?[\w./-]+\.\w+:\d+/i;

const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };


// A pull request for the merge-when-green skill: a local bare remote, a branch with one
// commit pushed to it, and the scenario the fake gh (evals/agents/fake-gh) answers from.
function pullRequest(dir, checks, failedLog, extra = {}) {
  const g = (...a) => spawnSync('git', ['-c', 'user.email=s@example.com', '-c', 'user.name=smoke', ...a], { cwd: dir, encoding: 'utf8' });
  const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-smoke-remote-'));
  spawnSync('git', ['init', '-q', '--bare', '-b', 'main', remote]);
  g('remote', 'add', 'origin', remote); g('push', '-q', 'origin', 'main');
  g('switch', '-q', '-c', 'add-shout');
  write(dir, 'src/text.js', fs.readFileSync(path.join(dir, 'src/text.js'), 'utf8') + '\n/** Returns the text in upper case. */\nexport function shout(text) {\n  return text.toUpperCase();\n}\n');
  g('commit', '-qam', 'Add shout'); g('push', '-q', 'origin', 'add-shout');
  const head = g('rev-parse', 'HEAD').stdout.trim();
  fs.writeFileSync(path.join(dir, '.git', 'fake-gh.json'), JSON.stringify({ number: 21, title: 'Add shout', branch: 'add-shout', head, runId: 4242, checks, failedLog, ...extra }));
}
const ghCalls = dir => { try { return fs.readFileSync(path.join(dir, '.git', 'gh-calls.log'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } };
const headOf = dir => JSON.parse(fs.readFileSync(path.join(dir, '.git', 'fake-gh.json'), 'utf8')).head;

// Each case: fixture to copy, optional change applied after the initial commit, prompt, and a check.
export const CASES = [
  {
    name: 'code-reviewer: off-by-one', fixture: 'dirty-tree',
    change: d => {},
    prompt: 'Use the code-reviewer agent to review the mean() function in src/mean.js against this requirement: "mean returns the arithmetic mean of all values; an empty list returns 0". Report its findings verbatim.',
    check: t => FINDING.test(t) && /mean\.js:\d/.test(t) && /(index|i = 1|first (value|element))/i.test(t),
  },
  {
    name: 'code-reviewer: clean change', fixture: 'verify-and-report',
    change: d => write(d, 'src/text.js', fs.readFileSync(path.join(d, 'src/text.js'), 'utf8') + '\n/** Returns the text in upper case. */\nexport function shout(text) {\n  return text.toUpperCase();\n}\n'),
    prompt: 'Use the code-reviewer agent to review the uncommitted change (git diff) against the requirement: "add shout(text) returning the text in upper case, documented like the other exports". Report its findings verbatim.',
    check: t => /no (findings|issues|problems)|nothing|did not find|found no/i.test(t) || /\[(minor|nit)\]/i.test(t),
  },
  {
    name: 'security-reviewer: SQL injection', fixture: 'verify-and-report',
    change: d => write(d, 'src/users.js', "export async function findUser(db, name) {\n  return db.query(`SELECT * FROM users WHERE name = '${name}'`);\n}\n"),
    prompt: 'Use the security-reviewer agent to review src/users.js (new, uncommitted). Report its findings verbatim.',
    check: t => FINDING.test(t) && /inject|parameteri/i.test(t),
  },
  {
    name: 'security-reviewer: committed secret', fixture: 'verify-and-report',
    change: d => write(d, 'src/config.js', `export const stripeKey = '${FAKE_KEY}';\n`),
    prompt: 'Use the security-reviewer agent to review the uncommitted changes. Report its findings verbatim.',
    check: t => FINDING.test(t) && /secret|key|credential/i.test(t),
  },
  {
    name: 'accessibility-reviewer: div button', fixture: 'verify-and-report',
    change: d => write(d, 'src/Menu.jsx', 'export function Menu({ onOpen }) {\n  return <div className="menu-btn" onClick={onOpen}><img src="/menu.svg" /></div>;\n}\n'),
    prompt: 'Use the accessibility-reviewer agent to review src/Menu.jsx (new, uncommitted). There is no running server. Report its findings verbatim.',
    check: t => FINDING.test(t) && /button/i.test(t) && /(name|alt|label)/i.test(t),
  },
  {
    name: 'accessibility-reviewer: unlabelled input', fixture: 'verify-and-report',
    change: d => write(d, 'src/Search.jsx', 'export function Search() {\n  return <form><input type="text" placeholder="Search" /><span onClick={() => {}}>Go</span></form>;\n}\n'),
    prompt: 'Use the accessibility-reviewer agent to review src/Search.jsx (new, uncommitted). There is no running server. Report its findings verbatim.',
    check: t => FINDING.test(t) && /label/i.test(t),
  },
  {
    name: 'performance-reviewer: N+1 queries', fixture: 'verify-and-report',
    change: d => write(d, 'src/orders.js', 'export async function ordersWithItems(db, userId) {\n  const orders = await db.query("SELECT * FROM orders WHERE user_id = $1", [userId]);\n  for (const order of orders) {\n    order.items = await db.query("SELECT * FROM items WHERE order_id = $1", [order.id]);\n  }\n  return orders;\n}\n'),
    prompt: 'Use the performance-reviewer agent to review src/orders.js (new, uncommitted). Report its findings verbatim.',
    check: t => FINDING.test(t) && /(N\s*\+\s*1|per order|each order|loop)/i.test(t),
  },
  {
    name: 'performance-reviewer: Unreal tick', fixture: 'verify-and-report',
    change: d => write(d, 'Source/Demo/Private/DemoActor.cpp', '// Copyright (c) 2026 Demo.\n#include "DemoActor.h"\n#include "Kismet/GameplayStatics.h"\n\nvoid ADemoActor::Tick(float DeltaSeconds)\n{\n\tSuper::Tick(DeltaSeconds);\n\tTArray<AActor*> Found;\n\tUGameplayStatics::GetAllActorsOfClass(GetWorld(), AActor::StaticClass(), Found);\n\tNearest = Found.Num() ? Found[0] : nullptr;\n}\n'),
    prompt: 'Use the performance-reviewer agent to review Source/Demo/Private/DemoActor.cpp (new, uncommitted, an Unreal Engine actor). Report its findings verbatim.',
    check: t => FINDING.test(t) && /(GetAllActorsOfClass|every frame|per.frame|Tick)/i.test(t),
  },
  {
    name: 'web-engineer: add function', fixture: 'verify-and-report',
    prompt: 'Use the web-engineer agent to add a `toTitleCase(text)` function to src/text.js that capitalizes the first letter of each word, and export it. Then report what it did.',
    check: (t, d) => spawnSync('npm', ['run', 'verify'], { cwd: d }).status === 0 && /verify|style OK|pass/i.test(t),
  },
  {
    name: 'web-engineer: bug fix with test', fixture: 'scoped-fix',
    prompt: 'Use the web-engineer agent to fix this bug: formatPrice(19.999) returns "$19.99" but should return "$20.00". Then report what it did.',
    check: (t, d) => /\$20\.00/.test(fs.readFileSync(path.join(d, 'src/price.js'), 'utf8') + t) && spawnSync('npm', ['test'], { cwd: d }).status === 0,
  },
  {
    name: 'unreal-engineer: add Blueprint function', fixture: null, unreal: true,
    prompt: 'Use the unreal-engineer agent to add a BlueprintCallable function `ResetScore()` to URfrSampleSubsystem in this plugin that sets the score back to zero. No engine is installed on this machine, so it cannot build; it should say so and run any checks it can. Then report what it did.',
    check: (t, d) => /ResetScore/.test(fs.readFileSync(path.join(d, 'Source/RfrSample/Public/RfrSampleSubsystem.h'), 'utf8')) && /(no engine|not installed|could not build|cannot build|couldn't build|unable to build|did not build)/i.test(t),
  },
  {
    name: 'unreal-engineer: new source file', fixture: null, unreal: true,
    prompt: 'Use the unreal-engineer agent to add a new header Source/RfrSample/Public/RfrSampleSettings.h declaring a UDeveloperSettings subclass URfrSampleSettings with one int32 config property MaxScore (default 100), shown in Project Settings. No engine is installed here. Then report what it did.',
    check: (t, d) => {
      const f = path.join(d, 'Source/RfrSample/Public/RfrSampleSettings.h');
      if (!fs.existsSync(f)) return false;
      const s = fs.readFileSync(f, 'utf8');
      return /^\/\/.*Copyright.*Lifelike/m.test(s.split('\n')[0]) && /UPROPERTY\(/.test(s) && /DeveloperSettings/.test(s);
    },
  },
  {
    name: 'skill plan-feature: CSV export', fixture: 'scoped-fix',
    prompt: '/rfr-core:plan-feature Let shop staff export the price list as CSV.',
    check: (t, d) => /acceptance criteria/i.test(t) && /out of scope|\bOut:/i.test(t) && spawnSync('git', ['status', '--porcelain', 'src'], { cwd: d, encoding: 'utf8' }).stdout.trim() === '',
  },
  {
    name: 'skill plan-feature: median caching', fixture: 'dirty-tree',
    prompt: '/rfr-core:plan-feature Cache median results for large arrays so repeated calls are fast.',
    check: t => /acceptance criteria/i.test(t) && /verif/i.test(t),
  },
  {
    name: 'skill review-pr: planted bug', fixture: 'dirty-tree',
    prompt: '/rfr-core:review-pr Review the committed code in src/ against: "mean returns the arithmetic mean of all values".',
    check: t => /mean\.js/.test(t) && /(confirmed|plausible)/i.test(t),
  },
  {
    name: 'skill review-pr: security change', fixture: 'verify-and-report',
    change: d => write(d, 'src/users.js', "export async function findUser(db, name) {\n  return db.query(`SELECT * FROM users WHERE name = '${name}'`);\n}\n"),
    prompt: '/rfr-core:review-pr Review the uncommitted change (git diff HEAD) against the requirement "look up a user by name".',
    check: t => /inject|parameteri/i.test(t) && /(confirmed|plausible)/i.test(t),
  },
  {
    name: 'skill write-adr: database choice', fixture: 'scoped-fix',
    prompt: '/rfr-core:write-adr Use Postgres on Neon rather than SQLite for the shop database. Show the draft only; do not save it.',
    check: t => /## Context/i.test(t) && /## Options/i.test(t) && /## Consequences/i.test(t),
  },
  {
    name: 'skill write-adr: test runner', fixture: 'verify-and-report',
    prompt: '/rfr-core:write-adr Keep node:test as the test runner instead of moving to Vitest. Show the draft only; do not save it.',
    check: t => /## Decision/i.test(t) && /Vitest/.test(t),
  },
  {
    name: 'skill release: waits for confirmation', fixture: 'verify-and-report',
    prompt: '/rfr-core:release patch',
    check: (t, d) => spawnSync('git', ['tag'], { cwd: d, encoding: 'utf8' }).stdout.trim() === '' && /(confirm|go ahead|proceed|shall I|should I|would you like)/i.test(t),
  },
  {
    name: 'skill security-audit: secret and injection', fixture: 'verify-and-report',
    change: d => { write(d, 'src/config.js', `export const stripeKey = '${FAKE_KEY}';\n`); write(d, 'src/users.js', "export async function findUser(db, name) {\n  return db.query(`SELECT * FROM users WHERE name = '${name}'`);\n}\n"); },
    commitChange: true,
    prompt: '/rfr-core:security-audit',
    check: t => /secret|key/i.test(t) && /inject|parameteri/i.test(t),
  },
  {
    name: 'skill package-unreal-plugin: no engine', fixture: null, unreal: true,
    prompt: '/rfr-core:package-unreal-plugin 5.6',
    check: t => /(not (installed|found|available)|no engine|cannot|can't|unable)/i.test(t) && /(FabURL|Tier 1|tier1)/i.test(t),
  },
  {
    name: 'skill profile-unreal-plugin: no engine', fixture: null, unreal: true,
    prompt: '/rfr-core:profile-unreal-plugin score updates in a test map',
    check: t => /(trace|Insights)/i.test(t),
  },
  {
    name: 'skill a11y-audit: static page', fixture: 'verify-and-report',
    change: d => write(d, 'public/index.html', '<!doctype html><html><head><title>Shop</title></head><body><div onclick="buy()">Buy</div><img src="hero.jpg"><input placeholder="Email"><p style="color:#aaa;background:#fff">Sale ends soon</p></body></html>'),
    commitChange: true,
    prompt: '/rfr-core:a11y-audit public/index.html (a static file; open it with file:// if you run a browser, or review the markup if you cannot)',
    check: t => /(1\.1\.1|alt)/i.test(t) && /(4\.1\.2|button|role)/i.test(t) && /(1\.4\.3|contrast)/i.test(t),
  },
  {
    name: 'skill a11y-audit: component', fixture: 'verify-and-report',
    change: d => write(d, 'src/Search.jsx', 'export function Search() {\n  return <form><input type="text" placeholder="Search" /><span onClick={() => {}}>Go</span></form>;\n}\n'),
    commitChange: true,
    prompt: '/rfr-core:a11y-audit src/Search.jsx (no dev server exists; review the component)',
    check: t => /label/i.test(t) && /(manual|assistive|not (run|covered)|automated)/i.test(t),
  },
  {
    name: 'skill perf-audit: no deployment', fixture: 'verify-and-report',
    change: d => write(d, 'public/index.html', '<!doctype html><html><head><script src="https://cdn.example.com/huge-lib.js"></script></head><body><img src="hero.jpg"><div id="app"></div></body></html>'),
    commitChange: true,
    prompt: '/rfr-core:perf-audit public/index.html (static file, no server or deployment exists)',
    check: t => /(LCP|CLS|INP|Lighthouse)/.test(t) && /(script|render-blocking|blocking|width|height|dimensions)/i.test(t),
  },
  {
    name: 'skill perf-audit: bundle question', fixture: 'scoped-fix',
    prompt: '/rfr-core:perf-audit src/price.js is imported on every page; is there anything heavy here? No server or deployment exists.',
    check: t => /(budget|size|LCP|Lighthouse|measure)/i.test(t),
  },
  {
    name: 'skill merge-when-green: green pull request', fixture: 'verify-and-report', fakeGh: true,
    change: d => pullRequest(d, [{ name: 'verify', conclusion: 'SUCCESS' }, { name: 'secret-scan', conclusion: 'SUCCESS' }]),
    prompt: '/rfr-core:merge-when-green 21',
    check: (t, d) => {
      const calls = ghCalls(d);
      const merge = calls.findIndex(a => a[0] === 'pr' && a[1] === 'merge');
      const checked = calls.slice(0, merge).some(a => a[0] === 'pr' && (a[1] === 'checks' || (a[1] === 'view' && a.some(x => /headRefOid|statusCheckRollup/.test(x)))));
      const guarded = merge !== -1 && calls[merge].includes('--match-head-commit') && calls[merge].includes(headOf(d));
      const baseUpdated = spawnSync('git', ['merge-base', '--is-ancestor', headOf(d), 'main'], { cwd: d }).status === 0;
      return checked && guarded && baseUpdated && !calls.some(a => a.includes('--admin'));
    },
  },
  {
    name: 'skill merge-when-green: checks still running', expectModel: 'haiku-5-5', fixture: 'verify-and-report', fakeGh: true,
    change: d => pullRequest(d, [{ name: 'verify', conclusion: 'SUCCESS' }, { name: 'secret-scan', conclusion: 'SUCCESS' }], undefined, { pendingUntilWatch: true }),
    prompt: '/rfr-core:merge-when-green 21',
    check: (t, d) => {
      const calls = ghCalls(d);
      const merge = calls.findIndex(a => a[0] === 'pr' && a[1] === 'merge');
      const watch = calls.findIndex(a => a[0] === 'pr' && a[1] === 'checks' && a.includes('--watch'));
      const guarded = merge !== -1 && calls[merge].includes('--match-head-commit') && calls[merge].includes(headOf(d));
      return watch !== -1 && merge > watch && guarded && !calls.some(a => a.includes('--admin'));
    },
  },
  {
    name: 'skill merge-when-green: red head commit', fixture: 'verify-and-report', fakeGh: true,
    change: d => pullRequest(d, [{ name: 'verify', conclusion: 'FAILURE' }, { name: 'secret-scan', conclusion: 'SUCCESS' }],
      'verify\tRun npm run verify\tnot ok 3 - shout returns upper case\nverify\tRun npm run verify\t  expected: HELLO, actual: hello'),
    prompt: '/rfr-core:merge-when-green 21',
    check: (t, d) => {
      const calls = ghCalls(d);
      const merged = calls.some(a => a[0] === 'pr' && a[1] === 'merge' && !a.includes('--help'));
      // The skill reads the failing job's log, so the report names the cause, not just the check.
      const namedCause = /(upper ?case|HELLO|lower ?case|not ok 3)/i.test(t);
      return !merged && /verify/.test(t) && /(fail|red|not pass)/i.test(t) && namedCause && !calls.some(a => a.includes('--admin'));
    },
  },
  {
    name: 'ci-watcher: green pull request', expectModel: 'haiku-5-5', fixture: 'verify-and-report', fakeGh: true,
    change: d => pullRequest(d, [{ name: 'verify', conclusion: 'SUCCESS' }, { name: 'secret-scan', conclusion: 'SUCCESS' }]),
    prompt: 'Use the ci-watcher agent on pull request 21. Report its output verbatim.',
    check: (t, d) => {
      const calls = ghCalls(d);
      return t.includes(headOf(d)) && /verify/.test(t) && /secret-scan/.test(t) && /(success|pass)/i.test(t)
        && !calls.some(a => a[0] === 'pr' && a[1] === 'merge');
    },
  },
  {
    name: 'ci-watcher: red pull request', expectModel: 'haiku-5-5', fixture: 'verify-and-report', fakeGh: true,
    change: d => pullRequest(d, [{ name: 'verify', conclusion: 'FAILURE' }, { name: 'secret-scan', conclusion: 'SUCCESS' }],
      'verify\tRun npm run verify\tnot ok 3 - shout returns upper case\nverify\tRun npm run verify\t  expected: HELLO, actual: hello'),
    prompt: 'Use the ci-watcher agent on pull request 21. Report its output verbatim.',
    check: (t, d) => {
      const calls = ghCalls(d);
      return t.includes(headOf(d)) && /failure/i.test(t) && /not ok 3 - shout returns upper case/.test(t) && /expected: HELLO, actual: hello/.test(t)
        && !calls.some(a => a[0] === 'pr' && a[1] === 'merge') && !calls.some(a => a[0] === 'run' && a[1] === 'rerun');
    },
  },
  {
    name: 'check-runner: failing test and missing scanner', expectModel: 'haiku-5-5', fixture: 'dirty-tree',
    prompt: 'Use the check-runner agent to run these two commands in the repository root: `npm test` and `gitleaks detect --no-git`. Report its output verbatim.',
    check: (t, d) => /exit(ed)?( code)?:?\s*1\b/i.test(t) && /fail 1/.test(t) && /gitleaks/i.test(t) && /(did not run|not installed|not found|couldn't run|could not run)/i.test(t)
      && spawnSync('git', ['status', '--porcelain'], { cwd: d, encoding: 'utf8' }).stdout.trim() === '',
  },
  {
    name: 'check-runner: passing verify', expectModel: 'haiku-5-5', fixture: 'verify-and-report',
    prompt: 'Use the check-runner agent to run `npm run verify` in the repository root. Report its output verbatim.',
    check: (t, d) => /exit[^\n]{0,20}\b0\b/i.test(t) && /style OK/.test(t)
      && spawnSync('git', ['status', '--porcelain'], { cwd: d, encoding: 'utf8' }).stdout.trim() === '',
  },
  {
    name: 'citation-checker: one good and one wrong citation', expectModel: 'haiku-5-5', fixture: 'dirty-tree',
    prompt: 'Use the citation-checker agent on the working tree with these two findings, and report its output verbatim.\n\n'
      + '- [major] src/mean.js:4, no rule\n  Problem: the loop in `mean` starts at index 1 and skips the first value.\n  Failure scenario: mean([2, 4]) returns 2.\n  Fix: start at 0.\n\n'
      + '- [minor] src/median.js:40, no rule\n  Problem: `sortedCopy` mutates its argument.\n  Failure scenario: the caller sees a reordered array.\n  Fix: copy first.',
    check: t => /src\/mean\.js:4[^\n]*\bok\b/.test(t) && /src\/median\.js:40[^\n]*mismatch/.test(t) && /past the end/i.test(t),
  },
];

export function prepare(c) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-smoke-'));
  if (c.unreal) {
    fs.cpSync(path.join(ROOT, 'examples', 'unreal', 'RfrSample'), dir, { recursive: true });
    write(dir, 'AGENTS.md', '# RfrSample\n\nUnreal Engine plugin.\n\n## Commands\n\n- Tier 1 checks: `node ' + path.join(ROOT, 'checks/unreal/tier1.mjs') + ' . --copyright "Lifelike & Believable Animation Design" --allow-missing-fab-url`\n- Verify: build with RunUAT BuildPlugin for 5.6, 5.7, 5.8 (no engine on this machine)\n\n## Project decisions\n\n- Supported engine versions: 5.6, 5.7, 5.8.\n- Copyright line: `// Copyright (c) 2026 Lifelike & Believable Animation Design. All rights reserved.`\n');
    write(dir, 'CLAUDE.md', '@AGENTS.md\n');
    fs.cpSync(path.join(ROOT, 'rules', 'packs', 'unreal-plugin'), path.join(dir, '.claude', 'rules', 'packs', 'unreal-plugin'), { recursive: true });
  } else {
    fs.cpSync(path.join(FIXTURES, c.fixture, 'fixture'), dir, { recursive: true });
  }
  fs.cpSync(path.join(ROOT, 'rules', 'core'), path.join(dir, '.claude', 'rules', 'core'), { recursive: true });
  const g = (...a) => spawnSync('git', ['-c', 'user.email=s@example.com', '-c', 'user.name=smoke', ...a], { cwd: dir });
  g('init', '-q', '-b', 'main'); g('add', '-A'); g('commit', '-q', '-m', 'init');
  c.change?.(dir);
  if (c.commitChange) { g('add', '-A'); g('commit', '-q', '-m', 'change'); }
  return dir;
}

function run(c, dir) {
  const args = ['-p', c.prompt, '--model', 'claude-sonnet-5-5', '--output-format', 'json', '--setting-sources', 'project,local',
    '--no-session-persistence', '--max-turns', '40', '--plugin-dir', path.join(ROOT, 'plugins', 'core'),
    '--allowedTools', 'Read,Grep,Glob,Edit,Write,Bash,Agent,Skill'];
  return new Promise(resolve => {
    const env = c.fakeGh ? { ...process.env, PATH: [path.join(ROOT, 'evals', 'agents', 'fake-gh'), process.env.PATH].join(path.delimiter) } : process.env;
    const child = spawn('claude', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], env });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    const timer = setTimeout(() => child.kill('SIGTERM'), 900000);
    child.on('close', () => { clearTimeout(timer); try { resolve(JSON.parse(out)); } catch { resolve({ result: out, is_error: true }); } });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
  const concurrency = args.includes('--concurrency') ? Number(args[args.indexOf('--concurrency') + 1]) : 4;
  const out = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(ROOT, 'evals', 'results', `smoke-${new Date().toISOString().slice(0, 10)}`));
  fs.mkdirSync(out, { recursive: true });
  const cases = CASES.filter(c => !only || only.some(o => c.name.includes(o)));
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, cases.length) }, async () => {
    while (next < cases.length) {
      const c = cases[next++];
      const dir = prepare(c);
      const r = await run(c, dir);
      const text = r.result ?? '';
      let pass = false;
      const usage = r.modelUsage ?? {};
      const modelOk = !c.expectModel || Object.keys(usage).some(m => m.includes(c.expectModel));
      try { pass = !r.is_error && modelOk && !!c.check(text, dir); } catch {}
      results.push({ name: c.name, pass, costUsd: r.total_cost_usd ?? null, models: Object.fromEntries(Object.entries(usage).map(([m, u]) => [m, u.costUSD])), turns: r.num_turns ?? null, output: text.replaceAll(FAKE_KEY, '<fake key redacted>') });
      console.log(`${pass ? 'PASS' : 'FAIL'} ${c.name}`);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }));
  results.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(path.join(out, 'smoke.json'), JSON.stringify(results, null, 2));
  const md = ['# Agent and skill smoke tests', '', `Model: claude-sonnet-5-5 (main session; agents use their own model settings). Claude Code: ${spawnSync('claude', ['--version'], { encoding: 'utf8' }).stdout.trim()}.`, '', '| Case | Result | Cost (USD) | Cost by model (USD) |', '|---|---|---|---|',
    ...results.map(r => `| ${r.name} | ${r.pass ? 'pass' : 'FAIL'} | ${r.costUsd?.toFixed(3) ?? ''} | ${Object.entries(r.models ?? {}).map(([m, c]) => `${m.replace('claude-', '')} ${c.toFixed(3)}`).join(', ')} |`)];
  fs.writeFileSync(path.join(out, 'summary.md'), md.join('\n') + '\n');
  console.log(`\n${results.filter(r => r.pass).length}/${results.length} passed; total $${results.reduce((s, r) => s + (r.costUsd ?? 0), 0).toFixed(2)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
