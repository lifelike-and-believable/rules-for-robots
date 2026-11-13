#!/usr/bin/env node
// Change check (docs/specs/process-state.md, AC-5 to AC-8). A pull request that changes source
// belongs to a feature with an approved spec: it changes a process spec, or a test that cites one,
// and that spec is approved or implemented. Otherwise a commit message in it declares the change
// with a `Change: fix` or `Change: trivial` trailer, and the change has to fit: a trivial change
// adds no source file and touches no public-api path; a fix changes a test and adds no source file.
// A feature's pull request also needs its tutorial before it can merge. The pull request that adds
// process.yml passes, and until adoption-until failures are warnings.
// Environment: BASE_SHA, HEAD_SHA. Skipped without process.yml.
// Usage: node checks/ci/process-change.mjs [project root]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CONFIG_PATH, hasId, loadArtifacts, parseArtifact, readConfig, workingTree } from '../lib/process.mjs';
import { isTestOrBaseline } from '../lib/test-paths.mjs';

const NOT_SOURCE = ['docs/', '.github/', '.claude/', '.rfr/'];

// A glob from process.yml's publicApi: ** across folders, * and ? within one. Moved here from the
// tier check when that was retired (rewrite plan 25e).
export function matchGlob(glob, file) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      i++;
      if (glob[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`).test(file);
}
const KINDS = ['fix', 'trivial'];

export function isSource(file) {
  return !NOT_SOURCE.some(prefix => file.startsWith(prefix)) && !/\.md$/i.test(file) && !isTestOrBaseline(file);
}

// The declarations in the commit messages: the value of each `Change:` line that stands alone.
function declarations(messages) {
  const found = new Set();
  for (const message of messages) for (const m of String(message).matchAll(/^change:[ \t]*(\S+)[ \t]*$/gim)) found.add(m[1].toLowerCase());
  return [...found];
}

const WAYS = 'Give it a feature: a spec in docs/specs/ that derives from approved user documentation, approved, with its tests citing it. Or, if it is a bug fix, end a commit message with `Change: fix` (it must change a test and add no source file); if it changes no behaviour, with `Change: trivial` (it must add no source file).';

// files: [{ status, path }] (git's A, M, D, R). messages: the commit messages. specs: the process
// project's specs, [{ name, file, status, isProcess, userDocs }]. cited: spec names the changed
// tests cite. tutorials: the user documentation ids that some tutorial derives from, or null when
// the caller does not know (the tutorial rule is then not applied).
export function checkChange({ files, messages = [], specs = [], cited = [], tutorials = null, config = {}, today = new Date().toISOString().slice(0, 10) }) {
  if (files.some(f => f.status === 'A' && f.path === CONFIG_PATH)) return { ok: true, kind: 'adoption', problems: [], warnings: [] };
  const source = files.filter(f => f.status !== 'D' && isSource(f.path));
  if (!source.length) return { ok: true, kind: 'no-source', problems: [], warnings: [] };

  const problems = [];
  const declared = declarations(messages);
  const added = source.filter(f => f.status === 'A');
  let kind = 'feature';
  if (declared.length > 1) problems.push(`more than one Change: declaration in this pull request's commits (${declared.join(', ')}); use one`);
  else if (declared.length === 1 && !KINDS.includes(declared[0])) problems.push(`unknown declaration "Change: ${declared[0]}": use Change: fix or Change: trivial, or give the change a feature with a spec`);
  else if (declared[0] === 'trivial') {
    kind = 'trivial';
    for (const f of added) problems.push(`a trivial change adds no source file, and this adds ${f.path}: it needs a feature with a spec`);
    for (const f of source) if ((config.publicApi ?? []).some(g => matchGlob(g, f.path))) problems.push(`a trivial change touches no public API path, and this changes ${f.path}: it needs a feature with a spec, or Change: fix`);
  } else if (declared[0] === 'fix') {
    kind = 'fix';
    if (!files.some(f => f.status !== 'D' && isTestOrBaseline(f.path))) problems.push('a fix changes or adds a test that reproduces the bug, and this pull request changes no test');
    for (const f of added) problems.push(`a fix adds no source file, and this adds ${f.path}: it needs a feature with a spec`);
  } else if (!config.waived?.specs) {
    const changed = new Set(files.filter(f => f.status !== 'D').map(f => f.path));
    const mine = specs.filter(s => changed.has(s.file) || cited.includes(s.name));
    if (!mine.some(s => s.isProcess && ['approved', 'implemented'].includes(s.status))) {
      const why = mine.length
        ? `the spec${mine.length === 1 ? '' : 's'} it has (${mine.map(s => `${s.file}: ${s.isProcess ? s.status : 'no id, so not a process artifact'}`).join('; ')}) ${mine.length === 1 ? 'is' : 'are'} not an approved spec`
        : 'no approved spec is changed by it or cited by its tests';
      problems.push(`this pull request changes source (${source.slice(0, 5).map(f => f.path).join(', ')}${source.length > 5 ? `, and ${source.length - 5} more` : ''}) and ${why}. ${WAYS}`);
    } else if (tutorials) {
      // A feature's delivery is not complete without its tutorial (AC-12). The tutorial is in a gated
      // folder, so a pull request that has it waits for the approver; one pushed part-way, without
      // it, must not merge on green checks alone.
      const known = new Set(tutorials);
      for (const s of mine) {
        const docs = [...new Set(s.userDocs ?? [])];
        // A spec already marked implemented was delivered before; it is not asked again here.
        if (s.isProcess && s.status !== 'implemented' && docs.length && !docs.some(d => known.has(d))) problems.push(`the delivery of ${s.file} is not complete: no tutorial in docs/tutorials/ derives from ${docs.join(', ')}. Add it to this branch; the pull request then waits for the approver, who validates the feature by following it`);
      }
    }
  }

  const adopting = config.adoptionUntil && today <= config.adoptionUntil;
  if (problems.length && adopting) return { ok: true, kind, problems: [], warnings: problems };
  return { ok: problems.length === 0, kind, problems, warnings: [] };
}

function git(root, args) {
  const r = spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr.trim()}`);
  return r.stdout;
}

// What the check needs, read from the repository between two commits; the working tree is head.
export function readChange(root, base, head) {
  const files = git(root, ['diff', '--name-status', '--no-renames', `${base}...${head}`]).split('\n').filter(Boolean).map(line => {
    const [status, ...rest] = line.split('\t');
    return { status: status[0], path: rest.join('\t') };
  });
  const messages = git(root, ['log', '--format=%B%x00', `${base}..${head}`]).split('\0').map(m => m.trim()).filter(Boolean);
  const dir = path.join(root, 'docs', 'specs');
  const specs = !fs.existsSync(dir) ? [] : fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    return { name: f.slice(0, -3), file: `docs/specs/${f}`, status: parseArtifact(text).front?.status ?? null, isProcess: hasId(text) };
  });
  // Which user documentation each spec derives from, and which has a tutorial (AC-12).
  const { artifacts } = loadArtifacts(workingTree(root));
  const byId = new Map(artifacts.filter(a => a.id).map(a => [a.id, a]));
  const userDocsOf = a => a.links.map(l => byId.get(l.target)).filter(t => t?.stage === 'user-docs').map(t => t.id);
  for (const s of specs) s.userDocs = userDocsOf(artifacts.find(a => a.file === s.file) ?? { links: [] });
  const tutorials = [...new Set(artifacts.filter(a => a.stage === 'tutorials').flatMap(userDocsOf))].sort();
  const cited = new Set();
  for (const f of files) {
    if (f.status === 'D' || !isTestOrBaseline(f.path)) continue;
    let text = '';
    try { text = fs.readFileSync(path.join(root, f.path), 'utf8'); } catch { continue; }
    for (const m of text.matchAll(/([\w.-]+)#AC-\d+/g)) cited.add(m[1]);
  }
  return { files, messages, specs, cited: [...cited].sort(), tutorials, config: readConfig(root)?.config ?? {} };
}

function main(argv) {
  const root = path.resolve(argv[0] ?? '.');
  if (!readConfig(root)) { console.log('no docs/product/process.yml; nothing to check'); return; }
  const { BASE_SHA: base, HEAD_SHA: head } = process.env;
  if (!base || !head) { console.error('BASE_SHA and HEAD_SHA are required'); process.exit(1); }
  const r = checkChange(readChange(root, base, head));
  // The kind is a job output: the advisory mutation job runs on feature pull requests.
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `kind=${r.kind}\n`);
  for (const w of r.warnings) console.log(`::warning::${w}`);
  for (const p of r.problems) console.error(`::error::${p}`);
  if (!r.ok) process.exit(1);
  console.log({ adoption: 'This pull request adds process.yml, so it adopts the process.', 'no-source': 'No source change.', feature: 'Source change with an approved spec.', fix: 'Declared a fix: a test changes and no source file is added.', trivial: 'Declared trivial: no source file added and no public API path touched.' }[r.kind] + (r.warnings.length ? ' (warnings only until adoption-until)' : ''));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
