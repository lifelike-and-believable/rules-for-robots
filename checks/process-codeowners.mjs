#!/usr/bin/env node
// CODEOWNERS block for the project process (docs/specs/project-process.md, "CODEOWNERS"). Writes a
// managed block in .github/CODEOWNERS that maps each gated stage folder to its approvers from
// docs/product/process.yml, leaving the rest of the file alone. With --check it writes nothing and
// fails when the block is missing or differs.
// Usage: node checks/process-codeowners.mjs [project root] [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGES, approversFor, gatedStages, gateOf, readConfig, readWorkMode } from './lib/process.mjs';

export const BEGIN = '# rfr-process:begin (generated from docs/product/process.yml; do not edit by hand)';
export const END = '# rfr-process:end';
const CODEOWNERS = '.github/CODEOWNERS';

const owner = a => (a.startsWith('@') ? a : `@${a}`);

// The block for every stage whose gate is `approve` and that has approvers: those are the folders
// branch protection holds for a code owner's review (github-gate AC-2). The GitHub gate's setup script
// writes this same block, so the drift check and the gate agree. Solo and team mode get the same block
// since rewrite plan 25e: a workflow opens each pull request as a GitHub App, so the approver can review it.
export function renderBlock(config, workMode = 'supervised') {
  const gated = new Set(gatedStages(config));
  const lines = [BEGIN];
  for (const stage of STAGES) {
    if (!gated.has(stage.name) || gateOf(stage.name, config, workMode) !== 'approve') continue;
    const approvers = approversFor(stage.name, config);
    if (!approvers?.length) continue;
    lines.push(`${stage.file ? `/${stage.file}` : `/${stage.dir}/`} ${approvers.map(owner).join(' ')}`);
  }
  lines.push(END, '');
  return lines.join('\n');
}

function currentBlock(text) {
  const start = text.indexOf(BEGIN);
  if (start === -1) return null;
  const end = text.indexOf(END, start);
  if (end === -1) return null;
  const stop = text.indexOf('\n', end);
  return { start, end: stop === -1 ? text.length : stop + 1 };
}

export function applyBlock(text, block) {
  const at = currentBlock(text);
  if (at) return text.slice(0, at.start) + block + text.slice(at.end);
  if (!text.trim()) return block;
  return `${text.replace(/\s*$/, '')}\n\n${block}`;
}

export function runCodeowners(root, { check = false } = {}) {
  const loaded = readConfig(root);
  if (!loaded) return { ok: true, message: 'no docs/product/process.yml; nothing to do' };
  if (loaded.errors.length) return { ok: false, message: loaded.errors.join('\n') };
  const block = renderBlock(loaded.config, readWorkMode(root));
  const file = path.join(root, CODEOWNERS);
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const at = currentBlock(text);
  const current = at ? text.slice(at.start, at.end) : null;
  if (check) {
    if (current === block) return { ok: true, message: `${CODEOWNERS}: the rfr-process block is current` };
    return { ok: false, message: `${CODEOWNERS}: the rfr-process block ${current === null ? 'is missing' : 'differs from docs/product/process.yml'} (run node checks/process-codeowners.mjs)` };
  }
  if (current === block) return { ok: true, message: `${CODEOWNERS}: already current` };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, applyBlock(text, block));
  return { ok: true, message: `${CODEOWNERS}: rfr-process block written` };
}

function main(argv) {
  const check = argv.includes('--check');
  const root = path.resolve(argv.find(a => !a.startsWith('--')) ?? '.');
  const r = runCodeowners(root, { check });
  (r.ok ? console.log : console.error)(r.message);
  if (!r.ok) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
