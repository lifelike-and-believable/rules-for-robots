#!/usr/bin/env node
// Pull request description (docs/specs/delivery-run.md, AC-7). Under the GitHub gate a workflow
// opens the pull request, so the agent does not write its description; this builds one from the
// branch: each changed design that lets a spec skip user documentation, the review packet for the
// process artifacts the branch changes, the decision files it changes, where to try the change when
// it adds or changes a tutorial, and, for a gated change, the line the lead can run to approve it.
// A tutorial a revision re-records with its steps unchanged is listed as re-recorded and still
// validated (revisions-and-foundations AC-6). A revision, a pull request that changes a section an
// approved artifact cites, has a Revision section after the review packet (AC-7).
// Usage: node checks/ci/process-pr-body.mjs [project root] --base <ref> [--number <n>] [--branch <name>]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DELIVERY_SIDE, changedSections, gateOf, hashText, linksBehind, loadArtifacts, parseArtifact, readConfig, readWorkMode, refTree, stageOf, tryItLines, tutorialStepWords, tutorialTitle, workingTree } from '../lib/process.mjs';
import { buildPacket, changedArtifacts, formatPacket } from '../process-packet.mjs';

// The reasons a branch's decisions file gives for its re-records (AC-7): the list items under a
// "## Revision" heading that start with an artifact id, as a map from id to reason. Read tolerantly:
// the id may be in backticks or bold, and a colon or a dash may follow it, as in
// "- design-board: unaffected; the change is to the export dialog only." A line indented under an
// item continues it.
export function revisionReasons(text) {
  const reasons = new Map();
  const rows = String(text ?? '').split(/\r?\n/);
  const start = rows.findIndex(r => /^##\s+Revision\s*#*\s*$/i.test(r));
  if (start < 0) return reasons;
  let last = null;
  for (const row of rows.slice(start + 1)) {
    if (/^#{1,2}\s/.test(row)) break;
    const item = /^\s{0,3}[-*+]\s+(?:\*\*)?`?([\w.-]+?)`?(?:\*\*)?(?:\s*:|\s+[-–—])\s*(.*?)\s*$/.exec(row);
    if (item) {
      last = item[2] ? item[1] : null;
      if (item[2] && !reasons.has(item[1])) reasons.set(item[1], item[2]);
      continue;
    }
    if (last && /^\s+\S/.test(row) && !/^\s*[-*+]\s/.test(row)) reasons.set(last, `${reasons.get(last)} ${row.trim()}`);
    else last = null;
  }
  return reasons;
}

// The Revision section's content (AC-7, decision D4), or null when the pull request is not a
// revision (no section an approved artifact cites has changed since the branch left the base).
// Each document that cites a changed section directly (a dependant) is put in one group, by
// comparing its version where the branch left the base with the working tree:
//   - withdrawn: it is now a draft with a `withdrawn` entry, or the branch removed it;
//   - updated: its body (the text after the front matter) differs, compared with spacing made even
//     as section hashes compare it (hashText);
//   - re-recorded: its body is the same and the file is not, so only its front matter changed: the
//     hashes it records for the sections it cites;
//   - not yet dealt with: the file is unchanged, so the process check fails it as stale.
// Specs and tutorials are not dependants of the packet: those still behind a section they cite are
// listed as behind, the open revisions the merge leaves.
export function revisionSummary(root, since, branch) {
  const sections = changedSections(root, since);
  if (!sections.length) return null;
  const tree = refTree(root, since);
  const before = new Map(loadArtifacts(tree).artifacts.filter(a => a.id).map(a => [a.id, a]));
  const now = new Map(loadArtifacts(workingTree(root)).artifacts.filter(a => a.id).map(a => [a.id, a]));
  const decisionsFile = `docs/decisions/${String(branch ?? '').replace(/[\\/]+/g, '-')}.md`; // as delivery.mjs names it
  let decisionsText = '';
  try { decisionsText = fs.readFileSync(path.join(root, decisionsFile), 'utf8'); } catch { /* none */ }
  const reasons = revisionReasons(decisionsText);
  const out = { sections: sections.map(s => ({ key: s.key, file: s.file })), decisionsFile, updated: [], reRecorded: [], withdrawn: [], untouched: [], behind: [] };
  // Line endings are made even, so a checkout that writes CRLF does not read as a change.
  const lf = text => (text ?? '').replace(/\r\n/g, '\n');
  const read = file => { try { return lf(fs.readFileSync(path.join(root, file), 'utf8')); } catch { return null; } };
  for (const id of [...new Set(sections.flatMap(s => s.citedBy))].sort()) {
    const was = before.get(id);
    const is = now.get(id);
    if (DELIVERY_SIDE.has(was.stage)) {
      const behind = is && ['approved', 'implemented'].includes(is.status) ? linksBehind(is, now) : [];
      if (behind.length) out.behind.push({ id, file: is.file, behind });
      continue;
    }
    if (!is) { out.withdrawn.push({ id, file: was.file, reason: 'removed in this pull request' }); continue; }
    if (is.status === 'draft' && is.withdrawn) { out.withdrawn.push({ id, file: is.file, reason: is.withdrawn }); continue; }
    if (hashText(is.body ?? '') !== hashText(was.body ?? '')) out.updated.push({ id, file: is.file });
    else if (read(is.file) !== lf(tree.read(was.file))) out.reRecorded.push({ id, file: is.file, reason: reasons.get(id) ?? null });
    else out.untouched.push({ id, file: is.file });
  }
  return out;
}

function revisionLines(r) {
  const named = a => `- **${a.id}** (\`${a.file}\`)`;
  const group = (title, items, intro, line = named) => {
    const lines = [`### ${title} (${items.length})`, ''];
    if (items.length && intro) lines.push(intro, '');
    lines.push(...(items.length ? items.map(line) : ['None.']), '');
    return lines;
  };
  return [
    '## Revision',
    '',
    'This pull request changes sections that approved documents cite, so it is a revision. Read the updated documents first. For each document re-recorded as unaffected, check that its reason holds.',
    '',
    ...group('Changed sections', r.sections, null, s => `- \`${s.key}\` (\`${s.file}\`)`),
    ...group('Updated: read these first', r.updated, 'These documents cite a changed section, and their text changed with it.'),
    ...group('Re-recorded as unaffected', r.reRecorded, `Only the hashes these documents record changed; their text is as it was. Each reason comes from "## Revision" in \`${r.decisionsFile}\`.`, a => `${named(a)}: ${a.reason ?? 'no reason given'}`),
    ...group('Withdrawn', r.withdrawn, null, a => `${named(a)}: ${a.reason}`),
    ...(r.untouched.length ? group('Not yet dealt with', r.untouched, 'These cite a changed section and this pull request has not changed them. The process check fails until each is updated, re-recorded, or withdrawn.') : []),
    ...group('Behind after the merge', r.behind, 'These specs and tutorials cite a changed section. When this pull request merges they become open revisions, and an agent brings each up to date in a delivery of its own.', a => `${named(a)}, behind ${a.behind.join(', ')}`),
  ];
}

export function prBody({ packet = '', revision = null, enabling = [], decisions = [], tutorials = [], tryIt = null, gated = false, number = null, branch = '' }) {
  const out = [];
  // Accepting a delivery and validating it are two approvals (AC-11). A tutorial that is still a
  // draft means this pull request delivers the feature; one marked approved means it records the
  // lead's validation.
  const drafts = tutorials.filter(t => t.status !== 'approved');
  // A tutorial a revision re-recorded (revisions-and-foundations AC-6, D3): approved before and
  // after, with every step's words as they were, so the lead's validation still stands.
  const reRecorded = tutorials.filter(t => t.status === 'approved' && t.reRecorded);
  const validated = tutorials.filter(t => t.status === 'approved' && !t.reRecorded);
  if (drafts.length) {
    out.push('## Built, not yet validated', '', `Approving this pull request accepts the work onto the default branch. It does not record that you have validated the feature: ${drafts.map(t => `\`${t.file}\``).join(', ')} ${drafts.length === 1 ? 'is' : 'are'} still a draft.`, '', 'To validate, follow the tutorial against the delivery. When it holds, ask an agent to set its `status: approved`; that comes to you as a pull request of its own, and approving it is your validation. If a step does not go as written, say which, and the tutorial stays a draft until it does.', '');
  }
  if (reRecorded.length) {
    const one = reRecorded.length === 1;
    out.push('## Re-recorded, still validated', '', `${reRecorded.map(t => `\`${t.file}\``).join(', ')} ${one ? 'is' : 'are'} re-recorded: only ${one ? 'its' : 'their'} hashes or recorded results changed, and every step reads as it did when you validated ${one ? 'it' : 'them'}, so ${one ? 'it stays' : 'they stay'} approved. Approving this pull request accepts the re-record; you do not need to follow ${one ? 'it' : 'them'} again. A tutorial whose steps changed would be a draft, listed as not yet validated.`, '');
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
  // A revision's view (AC-7): next to the packet, before the decisions, so the lead sees what the
  // change reaches with the documents it changes.
  if (revision) out.push(...revisionLines(revision));
  if (decisions.length) {
    out.push('## Decisions', '', 'Set aside or decided by the agent during the run, for you to confirm:', '');
    for (const d of decisions) out.push(`From \`${d.file}\`:`, '', d.text.trim(), '');
  }
  out.push(`Opened by the rfr-process workflow for branch \`${branch}\`.`);
  if (gated) out.push('', `This pull request touches a folder that needs the approver's review. To approve from the Claude Code prompt: \`! gh pr review ${number ?? branch} --approve\``);
  return `${out.join('\n')}\n`;
}

// The pull request's title, from what the branch carries (delivery-run AC-20), or null to keep the
// one it has. `artifacts` are the process artifacts the branch adds or changes, each with its stage,
// status, and title (its first heading) or body.
const TITLE_MAX = 100;
export function prTitle(artifacts = []) {
  const titleOf = a => (a.title ?? /^#\s+(.+?)\s*$/m.exec(a.body ?? '')?.[1] ?? path.basename(a.file, '.md')).trim();
  const named = list => {
    const titles = [...new Set(list.map(titleOf))];
    return titles.length > 2 ? `${titles.slice(0, 2).join(', ')}, and ${titles.length - 2} more` : titles.join(' and ');
  };
  const at = stage => artifacts.filter(a => a.stage === stage);
  let title = null;
  if (at('specs').length) title = `Deliver: ${named(at('specs'))}`;
  else if (at('design').length) title = `Packet: ${named(at('design').map(a => ({ ...a, title: titleOf(a).replace(/\s+design$/i, '') })))}`;
  else if (at('user-docs').length) title = `Packet: ${named(at('user-docs'))}`;
  else if (at('tutorials').some(a => a.status === 'approved')) title = `Validate: ${named(at('tutorials').filter(a => a.status === 'approved'))}`;
  if (title && title.length > TITLE_MAX) title = `${title.slice(0, TITLE_MAX - 1)}…`;
  return title;
}

// What the description needs, read from the repository: the branch is HEAD, compared with base.
// `branch` names the branch's decisions file; by default, the branch checked out.
export function readPrBody(root, base, { branch = null } = {}) {
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
  // Each tutorial's version where the branch left the base, to tell a re-record from a changed step.
  const since = (spawnSync('git', ['merge-base', base, 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout ?? '').trim() || base;
  const atBase = file => { const r = spawnSync('git', ['-c', 'core.quotepath=off', 'show', `${since}:${file}`], { cwd: root, encoding: 'utf8' }); return r.status === 0 ? r.stdout : null; };
  const tutorials = artifacts.filter(a => a.stage === 'tutorials').map(a => {
    const before = atBase(a.file);
    const was = before === null ? null : parseArtifact(before);
    const reRecorded = a.status === 'approved' && ['approved', 'implemented'].includes(was?.front?.status)
      && JSON.stringify(tutorialStepWords(was.body)) === JSON.stringify(tutorialStepWords(parseArtifact(read(a.file)).body));
    return reRecorded ? { file: a.file, status: a.status, reRecorded } : { file: a.file, status: a.status };
  });
  const tryIt = {
    // A tutorial has front matter; a README or a note beside the tutorials is not one to follow.
    tutorials: files.filter(f => stageOf(f) === 'tutorials' && parseArtifact(read(f)).front).map(f => ({ file: f, title: tutorialTitle(read(f)) ?? f })),
    preview: config.try?.preview ?? false,
    local: config.try?.local ?? null,
  };
  const head = branch || (spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout ?? '').trim();
  const revision = revisionSummary(root, since, head);
  return { packet, revision, enabling, decisions, tutorials, tryIt, gated };
}

function main(argv) {
  const value = flag => { const i = argv.indexOf(flag); return i === -1 ? null : argv[i + 1]; };
  const flags = new Set(['--base', '--number', '--branch']);
  const root = path.resolve(argv.find((a, i) => !a.startsWith('--') && !flags.has(argv[i - 1])) ?? '.');
  const base = value('--base');
  if (!base) { console.error('Usage: process-pr-body.mjs [project root] --base <ref> [--number <n>] [--branch <name>] [--title]'); process.exit(2); }
  // --title prints the title alone, or nothing when the branch carries no process artifact.
  if (argv.includes('--title')) { process.stdout.write(prTitle(changedArtifacts(root, base)) ?? ''); return; }
  process.stdout.write(prBody({ ...readPrBody(root, base, { branch: value('--branch') }), number: value('--number'), branch: value('--branch') ?? '' }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
