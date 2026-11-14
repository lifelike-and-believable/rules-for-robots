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
//   node delivery.mjs open           The features whose delivery is open and not under way on
//                                    another branch: what a merge-triggered run picks from.
//   node delivery.mjs status         What the run still lacks.
//   node delivery.mjs gate           The link to review this branch's pull request, and the approve line.
//   node delivery.mjs                The Stop hook (reads the hook input on stdin).
// The hook acts only while a run is under way on the current branch, so a session that is waiting
// at a gate, or one the lead is talking to, stops when it means to. It never asks anyone anything.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildSteps, criteriaRows, decisionFiles, defaultBranchRef, featureFamily, linksBehind, loadArtifacts, parseArtifact, processNext, readConfig, refTree, renderNext, stageOf, stepRecords, tryItLines, tutorialTitle, workingTree } from './lib/process.mjs';
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

// A story's feature: the artifacts that reach it along the stage chain (process-state AC-13), so a
// decision note several features cite does not join their specs.
function downstream(root, artifacts, from) {
  return featureFamily(artifacts.filter(a => a.id), from, readConfig(root)?.config ?? {});
}

// The specs a name stands for (AC-9): a spec's file name or id, or a story's id, whose specs are
// the ones that derive from it. Empty when the name has no spec yet.
export function resolveSpecs(root, name) {
  const { artifacts } = loadArtifacts(workingTree(root));
  const spec = artifacts.find(a => a.stage === 'specs' && (specName(a) === name || a.id === name));
  if (spec) return [specName(spec)];
  const story = artifacts.find(a => a.stage === 'stories' && a.id === name);
  return story ? downstream(root, artifacts, story).filter(a => a.stage === 'specs').map(specName).sort() : [];
}

// The run's decisions file, named after its branch so that runs on different branches never write
// the same file (AC-3, rewrite plan 25e): docs/decisions/<branch>.md, with each / written as -.
export function decisionsFile(branch) {
  return `docs/decisions/${String(branch).replace(/[\\/]+/g, '-')}.md`;
}

// What was set aside for a spec (AC-3): the tokens in the run's decisions file, which cover every spec
// the branch delivers, or in docs/decisions/<spec name>.md, where runs before 25e wrote them.
function setAside(root, name, branch) {
  let text = '';
  for (const file of [decisionsFile(branch), `docs/decisions/${name}.md`]) {
    try { text += fs.readFileSync(path.join(root, file), 'utf8'); } catch { /* none */ }
  }
  return new Set(SET_ASIDE.filter(token => text.includes(`[set aside: ${token}]`)));
}

// What the run still lacks (AC-2), as sentences. Empty when the delivery is complete and pushed.
// scope: spec names the run was started for, which count even when this branch has not changed
// them, so a feature built earlier is finished from where it stands (AC-9).
function runSpecs(root, scope) {
  const ref = defaultBranchRef(root);
  const changed = new Set(ref
    ? [...lines(git(root, ['diff', '--name-only', ref])), ...lines(git(root, ['ls-files', '--others', '--exclude-standard']))]
    : lines(git(root, ['ls-files', '--cached', '--others', '--exclude-standard'])));
  const { artifacts } = loadArtifacts(workingTree(root));
  const specs = artifacts.filter(a => a.stage === 'specs' && (changed.has(a.file) || scope.includes(specName(a))));
  return { ref, changed, artifacts, specs };
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Every artifact in the features of the specs a run delivers: the features of the stories whose
// feature holds one of those specs (process-state AC-13).
function featureMembers(root, artifacts, specs) {
  const config = readConfig(root)?.config ?? {};
  const withId = artifacts.filter(a => a.id);
  const ids = new Set(specs.map(s => s.id));
  const found = new Map();
  for (const story of withId.filter(a => a.stage === 'stories')) {
    const family = featureFamily(withId, story, config);
    if (family.some(a => ids.has(a.id))) for (const a of family) found.set(a.id, a);
  }
  return [...found.values()].sort((p, q) => p.id.localeCompare(q.id));
}

// The approved designs with a build order (AC-18) in the features of the specs a run delivers: the
// features of the stories whose feature holds one of those specs (process-state AC-13), so a design
// joins only along the stage chain. Returns [{ design, steps }], by design id.
function designsWithSteps(root, artifacts, specs) {
  const config = readConfig(root)?.config ?? {};
  const withId = artifacts.filter(a => a.id);
  const ids = new Set(specs.map(s => s.id));
  const found = new Map();
  for (const story of withId.filter(a => a.stage === 'stories')) {
    const family = featureFamily(withId, story, config);
    if (!family.some(a => ids.has(a.id))) continue;
    for (const design of family.filter(a => a.stage === 'design' && ['approved', 'implemented'].includes(a.status))) {
      const steps = buildSteps(design);
      if (steps.length) found.set(design.id, { design, steps });
    }
  }
  return [...found.values()].sort((p, q) => p.design.id.localeCompare(q.design.id));
}

export function deliveryMissing(root, scope = []) {
  const { ref, changed, artifacts, specs } = runSpecs(root, scope);
  const byId = new Map(artifacts.filter(a => a.id).map(a => [a.id, a]));
  const tests = [...changed].filter(isTestOrBaseline).map(f => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch { return ''; } });
  // A test that cites the spec may already be on the default branch, for a feature built earlier.
  const citedInRepo = name => lines(git(root, ['grep', '-l', '-F', `${name}#AC-`])).some(isTestOrBaseline);
  // The artifacts on the default branch, to tell which specs were behind there (a revision).
  const baseTree = ref ? refTree(root, ref) : null;
  const atBase = new Map(baseTree ? loadArtifacts(baseTree).artifacts.filter(a => a.id).map(a => [a.id, a]) : []);
  const missing = [];
  if (!specs.length) missing.push('no spec in this branch yet: write docs/specs/<feature>.md from the approved user documentation, with an id and derived-from');
  for (const spec of specs) {
    const name = specName(spec);
    const aside = setAside(root, name, currentBranch(root));
    if (!['approved', 'implemented'].includes(spec.status)) missing.push(`${spec.file}: the spec is a draft; check it against the approved documents it derives from, then set status: approved`);
    if (!tests.some(text => text.includes(`${name}#AC-`)) && !citedInRepo(name) && !aside.has('tests')) missing.push(`tests that cite ${name}#AC-n, written and seen to fail before the implementation`);
    const userDocs = [...new Set(spec.links.map(l => byId.get(l.target)).filter(a => a?.stage === 'user-docs').map(a => a.id))];
    const hasTutorial = artifacts.some(a => a.stage === 'tutorials' && a.links.some(l => userDocs.includes(l.target)));
    if (userDocs.length && !hasTutorial && !aside.has('tutorial')) missing.push(`a tutorial in docs/tutorials/ that derives from ${userDocs.join(', ')}, with each step run and its result recorded`);
    // A revision (revisions-and-foundations AC-5): the spec is brought up to the sections it is
    // behind, and its hashes recorded.
    const behind = linksBehind(spec, byId);
    if (behind.length) missing.push(`${spec.file}: behind ${behind.join(', ')}; bring the spec up to the changed sections, then record its hashes (node .rfr/checks/process-relink.mjs ${spec.id})`);
    // A spec that was behind on the default branch is this run's revision: each criterion it changes
    // or adds needs tests that cite it, under the same rules as any tests (the tests-commit lock).
    const was = atBase.get(spec.id);
    if (was && ['approved', 'implemented'].includes(was.status) && linksBehind(was, atBase).length && !aside.has('tests')) {
      const old = criteriaRows(was.body);
      const changedCriteria = [...criteriaRows(spec.body)].filter(([id, row]) => old.get(id) !== row).map(([id]) => `${name}#${id}`);
      const untested = changedCriteria.filter(c => !tests.some(text => new RegExp(`${escapeRe(c)}(?!\\d)`).test(text)));
      if (untested.length) missing.push(`tests for the criteria of ${name} that changed (${untested.join(', ')}): add or change tests that cite each one, and see them fail before the implementation; commit them on their own and add that commit to the spec's tests-commit, and list each existing test file you change under unlocks: in the spec, with the reason`);
    }
  }
  // Each tutorial of the run's features that is behind is run again (AC-5); a tutorial whose step
  // words change goes back to draft for the lead to follow (AC-6).
  for (const t of featureMembers(root, artifacts, specs).filter(a => a.stage === 'tutorials')) {
    const behind = linksBehind(t, byId);
    if (behind.length) missing.push(`${t.file}: behind ${behind.join(', ')}; run the tutorial again against the delivery, then record its hashes (node .rfr/checks/process-relink.mjs ${t.id}); if the words of a step change, set it back to status: draft for the lead to follow again`);
  }
  // Each step of the build order (AC-18). Built counts from any decisions file; left for later counts
  // only where this branch records it, so a run that continues a feature is asked again for the steps
  // an earlier run left, and builds them or says why not this time.
  const decisions = decisionFiles(root);
  const done = stepRecords(decisions.map(f => f.text)).done;
  const later = stepRecords(decisions.filter(f => !ref || changed.has(f.file)).map(f => f.text)).later;
  for (const { design, steps } of designsWithSteps(root, artifacts, specs)) {
    for (const { n } of steps) {
      const key = `${design.id} ${n}`;
      if (!done.has(key) && !later.has(key)) missing.push(`step ${n} of ${design.id}: build it and record \`[step done: ${key}]\` in the run's decisions file, or record \`[step later: ${key}]\` with why`);
    }
  }
  if (git(root, ['status', '--porcelain'])) missing.push('uncommitted changes: commit them');
  const branch = currentBranch(root);
  const upstream = git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (!upstream || upstream === ref) missing.push(`the branch is not pushed: git push -u origin ${branch}`);
  else if (git(root, ['rev-parse', '@{u}']) !== git(root, ['rev-parse', 'HEAD'])) missing.push('commits not pushed: git push');
  return missing;
}

// The steps of the delivered designs that a decisions file leaves for later and none records as
// built (AC-18), as report lines: "step <n> of <design id>: <title>".
function stepsLeftForLater(root, scope = []) {
  const { artifacts, specs } = runSpecs(root, scope);
  const { later } = stepRecords(decisionFiles(root).map(f => f.text));
  return designsWithSteps(root, artifacts, specs)
    .flatMap(({ design, steps }) => steps.filter(s => later.has(`${design.id} ${s.n}`)).map(s => `step ${s.n} of ${design.id}: ${s.title}`));
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
const CARRY_ON = 'Carry on without asking the lead, and do not end your turn to wait for them. If something cannot be done, set it aside in docs/decisions/<branch>.md (the branch name with each / written as -) with `[set aside: tests]` or `[set aside: tutorial]` and the reason, and finish the rest.';

// How far a feature has got (AC-10): the process state for the stories a name stands for, and what
// a delivery of their specs would still lack. With no name, the state of every feature.
function where(root, name) {
  const next = processNext(root);
  if (!next) return 'no docs/product/process.yml: this project does not use the process';
  if (!name) return next.text;
  const { artifacts } = loadArtifacts(workingTree(root));
  const specs = resolveSpecs(root, name);
  const stories = artifacts
    .filter(a => a.stage === 'stories' && (a.id === name || downstream(root, artifacts, a).some(d => d.stage === 'specs' && specs.includes(specName(d)))))
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

// The features whose delivery is open and not under way (AC-13). Open is the process state's
// `deliver` step; stories that share user documentation are one feature. A feature is under way when
// a branch on the origin remote, other than the default branch, adds or changes a spec that derives
// from its story, design, or user documentation: the default branch does not show a delivery until
// it merges. A feature open for the steps of its build order (AC-19) is listed too, and so is a
// revision open (revisions-and-foundations AC-5), which is under way when another branch changes one
// of its stale specs or tutorials. Returns [{ stories, docs, designs, openSteps, revision, behind,
// sections, waiting, later }], in the process state's order.
export function openDeliveries(root) {
  git(root, ['fetch', '-q', '--prune', 'origin']);
  const next = processNext(root);
  if (!next) return [];
  // Stories whose open work shares any user documentation are one feature: a packet's documents are
  // delivered together.
  // A feature open because steps of its build order are still to build (AC-19) has the designs with
  // those steps as its units; its user documentation is all there is in its feature.
  const withId = loadArtifacts(workingTree(root)).artifacts.filter(a => a.id);
  const config = readConfig(root)?.config ?? {};
  // A revision open (revisions-and-foundations AC-5) is listed like a new delivery, marked revision,
  // with its stale specs and tutorials as behind and the sections they are behind as sections.
  let features = [];
  for (const step of next.steps.filter(s => s.step === 'deliver' || s.step === 'revise')) {
    const revision = step.step === 'revise';
    const openSteps = step.openSteps ?? [];
    const designs = openSteps.length ? step.units ?? [] : [];
    const docs = openSteps.length
      ? featureFamily(withId, step.story, config).filter(a => a.stage === 'user-docs').map(a => a.id)
      : step.units ?? [];
    const behind = revision ? step.files ?? [] : [];
    const sections = revision ? step.behind ?? [] : [];
    const overlapping = features.filter(f => f.docs.some(d => docs.includes(d)) || f.designs.some(d => designs.includes(d)) || f.behind.some(b => behind.includes(b)));
    features = features.filter(f => !overlapping.includes(f));
    features.push({
      stories: [...overlapping.flatMap(f => f.stories), step.story].sort(),
      docs: [...new Set([...overlapping.flatMap(f => f.docs), ...docs])].sort(),
      designs: [...new Set([...overlapping.flatMap(f => f.designs), ...designs])].sort(),
      openSteps: [...new Set([...overlapping.flatMap(f => f.openSteps), ...openSteps])],
      revision: revision || overlapping.some(f => f.revision),
      behind: [...new Set([...overlapping.flatMap(f => f.behind), ...behind])].sort(),
      sections: [...new Set([...overlapping.flatMap(f => f.sections), ...sections])].sort(),
    });
  }
  if (!features.length) return [];
  // The specs every other remote branch adds or changes. One of them puts a feature under way when it
  // would join that feature along the stage chain (process-state AC-13), so an edit to another
  // feature's spec that cites a shared decision note does not.
  const ref = defaultBranchRef(root);
  const branches = lines(git(root, ['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin']))
    .filter(b => b !== ref && b !== 'origin/HEAD' && b !== 'origin');
  const elsewhere = [];
  // The designs whose build steps another branch records in a decisions file it adds or changes.
  const stepsElsewhere = new Set();
  const wantSteps = features.some(f => f.designs.length);
  // The stale specs and tutorials another branch changes: a revision of them is under way there.
  const revisedElsewhere = new Set();
  const tutorialsElsewhere = new Set();
  for (const branch of branches) {
    // Since the branch left the default branch; a branch with no history in common is compared whole.
    const changedIn = dir => lines(git(root, ['diff', '--name-only', `${ref ?? 'HEAD'}...${branch}`, '--', dir]) ?? git(root, ['diff', '--name-only', ref ?? 'HEAD', branch, '--', dir]));
    const specs = changedIn('docs/specs').filter(f => f.endsWith('.md'));
    for (const file of specs) revisedElsewhere.add(file);
    // A changed tutorial puts a revision under way only when no spec of it is behind (below).
    if (features.some(f => f.revision)) for (const file of changedIn('docs/tutorials')) tutorialsElsewhere.add(file);
    for (const file of specs) {
      const text = git(root, ['show', `${branch}:${file}`]);
      const parsed = text ? parseArtifact(text) : null;
      if (parsed?.front) elsewhere.push({ id: parsed.front.id ?? `${branch}:${file}`, stage: 'specs', status: parsed.front.status, file, links: parsed.links ?? [] });
    }
    if (!wantSteps) continue;
    for (const file of changedIn('docs/decisions')) {
      const { done, later } = stepRecords([git(root, ['show', `${branch}:${file}`]) ?? '']);
      for (const key of [...done, ...later]) stepsElsewhere.add(key.slice(0, key.lastIndexOf(' ')));
    }
  }
  // A spec on another branch that derives from the feature's open user documentation (or what stands
  // in for it) is its delivery under way. For a feature open for its build steps, so is a spec that
  // derives from one of those designs or from its user documentation, or a decisions file that
  // records a step of one of those designs.
  const underWay = f => elsewhere.some(spec => spec.links.some(l => f.docs.includes(l.target) || f.designs.includes(l.target)))
    || f.designs.some(d => stepsElsewhere.has(d))
    || f.behind.some(file => revisedElsewhere.has(file))
    || (f.behind.length > 0 && f.behind.every(file => stageOf(file) === 'tutorials') && f.behind.some(file => tutorialsElsewhere.has(file)));
  // A feature whose only open steps were left for later by a merged delivery is waiting for the lead:
  // a step is left for later when it needs something only a person can do, so a run started by the
  // next merge would only leave it for later again. "deliver it" still starts it; the merge check
  // does not (AC-19, from the review of #265).
  const { later } = stepRecords(decisionFiles(root).map(d => d.text));
  return features.filter(f => !underWay(f))
    .map(f => ({ ...f, waiting: f.openSteps.length > 0 && f.openSteps.every(key => later.has(key)), later: f.openSteps.filter(key => later.has(key)) }));
}

function open(root) {
  const features = openDeliveries(root);
  if (!features.length) return 'No delivery is open.';
  return features.map(f => `${f.stories.join(', ')}${f.docs.length ? ` (user documentation: ${f.docs.join(', ')})` : ''}${f.revision ? ` (revision: ${f.behind.join(', ')} ${f.behind.length === 1 ? 'is' : 'are'} behind ${f.sections.join(', ')})` : ''}${f.waiting ? ` (waiting for the lead: ${f.later.join(', ')} was left for later; say "deliver it" when it can be done)` : ''}${f.openSteps.length && !f.waiting ? ` (steps still to build: ${f.openSteps.join(', ')})`: ''}`).join('\n');
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
    // A story whose delivery is open (approved user documentation with no spec) is where a delivery
    // starts: the run begins, and its first step is the spec (AC-9, amended in rewrite plan 25f after
    // the delegated eval found every new delivery refused here). Its feature may also hold an earlier
    // slice's built spec (process-state AC-13), which this run is not for.
    // A feature open again because steps of its build order are still to build (AC-19) is finished
    // from its existing specs, which the run amends with criteria for those steps.
    // A revision open (revisions-and-foundations AC-5) is scoped to its stale specs, or, when only its
    // tutorials are behind, to the feature's specs.
    const step = processNext(root)?.steps.find(s => s.story === name && (s.step === 'deliver' || s.step === 'revise'));
    const opens = !!step;
    const stale = step?.step === 'revise' ? (step.files ?? []).filter(f => f.startsWith('docs/specs/')).map(f => path.posix.basename(f, '.md')).sort() : [];
    specs = stale.length ? stale : opens && step.step === 'deliver' && !step.openSteps?.length ? [] : resolveSpecs(root, name);
    if (!specs.length && !opens) {
      // Nothing to deliver yet: the feature is at an earlier stage, which is written and approved first.
      console.error(`${where(root, name)}\n\n${name} has no spec yet, so this is not a delivery run. Write the stage it is at, push the branch, and tell the lead once that it is waiting for their approval.`);
      return 1;
    }
  }
  writeMarker(root, { branch, started: new Date().toISOString(), specs });
  console.log(`Delivery run started on ${branch}${specs.length ? ` for ${specs.join(', ')}` : ''}. Still to do:\n${listed(deliveryMissing(root, specs))}\n\nThis run's decisions file is ${decisionsFile(branch)}.\n\n${CARRY_ON}`);
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
    // Accepting the delivery and validating it are two approvals (AC-11): name the tutorials that
    // are still drafts, so the lead knows what following them will record.
    const ref = defaultBranchRef(root);
    const inBranch = new Set(ref ? [...lines(git(root, ['diff', '--name-only', ref, '--', 'docs/tutorials'])), ...lines(git(root, ['ls-files', '--others', '--exclude-standard', '--', 'docs/tutorials']))] : []);
    const drafts = loadArtifacts(workingTree(root)).artifacts.filter(a => a.stage === 'tutorials' && a.status !== 'approved' && (!ref || inBranch.has(a.file))).map(a => a.file);
    const validation = drafts.length
      ? `\nSay plainly that the feature is built and not yet validated. Approving the pull request accepts the work onto the default branch. Validation is the lead following ${drafts.join(', ')} against the delivery; when they say it holds, the tutorial is marked approved in a pull request of its own, which they approve. Leave the tutorial a draft until then.`
      : '';
    // Where to try it (lasting-tutorials AC-8): the tutorials this branch adds or changes, the preview,
    // and the local command, as the pull request's "Try it" section gives them.
    const tryConfig = readConfig(root)?.config?.try ?? {};
    // A tutorial has front matter; a README beside the tutorials is not one to follow.
    const changedTutorials = [...inBranch].filter(f => f.endsWith('.md') && fs.existsSync(path.join(root, f))).sort()
      .map(f => ({ file: f, text: fs.readFileSync(path.join(root, f), 'utf8') }))
      .filter(t => parseArtifact(t.text).front)
      .map(t => ({ file: t.file, title: tutorialTitle(t.text) }));
    const tryLines = tryItLines({ tutorials: changedTutorials, preview: tryConfig.preview, local: tryConfig.local, where: 'pr' });
    const tryIt = tryLines.length ? `\nAlso tell the lead, once, where to try it:\n${tryLines.filter(Boolean).join('\n')}` : '';
    // Steps of the build order left for later keep the feature's delivery open (AC-18, AC-19).
    const later = stepsLeftForLater(root, marker.specs ?? []);
    const leftOpen = later.length
      ? `\nTell the lead which steps of the build order were left for later, and why, and that the feature's delivery stays open for them until they are built: the lead can say "deliver it", or, where merges start deliveries, the merge of this pull request starts the next run.\n${listed(later)}`
      : '';
    block(`rfr-process: the delivery on ${marker.branch} is complete and pushed. Before you stop, tell the lead once: what was built, anything set aside in docs/decisions/, and how to review it.${validation}${leftOpen}${tryIt}\n${gateFor(root)}`);
    return;
  }
  clearMarker(root);
}

async function main(argv) {
  const command = argv[0];
  if (['where', 'start', 'status', 'gate', 'open'].includes(command)) {
    const at = argv.indexOf('--root');
    const root = path.resolve(at === -1 ? process.env.CLAUDE_PROJECT_DIR ?? '.' : argv[at + 1]);
    const name = argv[1] && argv[1] !== '--root' ? argv[1] : null;
    if (command === 'gate') { console.log(gateFor(root)); return; }
    if (command === 'open') { console.log(open(root)); return; }
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
