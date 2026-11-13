#!/usr/bin/env node
// The verify chain for this repository's CI, cut to what a pull request's changes can affect
// (rewrite plan 25e, verify inventory slice f). `npm run verify` locally still runs everything.
//
// - A documents-only pull request (only Markdown outside rules/, templates/, and plugins/) runs the
//   checks of documents, plans, specs, and the build, and no tests.
// - The tests in test/ run on every other pull request.
// - A plugin's tests (plugins/<name>/test/) run when a file they depend on changes: anything in the
//   plugin, any repository file their imports reach (followed through every import), or a
//   repository path their source names in quotes (fixtures, examples, workflows).
// - The Unreal sample check runs when rfr-unreal, checks/unreal/, or examples/unreal/ changes.
// - A change to the test setup itself (package.json, the lock file, the CI workflow, this script)
//   runs everything, and so does a run with no base (a push to main).
//
// Usage: node checks/ci/verify-ci.mjs [--base <commit>] [--plan] [--github-output]
//   --plan             print the plan as JSON and run nothing
//   --github-output    with --plan, also write docs-only=true|false to $GITHUB_OUTPUT
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const EVERYTHING = [/^package(-lock)?\.json$/, /^\.github\/workflows\/verify\.yml$/, /^checks\/ci\/verify-ci\.mjs$/];
const UNREAL_SAMPLE = [/^plugins\/unreal\//, /^checks\/unreal\//, /^examples\/unreal\//];

const toPosix = p => p.split(path.sep).join('/');

export function isDocsOnly(changed) {
  return changed.length > 0 && changed.every(f => f.endsWith('.md') && !/^(rules|templates|plugins)\//.test(f));
}

// Every repository file a test file reaches through relative imports, static or dynamic, plus the
// repository paths the test file itself names in quotes (the fixtures and examples it reads; paths
// named inside the code under test are that code's business, not the test's). Paths are relative to
// root, with forward slashes.
export function dependencies(root, file) {
  const seen = new Set();
  const named = new Set();
  const visit = rel => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs) || !/\.m?js$/.test(rel)) return;
    const text = fs.readFileSync(abs, 'utf8');
    for (const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)'(\.{1,2}\/[^']+)'/g)) {
      visit(toPosix(path.relative(root, path.resolve(path.dirname(abs), m[1]))));
    }
    if (rel !== file) return;
    for (const m of text.matchAll(/['`]((?:[\w.-]+\/)+[\w.-]*)['`]/g)) {
      const candidate = m[1].replace(/\/$/, '');
      if (!/^\.\.?\//.test(candidate) && fs.existsSync(path.join(root, candidate))) named.add(candidate);
    }
  };
  visit(file);
  return { files: [...seen], named: [...named] };
}

const listTests = dir => (fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).map(String).filter(f => f.endsWith('.test.mjs')) : []);

// What to run, from the changed paths. With changed === null (no base), everything.
export function plan(root, changed) {
  const plugins = fs.readdirSync(path.join(root, 'plugins')).filter(p => listTests(path.join(root, 'plugins', p, 'test')).length).sort();
  if (changed === null || changed.some(f => EVERYTHING.some(re => re.test(f)))) {
    return { docsOnly: false, rootTests: true, plugins, unrealSample: true, reason: changed === null ? 'no base: everything' : 'the test setup changed: everything' };
  }
  if (isDocsOnly(changed)) return { docsOnly: true, rootTests: false, plugins: [], unrealSample: false, reason: 'documents only' };
  const touches = (prefixes, files) => changed.some(f => files.includes(f) || prefixes.some(p => f === p || f.startsWith(`${p}/`)));
  const run = plugins.filter(p => {
    const prefixes = [`plugins/${p}`];
    const files = [];
    for (const t of listTests(path.join(root, 'plugins', p, 'test'))) {
      const deps = dependencies(root, toPosix(path.join('plugins', p, 'test', t)));
      files.push(...deps.files);
      prefixes.push(...deps.named);
    }
    return touches(prefixes, files);
  });
  return { docsOnly: false, rootTests: true, plugins: run, unrealSample: changed.some(f => UNREAL_SAMPLE.some(re => re.test(f))), reason: 'from the changed files' };
}

function changedSince(root, base) {
  const r = spawnSync('git', ['diff', '--name-only', '--no-renames', `${base}...HEAD`], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git diff against ${base} failed: ${r.stderr}`);
  return r.stdout.split('\n').filter(Boolean);
}

// The steps of `npm run verify`, in its order, each with whether this plan runs it.
export function steps(p) {
  const tests = [...(p.rootTests ? ['test/**/*.test.mjs'] : []), ...p.plugins.map(name => `plugins/${name}/test/**/*.test.mjs`)];
  return [
    { name: 'lint:rules', cmd: ['npm', 'run', 'lint:rules'] },
    { name: 'setup:vale', cmd: ['npm', 'run', 'setup:vale'], skip: !tests.length && 'no tests run' },
    { name: 'tests', cmd: [process.execPath, '--test', ...tests], skip: !tests.length && 'no tests run' },
    { name: 'check:release', cmd: ['npm', 'run', 'check:release'] },
    { name: 'check:plan', cmd: ['npm', 'run', 'check:plan'] },
    { name: 'check:specs', cmd: ['npm', 'run', 'check:specs'] },
    { name: 'check:process', cmd: ['npm', 'run', 'check:process'] },
    { name: 'check:instructions', cmd: ['npm', 'run', 'check:instructions'] },
    { name: 'build:check', cmd: ['npm', 'run', 'build:check'] },
    { name: 'check:unreal-sample', cmd: ['npm', 'run', 'check:unreal-sample'], skip: !p.unrealSample && 'rfr-unreal, checks/unreal/, and examples/unreal/ are unchanged' },
    { name: 'validate:plugins', cmd: ['npm', 'run', 'validate:plugins'] },
  ];
}

function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf('--base');
  const base = at >= 0 ? args[at + 1] : process.env.BASE_SHA || '';
  const root = process.cwd();
  const p = plan(root, base ? changedSince(root, base) : null);
  if (args.includes('--plan')) {
    console.log(JSON.stringify(p, null, 2));
    if (args.includes('--github-output') && process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `docs-only=${p.docsOnly}\n`);
    return;
  }
  console.log(`verify plan (${p.reason}): root tests ${p.rootTests ? 'yes' : 'no'}; plugin tests: ${p.plugins.join(', ') || 'none'}; Unreal sample ${p.unrealSample ? 'yes' : 'no'}`);
  for (const s of steps(p)) {
    if (s.skip) { console.log(`\n> ${s.name}: skipped (${s.skip})`); continue; }
    console.log(`\n> ${s.name}`);
    // npm is a .cmd on Windows, which spawnSync runs only through a shell.
    const r = spawnSync(s.cmd[0], s.cmd.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' && s.cmd[0] === 'npm' });
    if (r.status !== 0) { console.error(`\n${s.name} failed (exit ${r.status ?? r.signal})`); process.exit(r.status || 1); }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();
