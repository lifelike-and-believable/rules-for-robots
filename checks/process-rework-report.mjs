#!/usr/bin/env node
// Process rework report (docs/specs/project-process.md AC-62, process plan 23l). For a repository
// that uses rfr-process, reads the first-parent history of the default branch, offline, and counts
// per stage: artifacts approved, amendments (the body of an approved artifact changed), late
// amendments (the artifact was, at that moment, upstream of an approved stage 8 spec, directly or
// through other artifacts), withdrawals (approved back to draft), and removals (an approved artifact
// deleted). The gate report (process-gate-report.mjs) says what an approval cost; this says how
// often approved intent changed afterwards, and how often after delivery had started.
//
// Usage: node checks/process-rework-report.mjs [root] [--ref <ref>] [--label <name>] [--json]
//   Run it in a clone with the full history of the default branch. --label replaces the folder name
//   in the output. The JSON holds pull request numbers, stages, dates, and counts; no ids, file
//   names, or text, so a summary can be committed elsewhere.
// Exit codes: 0 report printed, 2 usage error or git failed.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hashText, parseArtifact, STAGE_ORDER, STAGES, stageOf } from './lib/process.mjs';

const APPROVED = new Set(['approved', 'implemented']);
const PATHS = [...new Set(STAGES.map(s => s.file ?? s.dir))];
const SEP = '\u0001';

function git(root, args) {
  const r = spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${(r.stderr || '').trim()}`);
  return r.stdout;
}

// The pull request a first-parent commit merged: "Merge pull request #N" or a squash's "(#N)".
export const pullOf = subject => Number((/^Merge pull request #(\d+)\b/.exec(subject) ?? /\(#(\d+)\)\s*$/.exec(subject) ?? [])[1]) || null;

// Each first-parent commit that changed a process artifact, oldest first, with the changed files'
// text after the commit (null when deleted). A merge is compared with its first parent, so a merged
// branch is one change however many commits it had.
export function readHistory(root, ref = 'HEAD') {
  const log = git(root, ['log', ref, '--first-parent', '--diff-merges=first-parent', '--reverse', '-M', '--name-status', `--format=${SEP}%H%x09%cI%x09%s`, '--', ...PATHS]);
  const commits = [];
  for (const chunk of log.split(SEP).slice(1)) {
    const [head, ...lines] = chunk.split('\n');
    const [sha, date, ...subject] = head.split('\t');
    const changes = [];
    for (const line of lines.filter(Boolean)) {
      const [status, a, b] = line.split('\t');
      const kind = status[0];
      const file = kind === 'R' || kind === 'C' ? b : a;
      const from = kind === 'R' ? a : null;
      if (!stageOf(file) && !(from && stageOf(from))) continue;
      const text = kind === 'D' ? null : git(root, ['show', `${sha}:${file}`]);
      changes.push({ kind, file, from, text });
    }
    if (changes.length) commits.push({ sha, date, subject: subject.join('\t'), pr: pullOf(subject.join('\t')), changes });
  }
  return commits;
}

function readArtifact(file, text) {
  const stage = stageOf(file);
  if (!stage || text === null) return null;
  const { front, body, links } = parseArtifact(text);
  if (!front?.id) return null;
  return { id: front.id, stage, status: front.status, hash: hashText(body ?? ''), links: links.map(l => l.target) };
}

// Ids an approved spec derives from, directly or through other artifacts, in the given state.
function specAncestors(state) {
  const byId = new Map([...state.values()].map(a => [a.id, a]));
  const out = new Map();
  for (const spec of state.values()) {
    if (spec.stage !== 'specs' || !APPROVED.has(spec.status)) continue;
    const seen = new Set();
    const stack = [...spec.links];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(byId.get(id)?.links ?? []));
    }
    for (const id of seen) out.set(id, [...(out.get(id) ?? []), spec.id]);
  }
  return out;
}

export function summariseRework(commits) {
  const stages = Object.fromEntries(STAGE_ORDER.map(s => [s, { approved: 0, amendments: 0, late: 0, withdrawn: 0, removed: 0 }]));
  const everApproved = new Set();
  const specsApproved = new Set();
  const specsLate = new Set();
  const events = [];
  const state = new Map();
  for (const c of commits) {
    const upstream = specAncestors(state);
    const next = new Map(state);
    const touched = [];
    for (const ch of c.changes) {
      const prev = state.get(ch.from ?? ch.file) ?? null;
      if (ch.from) next.delete(ch.from);
      const now = readArtifact(ch.file, ch.text);
      if (now) next.set(ch.file, now); else next.delete(ch.file);
      touched.push({ prev, now });
    }
    for (const { prev, now } of touched) {
      const was = prev && APPROVED.has(prev.status);
      const event = kind => { events.push({ pr: c.pr, date: c.date, stage: (now ?? prev).stage, kind, late: false, id: (now ?? prev).id }); return events.at(-1); };
      if (now && APPROVED.has(now.status) && !was) {
        const key = `${now.stage}:${now.id}`;
        if (!everApproved.has(key)) { everApproved.add(key); stages[now.stage].approved++; }
        if (now.stage === 'specs') specsApproved.add(now.id);
        event('approved');
      } else if (was && now && APPROVED.has(now.status) && now.hash !== prev.hash) {
        const e = event('amended');
        stages[now.stage].amendments++;
        const specs = upstream.get(prev.id) ?? [];
        if (specs.length && now.stage !== 'specs') {
          e.late = true;
          stages[now.stage].late++;
          for (const s of specs) specsLate.add(s);
        }
      } else if (was && now && !APPROVED.has(now.status)) {
        event('withdrawn');
        stages[now.stage].withdrawn++;
      } else if (was && !now) {
        event('removed');
        stages[prev.stage].removed++;
      }
    }
    state.clear();
    for (const [k, v] of next) state.set(k, v);
  }
  const used = Object.fromEntries(Object.entries(stages).filter(([, s]) => Object.values(s).some(Boolean)));
  return { commits: commits.length, stages: used, specs: { approved: specsApproved.size, withLateRework: [...specsLate].filter(s => specsApproved.has(s)).length }, events };
}

export function formatRework(label, summary) {
  const { specs } = summary;
  const out = [`${label}: ${specs.withLateRework} of ${specs.approved} approved specs had an upstream artifact amended after the spec was approved.`, '',
    'Stage          Approved  Amendments  Late  Withdrawn  Removed'];
  for (const [name, s] of Object.entries(summary.stages)) {
    out.push(`${name.padEnd(14)} ${String(s.approved).padStart(8)}  ${String(s.amendments).padStart(10)}  ${String(s.late).padStart(4)}  ${String(s.withdrawn).padStart(9)}  ${String(s.removed).padStart(7)}`);
  }
  const late = summary.events.filter(e => e.late);
  if (late.length) {
    out.push('', 'Late amendments:');
    for (const e of late) out.push(`- ${e.pr ? `#${e.pr}` : 'no pull request'} ${e.date.slice(0, 10)}, ${e.stage}: ${e.id}`);
  }
  out.push('', 'An amendment is a change to the body of an approved artifact; front matter, recorded hashes, whitespace, and renames do not count, and wording fixes do. It is late when an approved spec derived from the artifact, directly or through other artifacts, before the change. Each commit on the default branch counts once, and a merge counts as one change.');
  return out.join('\n');
}

function main(argv) {
  const opts = { root: '.', ref: 'HEAD', label: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ref') opts.ref = argv[++i];
    else if (a === '--label') opts.label = argv[++i];
    else if (a === '--json') opts.json = true;
    else if (a.startsWith('-') || i > 0 && opts.root !== '.') { console.error('Usage: process-rework-report.mjs [root] [--ref <ref>] [--label <name>] [--json]'); process.exit(2); }
    else opts.root = a;
  }
  const root = path.resolve(opts.root);
  let summary;
  try { summary = summariseRework(readHistory(root, opts.ref)); } catch (e) { console.error(e.message); process.exit(2); }
  const name = opts.label ?? path.basename(root);
  if (!opts.json) { console.log(formatRework(name, summary)); return; }
  const events = summary.events.map(({ pr, date, stage, kind, late }) => ({ pr, date, stage, kind, late }));
  console.log(JSON.stringify({ repository: name, ref: opts.ref, ...summary, events }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
