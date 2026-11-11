#!/usr/bin/env node
// Review packet (docs/specs/project-process.md AC-59, process plan 23c). The section at the top of a
// product brief's or feature packet's pull request description, so the approver reads the decisions
// first: every [open] choice, every [assumed] answer, the persona walkthrough's blocks and misleads
// findings with what was done about each, and links to the mock-ups and recordings, for the process
// artifacts the pull request changes.
//
// Usage: node checks/process-packet.mjs [root] --base <ref> [--head <ref>] [--walkthrough <report.md>]... [--json]
//   Prints Markdown between <!-- rfr-review-packet --> markers, to paste at the top of the pull
//   request description (or replace the earlier packet there). A walkthrough finding may carry a
//   "- **Done:** ..." line saying what was changed; one without it is listed as not yet addressed.
// Exit codes: 0 printed, 2 usage error or git failed.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openItems, parseArtifact, stageOf } from './lib/process.mjs';

export const START = '<!-- rfr-review-packet -->';
export const END = '<!-- /rfr-review-packet -->';
const MEDIA = /!?\[([^\]]*)\]\(([^)\s]+\.(?:png|jpe?g|gif|svg|webp|mp4|webm|mov))\)/gi;

// Persona walkthrough findings (agents/persona-walkthrough.md): one block per "- **Persona:**" line.
export function walkthroughFindings(text) {
  const findings = [];
  let current = null;
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const field = /^\s*-\s+\*\*(Persona|Where|Failure|Expected|Severity|Points to|Done):\*\*\s*(.*)$/i.exec(line);
    if (!field) continue;
    const key = field[1].toLowerCase().replace(' ', '');
    if (key === 'persona') { current = { persona: field[2].trim() }; findings.push(current); continue; }
    if (current) current[key] = field[2].trim().replace(/^`|`$/g, '');
  }
  return findings;
}

export function walkthroughMismatches() { return []; }

export function buildPacket({ artifacts, walkthroughs = [] }) {
  const items = { open: [], assumed: [], proposed: [] };
  const media = [];
  for (const a of artifacts) {
    for (const item of openItems(a.body, a.bodyLine)) {
      const key = item.marker.slice(1, -1);
      if (items[key]) items[key].push({ file: a.file, line: item.line, text: item.text });
    }
    for (const m of a.body.matchAll(MEDIA)) {
      const target = /^https?:/.test(m[2]) ? m[2] : path.posix.join(path.posix.dirname(a.file), m[2]);
      if (!media.some(x => x.target === target)) media.push({ file: a.file, label: m[1] || path.posix.basename(target), target });
    }
  }
  const serious = walkthroughs.flatMap(walkthroughFindings).filter(f => /^(blocks|misleads)$/i.test(f.severity ?? ''));
  return { artifacts: artifacts.map(a => ({ file: a.file, id: a.id, stage: a.stage, status: a.status })), choices: items.open, assumptions: items.assumed, proposals: items.proposed, findings: serious, media };
}

const cite = i => `\`${i.file}:${i.line}\` ${i.text.replace(/^[-*]\s+/, '')}`;

export function formatPacket(p) {
  const out = [START, '## Review packet', ''];
  out.push(`### Choices for you (${p.choices.length})`, '');
  out.push(...(p.choices.length ? p.choices.map(c => `- ${cite(c)}`) : ['None: nothing is marked `[open]`.']), '');
  out.push(`### Assumptions to confirm (${p.assumptions.length})`, '');
  out.push(...(p.assumptions.length ? p.assumptions.map(c => `- ${cite(c)}`) : ['None marked `[assumed]`.']), '');
  if (p.proposals.length) out.push(`### Proposals (${p.proposals.length})`, '', ...p.proposals.map(c => `- ${cite(c)}`), '');
  out.push(`### Walkthrough: blocks and misleads (${p.findings.length})`, '');
  out.push(...(p.findings.length
    ? p.findings.map(f => `- **${f.severity}**, ${f.persona}: ${f.where ?? 'unknown place'}. ${f.failure ?? ''} Done: ${(f.done ?? 'not yet addressed').replace(/\.$/, '')}.`.replace(/\s+/g, ' '))
    : ['None reported, or no walkthrough was given.']), '');
  out.push(`### Mock-ups and recordings (${p.media.length})`, '');
  out.push(...(p.media.length ? p.media.map(m => `- [${m.label}](${m.target}) (in \`${m.file}\`)`) : ['None linked.']), '');
  out.push(`### Artifacts (${p.artifacts.length})`, '', ...p.artifacts.map(a => `- \`${a.file}\`: ${a.stage}${a.id ? `, ${a.id}` : ''}, ${a.status ?? 'no status'}`), END);
  return out.join('\n');
}

export function changedArtifacts(root, base, head = 'HEAD') {
  const git = args => spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: root, encoding: 'utf8' });
  const diff = git(['diff', '--name-only', '--diff-filter=AMR', `${base}...${head}`]);
  if (diff.status !== 0) throw new Error(`git diff ${base}...${head} failed: ${diff.stderr.trim()}`);
  const out = [];
  for (const file of diff.stdout.split('\n').filter(Boolean)) {
    const stage = stageOf(file);
    if (!stage) continue;
    const show = git(['show', `${head}:${file}`]);
    if (show.status !== 0) continue;
    const parsed = parseArtifact(show.stdout);
    if (stage === 'specs' && !parsed.front?.id) continue;
    const body = parsed.body ?? '';
    // The body's first line in the file, so cited line numbers match the file.
    const bodyLine = show.stdout.slice(0, show.stdout.length - body.length).split('\n').length;
    out.push({ file, stage, id: parsed.front?.id ?? null, status: parsed.front?.status ?? null, body, bodyLine });
  }
  return out;
}

function main(argv) {
  const opts = { walkthroughs: [], json: false, root: '.', base: null, head: 'HEAD' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') opts.base = argv[++i];
    else if (a === '--head') opts.head = argv[++i];
    else if (a === '--walkthrough') opts.walkthroughs.push(argv[++i]);
    else if (a === '--json') opts.json = true;
    else if (a.startsWith('-')) { console.error(`unknown option ${a}`); process.exit(2); }
    else opts.root = a;
  }
  if (!opts.base) { console.error('Usage: process-packet.mjs [root] --base <ref> [--head <ref>] [--walkthrough <report.md>]... [--json]'); process.exit(2); }
  let artifacts;
  try { artifacts = changedArtifacts(path.resolve(opts.root), opts.base, opts.head); } catch (e) { console.error(e.message); process.exit(2); }
  const walkthroughs = opts.walkthroughs.map(f => fs.readFileSync(f, 'utf8'));
  const packet = buildPacket({ artifacts, walkthroughs });
  console.log(opts.json ? JSON.stringify(packet, null, 2) : formatPacket(packet));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
