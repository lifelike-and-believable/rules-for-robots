#!/usr/bin/env node
// Pull request description (docs/specs/delivery-run.md, AC-7). Under the GitHub gate a workflow
// opens the pull request, so the agent does not write its description; this builds one from the
// branch: each changed design that lets a spec skip user documentation, the review packet for the
// process artifacts the branch changes, the decision files it changes, where to try the change when
// it adds or changes a tutorial, and, for a gated change, the line the lead can run to approve it.
// Usage: node checks/ci/process-pr-body.mjs [project root] --base <ref> [--number <n>] [--branch <name>]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gateOf, parseArtifact, readConfig, readWorkMode, stageOf, tryItLines, tutorialTitle } from '../lib/process.mjs';
import { buildPacket, changedArtifacts, formatPacket } from '../process-packet.mjs';

export function prBody({ packet = '', enabling = [], decisions = [], tutorials = [], tryIt = null, gated = false, number = null, branch = '' }) {
  const out = [];
  // Accepting a delivery and validating it are two approvals (AC-11). A tutorial that is still a
  // draft means this pull request delivers the feature; one marked approved means it records the
  // lead's validation.
  const drafts = tutorials.filter(t => t.status !== 'approved');
  const validated = tutorials.filter(t => t.status === 'approved');
  if (drafts.length) {
    out.push('## Built, not yet validated', '', `Approving this pull request accepts the work onto the default branch. It does not record that you have validated the feature: ${drafts.map(t => `\`${t.file}\``).join(', ')} ${drafts.length === 1 ? 'is' : 'are'} still a draft.`, '', 'To validate, follow the tutorial against the delivery. When it holds, ask an agent to set its `status: approved`; that comes to you as a pull request of its own, and approving it is your validation. If a step does not go as written, say which, and the tutorial stays a draft until it does.', '');
  }
  if (validated.length) {
    out.push('## Validation', '', `Approving this pull request records that you followed ${validated.map(t => `\`${t.file}\``).join(', ')} against the delivery and the feature does what the user documentation says.`, '');
  }
  // Where to try it (lasting-tutorials AC-8): only when the pull request adds or changes a tutorial.
  const tryLines = tryItLines({ ...(tryIt ?? {}), where: 'below' });
  if (tryLines.length) out.push('## Try it', '', ...tryLines, '');
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
  const tutorials = artifacts.filter(a => a.stage === 'tutorials').map(a => ({ file: a.file, status: a.status }));
  const tryIt = {
    tutorials: files.filter(f => stageOf(f) === 'tutorials').map(f => ({ file: f, title: tutorialTitle(read(f)) ?? f })),
    preview: config.try?.preview ?? false,
    local: config.try?.local ?? null,
  };
  return { packet, enabling, decisions, tutorials, tryIt, gated };
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
