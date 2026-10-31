#!/usr/bin/env node
// Size tier check (docs/specs/project-process.md, "Size tiers"). A pull request carries exactly one
// tier label: tier:trivial, tier:fix, tier:story, or tier:epic.
//   - tier:trivial may not change any process artifact folder or a path matched by process.yml's
//     public-api globs;
//   - tier:fix may not change docs/product/, docs/design/, or docs/user/;
//   - tier:story and tier:epic follow the normal rules.
// A change that alters documented behaviour therefore has to be labelled at least tier:story.
// Environment: LABELS (JSON array of label names), BASE_SHA, HEAD_SHA. Skipped without process.yml.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hasId, readConfig, stageOf } from '../lib/process.mjs';

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

// processSpecs: the docs/specs files that are process artifacts (have an id).
export function checkTier({ labels, files, config, processSpecs = new Set() }) {
  const tierLabels = labels.filter(l => /^tier:/.test(l));
  const problems = [];
  if (tierLabels.length === 0) return { ok: false, tier: null, problems: [`no tier label: add one of ${TIERS.map(t => `tier:${t}`).join(', ')}`] };
  if (tierLabels.length > 1) return { ok: false, tier: null, problems: [`more than one tier label: ${tierLabels.join(', ')}`] };
  const tier = tierLabels[0].slice('tier:'.length);
  if (!TIERS.includes(tier)) return { ok: false, tier: null, problems: [`unknown tier label ${tierLabels[0]}: use one of ${TIERS.map(t => `tier:${t}`).join(', ')}`] };

  if (tier === 'trivial') {
    for (const file of files) {
      const stage = stageOf(file);
      if (stage && (stage !== 'specs' || processSpecs.has(file))) problems.push(`tier:trivial changes a process artifact: ${file} (use tier:story or tier:epic)`);
      else if ((config.publicApi ?? []).some(g => matchGlob(g, file))) problems.push(`tier:trivial changes a public API path: ${file} (use tier:fix or higher)`);
    }
  } else if (tier === 'fix') {
    for (const file of files) {
      if (FIX_FORBIDDEN.some(prefix => file.startsWith(prefix))) problems.push(`tier:fix changes documented behaviour: ${file} (use tier:story)`);
    }
  }
  return { ok: problems.length === 0, tier, problems };
}

function main() {
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
  let labels = [];
  try { labels = JSON.parse(process.env.LABELS || '[]'); } catch { /* treat as none */ }
  const r = checkTier({ labels, files, config: loaded.config, processSpecs });
  for (const p of r.problems) console.error(p);
  if (!r.ok) process.exit(1);
  console.log(`Tier ${r.tier}: ok.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();
