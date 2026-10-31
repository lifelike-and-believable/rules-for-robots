#!/usr/bin/env node
// Process check (docs/specs/project-process.md). Reads docs/product/process.yml and the process
// artifacts (concept to tutorials), and fails on:
//   1. a duplicate id, or a link to an id or section that does not exist;
//   2. a cycle of links;
//   3. an approved artifact that links to a draft (or withdrawn) one;
//   4. an approved artifact whose recorded hash for a linked section is missing or out of date;
//   5. a story that names no persona, or a persona that is not approved;
//   6. a spec `test:` criterion whose Source cell names no approved story or user documentation
//      section in the spec's derived-from;
//   7. with --base, an artifact approved at the base and now draft without a `withdrawn` entry.
// Staleness is direct only. Before process.yml's adoption-until date, problems with artifacts that
// have no links yet are warnings. --status lists personas, epics, and stories instead.
// Usage: node checks/process-trace.mjs [project root] [--base <ref>] [--status] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CONFIG_PATH, STAGE_ORDER, loadArtifacts, parseProcessConfig, sectionHash, workingTree } from './lib/process.mjs';

const isApproved = a => a?.status === 'approved' || a?.status === 'implemented';
const WITHDRAWN = /\S.*#\d+/;

function gitTree(root, ref) {
  const git = args => spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: root, encoding: 'utf8' });
  if (git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).status !== 0) return null;
  return {
    listDir: dir => git(['ls-tree', '-r', '--name-only', ref, '--', dir]).stdout.split('\n').filter(f => f.endsWith('.md')).sort(),
    fileExists: file => git(['cat-file', '-e', `${ref}:${file}`]).status === 0,
    read: file => git(['show', `${ref}:${file}`]).stdout,
  };
}

function parseCriteria(body) {
  const section = /^## Acceptance criteria\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(body)?.[1] ?? '';
  const out = [];
  for (const row of section.split('\n').filter(l => l.trim().startsWith('|'))) {
    const cells = row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    if (!/^AC-\d+$/.test(cells[0] ?? '')) continue;
    out.push({ id: cells[0], needsTest: /^test:/i.test(cells[2] ?? ''), sources: (cells[3] ?? '').split(/[,\s]+/).filter(Boolean) });
  }
  return out;
}

function load(root) {
  const errors = [];
  let config = null;
  const configFile = path.join(root, CONFIG_PATH);
  if (fs.existsSync(configFile)) {
    const parsed = parseProcessConfig(fs.readFileSync(configFile, 'utf8'));
    config = parsed.config;
    errors.push(...parsed.errors.map(e => (e.startsWith('process.yml') ? e : `process.yml: ${e}`)));
  }
  const { artifacts, errors: loadErrors } = loadArtifacts(workingTree(root));
  errors.push(...loadErrors);
  return { config, artifacts, errors };
}

// Current hash of each link, and whether each approved artifact is stale.
function analyse(artifacts) {
  const byId = new Map();
  for (const a of artifacts) if (a.id && !byId.has(a.id)) byId.set(a.id, a);
  const linkState = new Map(); // artifact -> [{ link, target, current }]
  for (const a of artifacts) {
    linkState.set(a, a.links.map(link => {
      const target = byId.get(link.target);
      return { link, target, current: target ? sectionHash(target.body, link.section) : null };
    }));
  }
  const stale = a => isApproved(a) && linkState.get(a).some(s => s.current !== null && s.link.hash !== s.current);
  return { byId, linkState, stale };
}

export function runProcessTrace(root, { base = null, now = new Date() } = {}) {
  const { config, artifacts, errors: loadErrors } = load(root);
  const errors = [...loadErrors];
  const warnings = [];
  if (artifacts.length && !config) errors.push(`${CONFIG_PATH} is missing; it names the approvers for each stage (docs/specs/project-process.md)`);
  const adopting = !!config?.adoptionUntil && now.toISOString().slice(0, 10) <= config.adoptionUntil;
  const { byId, linkState } = analyse(artifacts);

  const seen = new Map();
  for (const a of artifacts) {
    if (!a.id) continue;
    if (seen.has(a.id)) errors.push(`duplicate id ${a.id} in ${seen.get(a.id)} and ${a.file}`);
    else seen.set(a.id, a.file);
  }

  for (const a of artifacts) {
    const problems = adopting && a.links.length === 0 ? warnings : errors;
    const name = a.id ?? a.file;
    if (!a.id) { errors.push(`${a.file}: no id`); continue; }
    if (!a.status) problems.push(`${name}: no status`);
    else if (!['draft', 'approved', 'implemented'].includes(a.status)) problems.push(`${name}: unknown status ${a.status} (draft, approved, or implemented)`);
    else if (a.status === 'implemented' && a.stage !== 'specs') problems.push(`${name}: status implemented is only for specs`);
    if (a.withdrawn && a.status !== 'draft') problems.push(`${name}: withdrawn is only for draft artifacts`);
    if (a.withdrawn && !WITHDRAWN.test(a.withdrawn)) problems.push(`${name}: withdrawn needs a reason and an issue number, like "the flow changed (#12)"`);

    for (const { link, target, current } of linkState.get(a)) {
      if (!target) { problems.push(`${name}: links to ${link.target}, which does not exist`); continue; }
      if (current === null) { problems.push(`${name}: ${link.target} has no section ${link.section}`); continue; }
      if (!isApproved(a)) continue;
      if (!isApproved(target)) problems.push(`${name}: links to ${target.id}, which is ${target.status ?? 'without a status'}`);
      if (!link.hash) problems.push(`${name}: the link to ${link.key} has no recorded hash`);
      else if (link.hash !== current) problems.push(`${name}: stale: ${link.key} changed since it was recorded`);
    }

    if (a.stage === 'stories') {
      const personas = a.links.map(l => byId.get(l.target)).filter(t => t?.stage === 'personas');
      if (!personas.length) problems.push(`${name}: names no persona (link one in derived-from)`);
      for (const p of personas) if (!isApproved(p)) problems.push(`${name}: persona ${p.id} is not approved`);
    }

    if (a.stage === 'specs') {
      for (const c of parseCriteria(a.body).filter(c => c.needsTest)) {
        if (!c.sources.length) { problems.push(`${name}#${c.id}: test: criterion has no source (an approved story or user documentation section)`); continue; }
        for (const src of c.sources) {
          const link = a.links.find(l => l.key === src);
          const stage = link && byId.get(link.target)?.stage;
          if (!link) problems.push(`${name}#${c.id}: source ${src} is not in derived-from`);
          else if (stage && stage !== 'stories' && stage !== 'user-docs') problems.push(`${name}#${c.id}: source ${src} is not a story or user documentation`);
        }
      }
    }
  }

  // Rule 2: cycles, reported once each.
  const state = new Map();
  const reported = new Set();
  const visit = (a, trail) => {
    state.set(a, 'open');
    for (const l of a.links) {
      const t = byId.get(l.target);
      if (!t) continue;
      if (state.get(t) === 'open') {
        const cycle = [...trail.slice(trail.indexOf(t.id)), t.id];
        const key = [...new Set(cycle)].sort().join(',');
        if (!reported.has(key)) { reported.add(key); errors.push(`cycle: ${cycle.join(' -> ')}`); }
      } else if (!state.has(t)) visit(t, [...trail, t.id]);
    }
    state.set(a, 'done');
  };
  for (const a of byId.values()) if (!state.has(a)) visit(a, [a.id]);

  // Rule 7: withdrawals since the base.
  if (base) {
    const tree = gitTree(root, base);
    if (!tree) errors.push(`base ${base} not found (is the full history fetched?)`);
    else {
      const before = new Map(loadArtifacts(tree).artifacts.filter(a => a.id).map(a => [a.id, a]));
      for (const a of artifacts) {
        if (a.status === 'draft' && !a.withdrawn && isApproved(before.get(a.id))) {
          errors.push(`${a.id}: was approved at ${base} and is now draft without a withdrawn entry (a reason and an issue)`);
        }
      }
    }
  }

  return { errors, warnings, checked: artifacts.length };
}

// One row per persona, epic, and story: its status, the furthest stage that approved work below
// it has reached, and anything below it (or itself) that is stale or withdrawn.
export function processStatus(root) {
  const { artifacts } = load(root);
  const { byId, stale } = analyse(artifacts);
  const below = new Map([...byId.values()].map(a => [a, []]));
  for (const a of byId.values()) for (const l of a.links) { const t = byId.get(l.target); if (t && t !== a) below.get(t).push(a); }
  const rows = [];
  for (const a of byId.values()) {
    if (!['personas', 'epics', 'stories'].includes(a.stage)) continue;
    const seen = new Set([a]);
    const queue = [a];
    while (queue.length) for (const d of below.get(queue.shift())) if (!seen.has(d)) { seen.add(d); queue.push(d); }
    const approved = [...seen].filter(isApproved).map(x => STAGE_ORDER.indexOf(x.stage));
    const attention = [...seen]
      .map(x => (x.withdrawn ? { id: x.id, problem: 'withdrawn' } : stale(x) ? { id: x.id, problem: 'stale' } : null))
      .filter(Boolean)
      .sort((p, q) => p.id.localeCompare(q.id));
    rows.push({ id: a.id, stage: a.stage, status: a.status, reached: approved.length ? STAGE_ORDER[Math.max(...approved)] : null, attention });
  }
  return rows.sort((p, q) => STAGE_ORDER.indexOf(p.stage) - STAGE_ORDER.indexOf(q.stage) || p.id.localeCompare(q.id));
}

function main(argv) {
  const args = [...argv];
  const flag = name => { const i = args.indexOf(name); if (i === -1) return false; args.splice(i, 1); return true; };
  const option = name => { const i = args.indexOf(name); if (i === -1) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
  const status = flag('--status');
  const json = flag('--json');
  const base = option('--base');
  const root = path.resolve(args[0] ?? '.');

  if (status) {
    const rows = processStatus(root);
    if (json) { console.log(JSON.stringify(rows, null, 2)); return; }
    if (!rows.length) { console.log('No personas, epics, or stories.'); return; }
    for (const r of rows) {
      const notes = r.attention.map(p => `${p.id} ${p.problem}`).join(', ');
      console.log(`${r.stage.padEnd(9)} ${r.id.padEnd(32)} ${r.status.padEnd(9)} reached: ${r.reached ?? '-'}${notes ? `  attention: ${notes}` : ''}`);
    }
    return;
  }

  const r = runProcessTrace(root, { base });
  if (json) console.log(JSON.stringify(r, null, 2));
  for (const w of r.warnings) console.warn(`warning: ${w}`);
  for (const e of r.errors) console.error(e);
  if (r.errors.length) process.exit(1);
  if (!json) console.log(r.checked ? `${r.checked} process artifact(s) checked; links are current.` : 'No process artifacts.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));

// Stub: implemented in 11b.
export function staleAssignees() { return []; }
