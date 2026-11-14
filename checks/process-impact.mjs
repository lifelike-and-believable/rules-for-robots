#!/usr/bin/env node
// The impact report (docs/specs/revisions-and-foundations.md, AC-2): what a change to approved
// sections reaches, to see before the change is made. It lists:
//   - the documents (concept to user documentation, with designs and decision notes) that cite a
//     changed section directly, which the pull request must update, re-record, or withdraw;
//   - the specs and tutorials that cite one directly, which become open revisions when it merges,
//     each with the stories whose features hold it (process-state AC-13; counted as stories, since
//     stories that share user documentation are one feature to `delivery open`) and, for a spec, the
//     test files that cite it (`<spec file name>#AC-`, found as the delivery run finds them, with
//     git grep: outside a git working tree they are unknown, and null in the JSON);
//   - the paths a changed artifact names in `implemented-by` (foundations, slice 26c).
// Staleness is direct only (project-process.md): an artifact two links away is not listed.
// Only approved artifacts count, as for staleness. It reads the working tree and git; it makes no
// network call and writes nothing.
//
// Usage: node checks/process-impact.mjs [root] <id>[#section] ... [--json]
//        node checks/process-impact.mjs [root] --base <ref> [--json]
// A bare id means anything that cites the artifact; id#section means what cites that section or the
// whole artifact. With --base, the sections are those the working tree changed since it left <ref>
// (changedSections). Exit codes: 0 printed, 2 an id or section that does not exist, or a usage error.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DELIVERY_SIDE, changedSections, featureFamily, loadArtifacts, readConfig, sectionText, workingTree } from './lib/process.mjs';
import { isTestOrBaseline } from './lib/test-paths.mjs';

const STAGE_WORDS = {
  concept: 'concept', discovery: 'discovery', requirements: 'requirement', personas: 'persona', epics: 'epic',
  stories: 'story', design: 'design', 'user-docs': 'user documentation', specs: 'spec', tutorials: 'tutorial',
};

export class ImpactError extends Error {}

function git(root, args) {
  const r = spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout : null;
}
const lines = out => (out ?? '').split('\n').map(l => l.trim()).filter(Boolean);
const approved = a => a.status === 'approved' || a.status === 'implemented';
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The paths an artifact's front matter lists under implemented-by, as a block list or inline list.
// parseArtifact does not read the field; foundations (slice 26c) will.
export function implementedBy(text) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text ?? '')?.[1];
  if (!front) return [];
  const rows = front.split(/\r?\n/);
  const at = rows.findIndex(r => /^implemented-by:/.test(r));
  if (at < 0) return [];
  const unquote = s => s.trim().replace(/^(['"])(.*)\1$/, '$2');
  const inline = rows[at].replace(/^implemented-by:\s*/, '').trim();
  if (inline.startsWith('[')) return inline.replace(/^\[|\]$/g, '').split(',').map(unquote).filter(Boolean);
  if (inline) return [unquote(inline)];
  const out = [];
  for (const row of rows.slice(at + 1)) {
    const item = /^\s+-\s+(.+?)\s*$/.exec(row);
    if (!item) break;
    out.push(unquote(item[1]));
  }
  return out;
}

// The test files that cite a spec: the rule deliveryMissing uses (plugins/process/scripts/delivery.mjs),
// a tracked file that contains "<spec file name>#AC-" and counts as a test. Null when the root is not
// in a git working tree, where git grep cannot say.
function citingTests(root, spec, inGit) {
  if (!inGit) return null;
  const name = path.posix.basename(spec.file, '.md');
  return lines(git(root, ['grep', '-l', '-F', `${name}#AC-`])).filter(isTestOrBaseline).sort();
}
const UNKNOWN_TESTS = 'test files: unknown (not a git repository)';

// What a change reaches. `targets` are "<id>" or "<id>#<section>"; with `base`, the sections are
// changedSections against where the working tree left base. Throws ImpactError for an id or section
// that does not exist.
export function impactReport(root, { targets = [], base = null } = {}) {
  const { artifacts } = loadArtifacts(workingTree(root));
  const withId = artifacts.filter(a => a.id);
  const byId = new Map(withId.map(a => [a.id, a]));
  // Each target: { id, section, any }. `any` (a bare id named on the command line) matches every link
  // to the artifact; otherwise a link matches its own section or the whole artifact. A section null
  // from changedSections is the whole artifact's text outside its sections, which only links to the
  // whole artifact cite.
  let wanted;
  if (base) {
    if (git(root, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]) === null) throw new ImpactError(`cannot read the base ${base}: it is not a commit in this repository`);
    const since = (git(root, ['merge-base', base, 'HEAD']) ?? '').trim() || base;
    wanted = changedSections(root, since).map(s => ({ id: s.id, section: s.section, any: false }));
  } else {
    wanted = targets.map(t => {
      const [id, section = null] = t.split('#');
      const a = byId.get(id);
      if (!a) throw new ImpactError(`no artifact has the id ${id}`);
      if (section && sectionText(a.body ?? '', section) === null) throw new ImpactError(`${id} has no section ${section}`);
      return { id, section, any: !section };
    });
  }
  const keyOf = w => (w.section ? `${w.id}#${w.section}` : w.id);
  const sections = [...new Set(wanted.map(keyOf))];
  // The artifacts that cite a wanted section directly, with the sections each cites.
  const citing = new Map();
  for (const a of withId) {
    if (!approved(a)) continue;
    for (const l of a.links ?? []) {
      for (const w of wanted) {
        if (l.target !== w.id || a.id === w.id) continue;
        if (!(w.any || !l.section || l.section === w.section)) continue;
        if (!citing.has(a.id)) citing.set(a.id, { artifact: a, cites: new Set() });
        citing.get(a.id).cites.add(keyOf(w));
      }
    }
  }
  const sorted = [...citing.values()].sort((p, q) => p.artifact.id.localeCompare(q.artifact.id));
  const entry = ({ artifact: a, cites }) => ({ id: a.id, file: a.file, stage: a.stage, cites: [...cites].sort() });
  const documents = sorted.filter(c => !DELIVERY_SIDE.has(c.artifact.stage)).map(entry);
  const config = readConfig(root)?.config ?? {};
  const stories = withId.filter(a => a.stage === 'stories');
  const families = new Map(stories.map(s => [s.id, new Set(featureFamily(withId, s, config).map(a => a.id))]));
  const inGit = (git(root, ['rev-parse', '--is-inside-work-tree']) ?? '').trim() === 'true';
  const revisions = sorted.filter(c => DELIVERY_SIDE.has(c.artifact.stage)).map(c => ({
    ...entry(c),
    stories: stories.filter(s => families.get(s.id).has(c.artifact.id)).map(s => s.id).sort(),
    tests: c.artifact.stage === 'specs' ? citingTests(root, c.artifact, inGit) : [],
  }));
  const implemented = [];
  for (const id of new Set(wanted.map(w => w.id))) {
    const a = byId.get(id);
    let text = '';
    try { text = fs.readFileSync(path.join(root, a.file), 'utf8'); } catch { /* unreadable */ }
    const paths = implementedBy(text);
    if (paths.length) implemented.push({ id, file: a.file, paths });
  }
  const counts = {
    documents: documents.length,
    specs: revisions.filter(r => r.stage === 'specs').length,
    tutorials: revisions.filter(r => r.stage === 'tutorials').length,
    stories: new Set(revisions.flatMap(r => r.stories)).size,
    tests: inGit ? new Set(revisions.flatMap(r => r.tests)).size : null,
    paths: new Set(implemented.flatMap(i => i.paths)).size,
  };
  return { sections, counts, documents, revisions, implementedBy: implemented };
}

// The first line: the counts in plain words, or that the change reaches nothing when nothing cites
// it. Code a changed foundation names is still listed below in that case: it is not a citation.
export function countsLine(report) {
  const c = report.counts;
  if (!c.documents && !c.specs && !c.tutorials) {
    return `This change reaches nothing: no document, spec, or tutorial cites ${report.sections.length ? report.sections.join(', ') : 'a section it changes'}.`;
  }
  const parts = [
    `${plural(c.documents, 'document')} to update or re-record`,
    `${plural(c.specs, 'spec')} and ${plural(c.tutorials, 'tutorial')} that become open revisions`,
    plural(c.stories, 'story', 'stories'),
    c.tests === null ? UNKNOWN_TESTS : plural(c.tests, 'test file'),
  ];
  if (c.paths) parts.push(`${plural(c.paths, 'path')} of code that a changed foundation names`);
  return `This change reaches ${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}.`;
}

export function formatImpact(report) {
  const out = [countsLine(report)];
  if (!report.sections.length) return out.join('\n');
  out.push(`Sections: ${report.sections.join(', ')}`, '');
  const named = a => `  - ${a.id} (${STAGE_WORDS[a.stage] ?? a.stage}, ${a.file}), cites ${a.cites.join(', ')}`;
  const it = report.sections.length === 1 ? 'it' : 'them';
  out.push(`Documents that cite ${it}, which this pull request must update, re-record, or withdraw (${report.documents.length}):`);
  out.push(...(report.documents.length ? report.documents.map(named) : ['  None.']));
  out.push('', `Specs and tutorials that cite ${it}, which become open revisions when this merges (${report.revisions.length}):`);
  if (!report.revisions.length) out.push('  None.');
  for (const r of report.revisions) {
    out.push(named(r));
    out.push(`      ${r.stories.length === 1 ? 'Story' : 'Stories'}: ${r.stories.length ? r.stories.join(', ') : 'none (it is in no story\'s feature)'}`);
    if (r.stage === 'specs') out.push(`      Test files: ${r.tests === null ? 'unknown (not a git repository)' : r.tests.length ? r.tests.join(', ') : 'none cite it yet'}`);
  }
  for (const i of report.implementedBy) {
    out.push('', `Code that ${i.id} names in implemented-by (${i.paths.length}):`, ...i.paths.map(p => `  - ${p}`));
  }
  return out.join('\n');
}

const USAGE = 'Usage: node checks/process-impact.mjs [root] <id>[#section] ... [--json]\n       node checks/process-impact.mjs [root] --base <ref> [--json]';

function main(argv) {
  let base = null;
  let json = false;
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') base = argv[++i] ?? null;
    else if (a === '--json') json = true;
    else if (a.startsWith('--')) { console.error(`unknown option ${a}\n${USAGE}`); return 2; }
    else positional.push(a);
  }
  // The first argument is the project root when it is a folder that exists.
  let root = '.';
  if (positional.length && !positional[0].includes('#') && fs.existsSync(positional[0]) && fs.statSync(positional[0]).isDirectory()) root = positional.shift();
  root = path.resolve(root);
  if (base === null && argv.includes('--base')) { console.error(USAGE); return 2; }
  if (!base && !positional.length) { console.error(USAGE); return 2; }
  if (base && positional.length) { console.error(`name sections or give --base, not both\n${USAGE}`); return 2; }
  let report;
  try {
    report = impactReport(root, { targets: positional, base });
  } catch (e) {
    if (e instanceof ImpactError) { console.error(`process-impact: ${e.message}`); return 2; }
    throw e;
  }
  console.log(json ? JSON.stringify(report, null, 2) : formatImpact(report));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.slice(2));
