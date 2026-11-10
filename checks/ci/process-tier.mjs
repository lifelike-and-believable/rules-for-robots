#!/usr/bin/env node
// Size tier check (docs/specs/project-process.md, "Size tiers", AC-10 as amended by process plan
// 23f). The tier is inferred from the changed paths, as the lowest tier whose rule the change passes:
//   - tier:trivial may not change any process artifact folder or a path matched by process.yml's
//     public-api globs;
//   - tier:fix may not change docs/product/, docs/design/, or docs/user/;
//   - tier:story and tier:epic follow the normal rules.
// A tier label can raise the tier (to tier:epic, say) and cannot lower it: a lower label fails.
// The pull request that adds process.yml adopts the process and needs no tier. The tier is written
// to $GITHUB_OUTPUT as tier=<name>, for the jobs that run only on story and epic pull requests.
// Environment: LABELS (JSON array of label names), BASE_SHA, HEAD_SHA, PR_NUMBER, GITHUB_TOKEN,
// GITHUB_REPOSITORY, GITHUB_OUTPUT. Skipped without process.yml.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CONFIG_PATH, hasId, readConfig, stageOf } from '../lib/process.mjs';

const TIERS = ['trivial', 'fix', 'story', 'epic'];
const FIX_FORBIDDEN = ['docs/product/', 'docs/design/', 'docs/user/'];

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

// What each tier may not change: the files that push a pull request above it.
function aboveTrivial(file, config, processSpecs) {
  const stage = stageOf(file);
  if (stage && (stage !== 'specs' || processSpecs.has(file))) return `tier:trivial changes a process artifact: ${file} (use tier:story or tier:epic)`;
  if ((config.publicApi ?? []).some(g => matchGlob(g, file))) return `tier:trivial changes a public API path: ${file} (use tier:fix or higher)`;
  return null;
}
const aboveFix = file => (FIX_FORBIDDEN.some(prefix => file.startsWith(prefix)) ? `tier:fix changes documented behaviour: ${file} (use tier:story)` : null);

// The lowest tier whose rule the changed files pass.
export function inferTier({ files, config, processSpecs = new Set() }) {
  if (files.some(f => aboveFix(f))) return 'story';
  if (files.some(f => aboveTrivial(f, config, processSpecs))) return 'fix';
  return 'trivial';
}

// processSpecs: the docs/specs files that are process artifacts (have an id). addedFiles: files the
// pull request adds; the one that adds process.yml is adopting the process and needs no tier.
export function checkTier({ labels, files, config, processSpecs = new Set(), addedFiles = new Set() }) {
  const tierLabels = labels.filter(l => /^tier:/.test(l));
  if (!tierLabels.length && addedFiles.has(CONFIG_PATH)) return { ok: true, tier: 'adoption', problems: [] };
  const problems = [];
  if (tierLabels.length === 0) return { ok: true, tier: inferTier({ files, config, processSpecs }), inferred: true, problems };
  if (tierLabels.length > 1) return { ok: false, tier: null, problems: [`more than one tier label: ${tierLabels.join(', ')}`] };
  const tier = tierLabels[0].slice('tier:'.length);
  if (!TIERS.includes(tier)) return { ok: false, tier: null, problems: [`unknown tier label ${tierLabels[0]}: use one of ${TIERS.map(t => `tier:${t}`).join(', ')}`] };

  if (tier === 'trivial') {
    for (const file of files) { const p = aboveTrivial(file, config, processSpecs); if (p) problems.push(p); }
  } else if (tier === 'fix') {
    for (const file of files) { const p = aboveFix(file); if (p) problems.push(p); }
  }
  return { ok: problems.length === 0, tier, inferred: false, problems };
}

// The pull request's labels now. A re-run of a failed job replays its original event, whose labels
// may be out of date, so ask GitHub; fall back to the event's when that is not possible (AC-39).
export async function readLabels({ eventLabels, fetch = globalThis.fetch, api, token, repo, pr }) {
  if (!token || !repo || !pr) return eventLabels;
  try {
    const response = await fetch(`${api}/repos/${repo}/issues/${pr}/labels`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' } });
    if (!response.ok) return eventLabels;
    return (await response.json()).map(l => l.name);
  } catch {
    return eventLabels;
  }
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const loaded = readConfig(root);
  if (!loaded) { console.log('No docs/product/process.yml; tier check skipped.'); return; }
  const git = args => spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: root, encoding: 'utf8' });
  const { BASE_SHA: base, HEAD_SHA: head } = process.env;
  const diff = git(['diff', '--name-only', '--no-renames', `${base}...${head}`]);
  if (diff.status !== 0) { console.error(`git diff ${base}...${head} failed (is the full history fetched?)`); process.exit(1); }
  const files = diff.stdout.split('\n').filter(Boolean);
  const show = (ref, f) => { const r = git(['show', `${ref}:${f}`]); return r.status === 0 ? r.stdout : ''; };
  const processSpecs = new Set(files.filter(f => stageOf(f) === 'specs' && (hasId(show(base, f)) || hasId(show(head, f)))));
  const added = git(['diff', '--name-only', '--no-renames', '--diff-filter=A', `${base}...${head}`]);
  const addedFiles = new Set(added.stdout.split('\n').filter(Boolean));
  let labels = [];
  try { labels = JSON.parse(process.env.LABELS || '[]'); } catch { /* treat as none */ }
  labels = await readLabels({ eventLabels: labels, api: process.env.GITHUB_API_URL || 'https://api.github.com', token: process.env.GITHUB_TOKEN, repo: process.env.GITHUB_REPOSITORY, pr: process.env.PR_NUMBER });
  const r = checkTier({ labels, files, config: loaded.config, processSpecs, addedFiles });
  for (const p of r.problems) console.error(p);
  if (r.ok && process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `tier=${r.tier}\n`);
  if (!r.ok) process.exit(1);
  console.log(r.tier === 'adoption' ? 'This pull request adds process.yml, so it adopts the process and needs no tier.'
    : r.inferred ? `Tier ${r.tier}, inferred from the changed paths; a tier label can raise it.` : `Tier ${r.tier}: ok.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch(e => { console.error(e.message); process.exit(1); });
