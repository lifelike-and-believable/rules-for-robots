#!/usr/bin/env node
// Pull request description (docs/specs/delivery-run.md, AC-7). Under the GitHub gate a workflow
// opens the pull request, so the agent does not write its description; this builds one from the
// branch: each changed design that lets a spec skip user documentation, the review packet for the
// process artifacts the branch changes, the decision files it changes, and, for a gated change,
// the line the lead can run to approve it.
// Usage: node checks/ci/process-pr-body.mjs [project root] --base <ref> [--number <n>] [--branch <name>]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gateOf, parseArtifact, readConfig, readWorkMode, stageOf } from '../lib/process.mjs';
import { buildPacket, changedArtifacts, formatPacket } from '../process-packet.mjs';

export function prBody({ packet = '', enabling = [], decisions = [], gated = false, number = null, branch = '' }) {
  const out = [];
  if (enabling.length) {
    out.push('## Skips user documentation', '', 'Approving this pull request lets a spec derive from the design below with no user documentation, because the work has nothing a user sees. Check that is true.', '');
    for (const e of enabling) out.push(`- **${e.id}** (\`${e.file}\`): ${e.reason}`);
    out.push('');
  }
  if (packet.trim()) out.push(packet.trim(), '');
  if (decisions.length) {
    out.push('## Decisions', '', 'Set aside or decided by the agent during the run, for you to confirm:', '');
    for (const d of decisions) out.push(`From \`${d.file}\`:`, '', d.text.trim(), '');
  }
  out.push(`Opened by the rfr-process workflow for branch \`${branch}\`.`);
  if (gated) out.push('', `This pull request touches a folder that needs the approver's review. To approve from the Claude Code prompt: \`! gh pr review ${number ?? branch} --approve\``);
  return `${out.join('\n')}\n`;
}

// What the description needs, read from the repository: the branch is HEAD, compared with base.
export function readPrBody(root, base) {
  const artifacts = changedArtifacts(root, base);
  const config = readConfig(root)?.config ?? {};
  const mode = readWorkMode(root);
  const gated = artifacts.some(a => (a.stage !== 'specs' || (config.stages?.specs?.length ?? 0) > 0) && gateOf(a.stage, config, mode) === 'approve');
  const diff = spawnSync('git', ['-c', 'core.quotepath=off', 'diff', '--name-only', '--diff-filter=AMR', `${base}...HEAD`], { cwd: root, encoding: 'utf8' });
  const files = (diff.stdout ?? '').split('\n').filter(Boolean);
  const read = file => { try { return fs.readFileSync(path.join(root, file), 'utf8'); } catch { return ''; } };
  const enabling = files.filter(f => stageOf(f) === 'design').map(f => ({ file: f, front: parseArtifact(read(f)).front })).filter(e => e.front?.noUserDocs).map(e => ({ id: e.front.id ?? e.file, file: e.file, reason: e.front.noUserDocs }));
  const decisions = files.filter(f => /^docs\/decisions\/[^/]+\.md$/.test(f)).map(f => ({ file: f, text: read(f) })).filter(d => d.text.trim());
  const packet = artifacts.length ? formatPacket(buildPacket({ artifacts })) : '';
  return { packet, enabling, decisions, gated };
}

function main(argv) {
  const value = flag => { const i = argv.indexOf(flag); return i === -1 ? null : argv[i + 1]; };
  const flags = new Set(['--base', '--number', '--branch']);
  const root = path.resolve(argv.find((a, i) => !a.startsWith('--') && !flags.has(argv[i - 1])) ?? '.');
  const base = value('--base');
  if (!base) { console.error('Usage: process-pr-body.mjs [project root] --base <ref> [--number <n>] [--branch <name>]'); process.exit(2); }
  process.stdout.write(prBody({ ...readPrBody(root, base), number: value('--number'), branch: value('--branch') ?? '' }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
