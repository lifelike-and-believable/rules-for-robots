#!/usr/bin/env node
// The delivery run (docs/specs/delivery-run.md). Once a feature's user documentation is approved,
// an agent delivers it on one branch without the lead. This script is the run's commands and the
// Stop hook that keeps it going:
//   node delivery.mjs where [name]   How far a feature has got and what is next (a story id or a
//                                    spec's file name; with no name, every feature).
//   node delivery.mjs start [name]   Start a run on the current branch (writes a marker in the git
//                                    folder). With a name, the run is for that feature's spec, which
//                                    may already be on the default branch: it is finished from
//                                    where it stands.
//   node delivery.mjs status         What the run still lacks.
//   node delivery.mjs gate           The link to review this branch's pull request, and the approve line.
//   node delivery.mjs                The Stop hook (reads the hook input on stdin).
// The hook acts only while a run is under way on the current branch, so a session that is waiting
// at a gate, or one the lead is talking to, stops when it means to. It never asks anyone anything.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defaultBranchRef, loadArtifacts, processNext, readConfig, renderNext, workingTree } from './lib/process.mjs';
import { isTestOrBaseline } from './lib/test-paths.mjs';

const MAX_BLOCKS = 3;
const SET_ASIDE = ['tests', 'tutorial'];

function git(root, args) {
  const r = spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}
const lines = out => (out ?? '').split('\n').map(l => l.trim()).filter(Boolean);

function markerFile(root) {
  const dir = git(root, ['rev-parse', '--absolute-git-dir']);
  return dir ? path.join(dir, 'rfr-delivery.json') : null;
}
export function readMarker(root) {
  try { return JSON.parse(fs.readFileSync(markerFile(root), 'utf8')); } catch { return null; }
}
function writeMarker(root, marker) { fs.writeFileSync(markerFile(root), `${JSON.stringify(marker, null, 2)}\n`); }
function clearMarker(root) { try { fs.rmSync(markerFile(root)); } catch { /* none */ } }

const currentBranch = root => git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
const specName = a => path.basename(a.file, '.md');

// Everything that derives from an artifact, directly or through others.
function downstream(artifacts, from) {
  const withId = artifacts.filter(a => a.id);
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const at = queue.shift();
    for (const a of withId) if (!seen.has(a) && a.links.some(l => l.target === at.id)) { seen.add(a); queue.push(a); }
  }
  return [...seen];
}

// The specs a name stands for (AC-9): a spec's file name or id, or a story's id, whose specs are
// the ones that derive from it. Empty when the name has no spec yet.
export function resolveSpecs(root, name) {
  const { artifacts } = loadArtifacts(workingTree(root));
  const spec = artifacts.find(a => a.stage === 'specs' && (specName(a) === name || a.id === name));
  if (spec) return [specName(spec)];
  const story = artifacts.find(a => a.stage === 'stories' && a.id === name);
  return story ? downstream(artifacts, story).filter(a => a.stage === 'specs').map(specName).sort() : [];
}

// What was set aside for a spec: the tokens in docs/decisions/<spec name>.md (AC-3).
function setAside(root, name) {
  let text = '';
  try { text = fs.readFileSync(path.join(root, 'docs', 'decisions', `${name}.md`), 'utf8'); } catch { /* none */ }
  return new Set(SET_ASIDE.filter(token => text.includes(`[set aside: ${token}]`)));
}

// What the run still lacks (AC-2), as sentences. Empty when the delivery is complete and pushed.
// scope: spec names the run was started for, which count even when this branch has not changed
// them, so a feature built earlier is finished from where it stands (AC-9).
export function deliveryMissing(root, scope = []) {
  const ref = defaultBranchRef(root);
  const changed = new Set(ref
    ? [...lines(git(root, ['diff', '--name-only', ref])), ...lines(git(root, ['ls-files', '--others', '--exclude-standard']))]
    : lines(git(root, ['ls-files', '--cached', '--others', '--exclude-standard'])));
  const { artifacts } = loadArtifacts(workingTree(root));
  const byId = new Map(artifacts.filter(a => a.id).map(a => [a.id, a]));
  const specs = artifacts.filter(a => a.stage === 'specs' && (changed.has(a.file) || scope.includes(specName(a))));
  const tests = [...changed].filter(isTestOrBaseline).map(f => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch { return ''; } });
  // A test that cites the spec may already be on the default branch, for a feature built earlier.
  const citedInRepo = name => lines(git(root, ['grep', '-l', '-F', `${name}#AC-`])).some(isTestOrBaseline);
  const missing = [];
  if (!specs.length) missing.push('no spec in this branch yet: write docs/specs/<feature>.md from the approved user documentation, with an id and derived-from');
  for (const spec of specs) {
    const name = specName(spec);
    const aside = setAside(root, name);
    if (!['approved', 'implemented'].includes(spec.status)) missing.push(`${spec.file}: the spec is a draft; check it against the approved documents it derives from, then set status: approved`);
    if (!tests.some(text => text.includes(`${name}#AC-`)) && !citedInRepo(name) && !aside.has('tests')) missing.push(`tests that cite ${name}#AC-n, written and seen to fail before the implementation`);
    const userDocs = [...new Set(spec.links.map(l => byId.get(l.target)).filter(a => a?.stage === 'user-docs').map(a => a.id))];
    const hasTutorial = artifacts.some(a => a.stage === 'tutorials' && a.links.some(l => userDocs.includes(l.target)));
    if (userDocs.length && !hasTutorial && !aside.has('tutorial')) missing.push(`a tutorial in docs/tutorials/ that derives from ${userDocs.join(', ')}, with each step run and its result recorded`);
  }
  if (git(root, ['status', '--porcelain'])) missing.push('uncommitted changes: commit them');
  const branch = currentBranch(root);
  const upstream = git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (!upstream || upstream === ref) missing.push(`the branch is not pushed: git push -u origin ${branch}`);
  else if (git(root, ['rev-parse', '@{u}']) !== git(root, ['rev-parse', 'HEAD'])) missing.push('commits not pushed: git push');
  return missing;
}

// The link to review a branch's pull request and the line the lead can run to approve it (AC-6).
export function gateText({ remote, branch }) {
  const slug = /github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\s*$/.exec(remote ?? '')?.[1];
  const link = slug
    ? `https://github.com/${slug}/pulls?q=${encodeURIComponent(`is:pr head:${branch}`).replace(/%20/g, '+')}`
    : `the pull request for branch ${branch} on the remote`;
  return [
    `Review: ${link} (the pull request the workflow opens for this branch; the rendered documents and mock-ups are on its "Files changed" tab).`,
    `To approve it from the Claude Code prompt, the lead can run this themselves: ! gh pr review ${branch} --approve`,
    'Do not run that command yourself, and do not open, approve, or merge the pull request.',
  ].join('\n');
}
const gateFor = root => gateText({ remote: git(root, ['remote', 'get-url', 'origin']), branch: currentBranch(root) });

const listed = missing => missing.map(m => `- ${m}`).join('\n');
const CARRY_ON = 'Carry on without asking the lead, and do not end your turn to wait for them. If something cannot be done, set it aside in docs/decisions/<spec name>.md with `[set aside: tests]` or `[set aside: tutorial]` and the reason, and finish the rest.';

// How far a feature has got (AC-10): the process state for the stories a name stands for, and what
// a delivery of their specs would still lack. With no name, the state of every feature.
function where(root, name) {
  const next = processNext(root);
  if (!next) return 'no docs/product/process.yml: this project does not use the process';
  if (!name) return next.text;
  const { artifacts } = loadArtifacts(workingTree(root));
  const specs = resolveSpecs(root, name);
  const stories = artifacts
    .filter(a => a.stage === 'stories' && (a.id === name || downstream(artifacts, a).some(d => d.stage === 'specs' && specs.includes(specName(d)))))
    .map(a => a.id);
  const steps = next.steps.filter(s => stories.includes(s.story));
  if (!steps.length) return `nothing in the process is called ${name}: use a story id or a spec's file name (\`where\` with no name lists every feature)`;
  const out = [renderNext({ steps, product: [] })];
  if (specs.length) {
    const missing = deliveryMissing(root, specs);
    out.push('', `Delivery of ${specs.join(', ')}: ${missing.length ? `still to do:\n${listed(missing)}` : 'nothing is missing.'}`);
  }
  return out.join('\n');
}

function start(root, name) {
  if (!readConfig(root)) { console.error('no docs/product/process.yml: this project does not use the process'); return 1; }
  const branch = currentBranch(root);
  const ref = defaultBranchRef(root);
  if (!branch || branch === 'HEAD' || branch === (ref ?? 'origin/main').replace(/^origin\//, '')) {
    console.error('a delivery run happens on its own branch, not the default branch: create one first (git switch -c feature/<name>)');
    return 1;
  }
  let specs = [];
  if (name) {
    specs = resolveSpecs(root, name);
    if (!specs.length) {
      // Nothing to deliver yet: the feature is at an earlier stage, which is written and approved first.
      console.error(`${where(root, name)}\n\n${name} has no spec yet, so this is not a delivery run. Write the stage it is at, push the branch, and tell the lead once that it is waiting for their approval.`);
      return 1;
    }
  }
  writeMarker(root, { branch, started: new Date().toISOString(), specs });
  console.log(`Delivery run started on ${branch}${specs.length ? ` for ${specs.join(', ')}` : ''}. Still to do:\n${listed(deliveryMissing(root, specs))}\n\n${CARRY_ON}`);
  return 0;
}

function status(root) {
  const marker = readMarker(root);
  const missing = deliveryMissing(root, marker?.specs ?? []);
  console.log(`${marker ? `A delivery run is under way on ${marker.branch}.` : 'No delivery run is under way.'}\n${missing.length ? `Still to do:\n${listed(missing)}` : 'Nothing is missing: the delivery is committed and pushed.'}`);
  return 0;
}

const block = reason => process.stdout.write(JSON.stringify({ decision: 'block', reason }));

// The Stop hook (AC-1, AC-4, AC-5).
function stop(root) {
  const marker = readMarker(root);
  if (!marker || marker.branch !== currentBranch(root)) return;
  const missing = deliveryMissing(root, marker.specs ?? []);
  if (missing.length) {
    const head = git(root, ['rev-parse', 'HEAD']);
    const blocks = (marker.head === head ? marker.blocks ?? 0 : 0) + 1;
    if (blocks > MAX_BLOCKS) return; // No progress since the last commit: let the run end, and keep the marker.
    writeMarker(root, { ...marker, head, blocks });
    block(`rfr-process: the delivery run on ${marker.branch} is not finished. Still to do:\n${listed(missing)}\n\n${CARRY_ON}`);
    return;
  }
  if (!marker.reported) {
    writeMarker(root, { ...marker, reported: true });
    block(`rfr-process: the delivery on ${marker.branch} is complete and pushed. Before you stop, tell the lead once: what was built, anything set aside in docs/decisions/, and how to review it.\n${gateFor(root)}`);
    return;
  }
  clearMarker(root);
}

async function main(argv) {
  const command = argv[0];
  if (['where', 'start', 'status', 'gate'].includes(command)) {
    const at = argv.indexOf('--root');
    const root = path.resolve(at === -1 ? process.env.CLAUDE_PROJECT_DIR ?? '.' : argv[at + 1]);
    const name = argv[1] && argv[1] !== '--root' ? argv[1] : null;
    if (command === 'gate') { console.log(gateFor(root)); return; }
    if (command === 'where') { console.log(where(root, name)); return; }
    process.exitCode = command === 'start' ? start(root, name) : status(root);
    return;
  }
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch { /* no input */ }
  try { stop(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()); } catch { /* never fail the session */ }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2)).catch(() => {});
