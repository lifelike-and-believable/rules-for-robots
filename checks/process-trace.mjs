#!/usr/bin/env node
// Process check (docs/specs/project-process.md). Reads docs/product/process.yml and the process
// artifacts (concept to tutorials), and fails on:
//   1. a duplicate id, or a link to an id or section that does not exist;
//   2. a cycle of links;
//   3. an approved artifact that links to a draft (or withdrawn) one;
//   4. an approved artifact whose recorded hash for a linked section is missing or out of date; an
//      out-of-date spec or tutorial that the branch does not add or change is a revision open, which
//      is reported as a note and does not fail (docs/specs/revisions-and-foundations.md, AC-3);
//   5. a story that names no persona, or a persona that is not approved;
//   8. a story without "As <persona>, I want ... so that ..." naming a linked persona, or without
//      acceptance criteria (an error when approved, a warning when draft);
//   6. a spec `test:` criterion whose Source cell names no approved story or user documentation
//      section in the spec's derived-from;
//   7. with --base, an artifact approved at the base and now draft without a `withdrawn` entry (a
//      tutorial whose step words changed goes back to draft, and is not a withdrawal), and a tutorial
//      approved at the base whose step words changed and which is still approved (AC-6);
//   9. a tutorial whose starts-from is not a tutorial's id, or a cycle of starts-from;
//  10. a tutorial whose needs: cannot be read, or names a service no place in try.provides provides;
//  11. a try.local command that runs a package script the root package.json does not have;
//  12. once docs/user/ has a start page or an area overview, user documentation that is not organised
//      by area: no start page, a page directly in docs/user/, an area folder with no overview, or an
//      approved page or overview that the start page and its area's overview do not reach
//      (warnings with lasting: 'warn');
//  13. a covers: line that cannot be read, or the same covers: entry in two pages.
// It warns when a bold name in a user documentation page appears in no design the page reaches,
// and prints the rules-for-robots commit it ran from.
// Staleness is direct only. Before process.yml's adoption-until date, problems with artifacts that
// have no links yet are warnings. --status lists personas, epics, and stories instead;
// --assignees prints the approvers (logins) of the stages with failing artifacts.
// Usage: node checks/process-trace.mjs [project root] [--base <ref>] [--status | --assignees] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { needsOf, startsFromOf, startsFromProblems } from './lib/tutorial.mjs';
import { USER_DOCS, userDocsProblems } from './lib/user-docs.mjs';
import { CONFIG_PATH, DELIVERY_SIDE, STAGE_ORDER, approversFor, changedSince, isTeam, loadArtifacts, login, markdownLinks, openItems, ACCEPTED_MARKERS, parseProcessConfig, parseArtifact, requiredUpstream, sectionHash, slug, tutorialStepWords, workingTree } from './lib/process.mjs';

const isApproved = a => a?.status === 'approved' || a?.status === 'implemented';
const WITHDRAWN = /\S.*#\d+/;

function gitTree(root, ref) {
  const git = args => spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: root, encoding: 'utf8' });
  if (git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).status !== 0) return null;
  return {
    listDir: dir => git(['ls-tree', '-r', '--name-only', ref, '--', dir]).stdout.split('\n').filter(f => f.endsWith('.md')).sort(),
    fileExists: file => git(['cat-file', '-e', `${ref}:${file}`]).status === 0,
    read: file => git(['show', `${ref}:${file}`]).stdout,
  };
}

// The numbers of the steps whose words differ between two versions of a tutorial, including steps
// added or removed (revisions-and-foundations AC-6).
export function changedSteps(was, is) {
  const before = tutorialStepWords(was?.body);
  const after = tutorialStepWords(is?.body);
  const out = [];
  for (let i = 0; i < Math.max(before.length, after.length); i++) if (before[i] !== after[i]) out.push(i + 1);
  return out;
}

function parseCriteria(body) {
  const section = /^## Acceptance criteria\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(body)?.[1] ?? '';
  const out = [];
  for (const row of section.split('\n').filter(l => l.trim().startsWith('|'))) {
    const cells = row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    if (!/^AC-\d+$/.test(cells[0] ?? '')) continue;
    out.push({ id: cells[0], needsTest: /^test:/i.test(cells[2] ?? ''), sources: (cells[3] ?? '').split(/[,\s]+/).filter(Boolean) });
  }
  return out;
}

// Rule 8: "As <persona>, I want ... so that ..." naming a linked persona, and acceptance criteria.
// Returns the problems found; an approved story fails on them, a draft gets warnings.
const AS_I_WANT = /\bAs\s+(?:an?\s+|the\s+)?(.+?),\s*I\s+want\b([\s\S]*?)(?:\bso\s+that\b([\s\S]*?))?(?:\n\s*\n|$)/i;
const titleOf = p => /^#\s+(.+?)\s*$/m.exec(p.body)?.[1] ?? '';

const escapeRe = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A role names a persona when it is the persona's id, short name, or title; when the title starts
// with the role ("Star" for "Star, the artist and site editor"); or when the role contains the
// whole short name or title ("busy animator" for "Animator"). Matches are at word boundaries, so a
// word from the middle of a title ("reader" in "Fan and reader") or part of a word does not count.
export function roleMatches(role, name) {
  if (role === name) return true;
  if (new RegExp(`^${escapeRe(role)}(?![\\p{L}\\p{N}])`, 'u').test(name)) return true;
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(name)}(?![\\p{L}\\p{N}])`, 'u').test(role);
}

// Bold names in a user documentation page that no design it reaches mentions (AC-30). The designs
// are those it links to, and those that link to a story it links to. Returns [] when it reaches none.
export function undefinedNames(doc, byId, artifacts) {
  const linked = doc.links.map(l => byId.get(l.target)).filter(Boolean);
  const stories = new Set(linked.filter(t => t.stage === 'stories').map(t => t.id));
  const designs = new Set(linked.filter(t => t.stage === 'design'));
  for (const d of artifacts) if (d.stage === 'design' && d.links.some(l => stories.has(l.target))) designs.add(d);
  if (!designs.size) return { designs: [], missing: [] };
  const text = [...designs].map(d => d.body.replace(/\*\*/g, '').toLowerCase()).join('\n');
  const names = [...new Set([...doc.body.matchAll(/\*\*([^*\n]+?)\*\*/g)].map(m => m[1].trim()).filter(n => n && !/:$/.test(n)))];
  return { designs: [...designs].map(d => d.id), missing: names.filter(n => !text.includes(n.toLowerCase())) };
}

export function storyShape(body, personas) {
  const out = [];
  const text = body.replace(/^#.*$/gm, '');
  const m = AS_I_WANT.exec(text);
  if (!m) out.push('does not say who it is for and what they want ("As <persona>, I want ... so that ...")');
  else {
    const role = m[1].trim().toLowerCase();
    const named = personas.some(p => {
      const names = [p.id, p.id.replace(/^persona-/, '').replace(/-/g, ' '), titleOf(p)].map(n => n.toLowerCase().trim()).filter(Boolean);
      return names.some(n => roleMatches(role, n));
    });
    if (!named) out.push(`the role "${m[1].trim()}" is not a persona it links to (${personas.map(p => p.id).join(', ') || 'none linked'})`);
    if (!m[3] || !m[3].trim()) out.push('does not say why ("so that ...")');
  }
  const section = /^##\s+Acceptance criteria\s*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/mi.exec(body)?.[1];
  const lines = (section ?? '').split('\n');
  const listItems = lines.filter(l => /^\s*(?:[-*+]|\d+[.)])\s+\S/.test(l));
  const separator = lines.findIndex(l => /^\s*\|?\s*:?-{3,}/.test(l));
  const tableRows = separator === -1 ? [] : lines.slice(separator + 1).filter(l => /^\s*\|.*\S.*\|/.test(l));
  const items = [...listItems, ...tableRows];
  if (!items.length) out.push('has no "## Acceptance criteria" section with at least one item');
  return out;
}

function load(root) {
  const errors = [];
  let config = null;
  const configFile = path.join(root, CONFIG_PATH);
  if (fs.existsSync(configFile)) {
    const parsed = parseProcessConfig(fs.readFileSync(configFile, 'utf8'));
    config = parsed.config;
    errors.push(...parsed.errors.map(e => (e.startsWith('process.yml') ? e : `process.yml: ${e}`)));
  }
  const { artifacts, errors: loadErrors } = loadArtifacts(workingTree(root));
  errors.push(...loadErrors);
  return { config, artifacts, errors };
}

// Current hash of each link, and whether each approved artifact is stale.
function analyse(artifacts) {
  const byId = new Map();
  for (const a of artifacts) if (a.id && !byId.has(a.id)) byId.set(a.id, a);
  const linkState = new Map(); // artifact -> [{ link, target, current }]
  for (const a of artifacts) {
    linkState.set(a, a.links.map(link => {
      const target = byId.get(link.target);
      return { link, target, current: target ? sectionHash(target.body, link.section) : null };
    }));
  }
  const stale = a => isApproved(a) && linkState.get(a).some(s => s.current !== null && s.link.hash !== s.current);
  return { byId, linkState, stale };
}

// The package script a try.local command runs, or null when it is not a form the check can be sure
// of. Only "<npm|pnpm|yarn> run <script>" at the start of the command is read, with nothing before
// the script name and no option that points at another package (-w, --workspace, --filter, -C,
// --cwd, -r, --prefix, "workspace"): the script would then be in another package.json. "pnpm dev"
// and "yarn dev" are not read, because the name may be a built-in command or a program, not a script.
export function localScript(command) {
  const text = command ?? '';
  const m = /^\s*(?:npm\s+run(?:-script)?|pnpm\s+run|yarn\s+run)\s+([^\s;&|-][^\s;&|]*)/.exec(text);
  if (!m) return null;
  if (/(?:^|\s)(?:-w|--workspace|--workspaces|--filter|-C|--cwd|-r|--recursive|--prefix)(?:[=\s]|$)|\sworkspace\s/.test(text)) return null;
  return m[1];
}

export function runProcessTrace(root, { base = null, now = new Date(), lasting = 'fail' } = {}) {
  const { config, artifacts, errors: loadErrors } = load(root);
  const errors = [...loadErrors];
  const warnings = [];
  if (artifacts.length && !config) errors.push(`${CONFIG_PATH} is missing; it names the approvers for each stage (docs/specs/project-process.md)`);
  const adopting = !!config?.adoptionUntil && now.toISOString().slice(0, 10) <= config.adoptionUntil;
  const { byId, linkState } = analyse(artifacts);

  // In a process project every spec is a process artifact (AC-63): one with no id would skip the
  // stage order, so it is an error unless specs are waived.
  if (config && !config.waived?.specs) {
    const dir = path.join(root, 'docs', 'specs');
    for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
      if (!f.endsWith('.md') || /^(readme|_)/i.test(f)) continue;
      const parsed = parseArtifact(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (!parsed.front?.id) errors.push(`docs/specs/${f}: a spec in a process project needs an id and derived-from links, so the stage order applies to it (add them, or waive specs in ${CONFIG_PATH})`);
    }
  }

  const seen = new Map();
  for (const a of artifacts) {
    if (!a.id) continue;
    if (seen.has(a.id)) errors.push(`duplicate id ${a.id} in ${seen.get(a.id)} and ${a.file}`);
    else seen.set(a.id, a.file);
  }

  const involved = new Set();
  const open = [];
  // Revisions open (AC-3): approved specs and tutorials behind a section they cite. Neither errors
  // nor warnings, and never a reason for the stale issue.
  const notes = [];
  // The files the branch adds or changes, compared with the base. With no base (a push to the
  // default branch, or a local run) nothing is in the branch.
  const inBranch = base ? changedSince(root, base) : new Set();
  const artifactFiles = new Set(artifacts.map(x => x.file.replace(/\\/g, '/')));
  for (const a of artifacts) {
    const soft = adopting && a.links.length === 0;
    const problems = { push: (...msgs) => { (soft ? warnings : errors).push(...msgs); if (!soft && a.id) involved.add(a.id); } };
    const name = a.id ?? a.file;
    if (!a.id) { errors.push(`${a.file}: no id`); continue; }
    if (!a.status) problems.push(`${name}: no status`);
    else if (!['draft', 'approved', 'implemented'].includes(a.status)) problems.push(`${name}: unknown status ${a.status} (draft, approved, or implemented)`);
    else if (a.status === 'implemented' && a.stage !== 'specs') problems.push(`${name}: status implemented is only for specs`);
    if (a.withdrawn && a.status !== 'draft') problems.push(`${name}: withdrawn is only for draft artifacts`);
    if (a.withdrawn && !WITHDRAWN.test(a.withdrawn)) problems.push(`${name}: withdrawn needs a reason and an issue number, like "the flow changed (#12)"`);

    for (const { link, target, current } of linkState.get(a)) {
      if (!target) { problems.push(`${name}: links to ${link.target}, which does not exist`); continue; }
      if (current === null) { problems.push(`${name}: ${link.target} has no section ${link.section}`); continue; }
      if (!isApproved(a)) {
        // A draft's recorded hash that no longer matches: its upstream changed after it was written.
        if (link.hash && link.hash !== current) warnings.push(`${name}: draft: ${link.key} changed since it was recorded; update the draft to match, or record it again (node .rfr/checks/process-relink.mjs ${a.id})`);
        continue;
      }
      if (!isApproved(target)) problems.push(`${name}: links to ${target.id}, which is ${target.status ?? 'without a status'}`);
      if (!link.hash) problems.push(`${name}: the link to ${link.key} has no recorded hash (record it with node .rfr/checks/process-relink.mjs ${a.id})`);
      else if (link.hash !== current) {
        // On the delivery side a stale spec or tutorial is a revision, open work for its feature, and
        // not a failure (revisions-and-foundations AC-3, D1). One the branch adds or changes must be
        // left up to date, so that a delivery cannot merge half a revision.
        if (DELIVERY_SIDE.has(a.stage) && !inBranch.has(a.file)) { notes.push(`revision open: ${name} is behind ${link.key}`); continue; }
        // A link to a whole artifact goes stale on any edit to it; suggest its sections (AC-38).
        const sections = link.section ? [] : [...target.body.matchAll(/^##\s+(.+?)\s*$/gm)].map(m => `${target.id}#${slug(m[1])}`);
        const hint = sections.length ? `; it links the whole of ${target.id}, so any edit there stales it: link the sections it depends on instead (${sections.join(', ')})` : '';
        problems.push(`${name}: stale: ${link.key} changed since it was recorded${hint}`);
      }
    }

    // Open-item markers (AC-42): listed for every artifact; an approved one should have none left.
    for (const item of openItems(a.body ?? '', a.bodyLine)) {
      open.push({ id: a.id, file: a.file, ...item });
      if (isApproved(a) && !ACCEPTED_MARKERS.has(item.marker)) warnings.push(`${name}: approved, but ${a.file}:${item.line} still has ${item.marker}: settle it with the approver, or, if they accept it as a working assumption to check later, mark it [to validate]; changing the wording only to clear this warning hides the gap`);
    }

    // An approved product artifact cannot rest on a file that has no approval of its own (AC-43).
    if (isApproved(a) && a.file.startsWith('docs/product/')) {
      for (const link of markdownLinks(a.body ?? '', a.file, a.bodyLine)) {
        if (artifactFiles.has(link.target) || !fs.existsSync(path.join(root, link.target))) continue;
        warnings.push(`${name}: ${a.file}:${link.line} links to ${link.target}, which is not a process artifact, so approving ${a.id} does not cover what it says; move the content into ${a.id}, or make the file an artifact (a discovery file, for example) and link its section in derived-from`);
      }
    }

    // An approved tutorial ships with the documentation that ships (lasting-tutorials AC-9): some
    // approved user documentation page must link to its file. A draft tutorial is not checked.
    // One that derives from no user documentation (the stage is waived, or its design is marked
    // no-user-docs) has none to be linked from.
    if (a.stage === 'tutorials' && isApproved(a) && (a.links ?? []).some(l => byId.get(l.target)?.stage === 'user-docs')) {
      const file = a.file.replace(/\\/g, '/');
      const linked = artifacts.some(u => u.stage === 'user-docs' && isApproved(u) && u.file.replace(/\\/g, '/').startsWith('docs/user/')
        && markdownLinks(u.body ?? '', u.file, u.bodyLine).some(l => l.target === file));
      // With lasting: 'warn' this is a warning, for tutorials written before the rule (AC-15).
      if (!linked) (lasting === 'warn' ? warnings : problems).push(`${name}: no approved user documentation links to ${a.file}; add a "Try it" link to it in the page under docs/user/ that covers the task, so the tutorial ships with the documentation`);
    }

    if (a.stage === 'stories') {
      const personas = a.links.map(l => byId.get(l.target)).filter(t => t?.stage === 'personas');
      if (!personas.length) problems.push(`${name}: names no persona (link one in derived-from)`);
      for (const p of personas) if (!isApproved(p)) problems.push(`${name}: persona ${p.id} is not approved`);
      const shape = isApproved(a) ? problems : { push: (...msgs) => warnings.push(...msgs) };
      for (const msg of storyShape(a.body, personas)) shape.push(`${name}: ${msg}`);
    }

    if (a.stage === 'user-docs') {
      const { designs, missing } = undefinedNames(a, byId, artifacts);
      for (const n of missing) warnings.push(`${name}: **${n}** is not named in its design (${designs.join(', ')}); use the design's name, add it to the design, or, if it is emphasis and not a name, remove the bold`);
    }

    // Stage order (AC-63): every delivery stage is required unless process.yml waives it. An artifact
    // derives from the nearest earlier stage that is not waived, so a spec cannot come straight from
    // stories while the design and the user documentation are still to be written.
    const need = config?.waived?.[a.stage] ? null : requiredUpstream(a.stage, config?.waived ?? {});
    // Work with no user-facing behaviour (process-state AC-10): a spec may derive from a design that
    // says, with a reason, that what it covers needs no user documentation. The approver approves
    // that statement with the design.
    const enablingDesign = t => t?.stage === 'design' && typeof t.noUserDocs === 'string' && t.noUserDocs.length >= 10;
    const enabling = a.stage === 'specs' && need === 'user-docs' && a.links.some(l => enablingDesign(byId.get(l.target)));
    if (a.noUserDocs !== undefined) {
      const readers = artifacts.filter(u => u.stage === 'user-docs' && u.links.some(l => l.target === a.id));
      if (a.stage !== 'design') problems.push(`${name}: no-user-docs is only for a design; remove it`);
      else if (a.noUserDocs.length < 10) problems.push(`${name}: no-user-docs needs a reason (a sentence saying why the work this design covers has nothing a user sees)`);
      else if (readers.length) problems.push(`${name}: says no-user-docs, but ${readers.map(u => u.id ?? u.file).join(', ')} derives from it; a design with user documentation is not enabling work, so remove no-user-docs or give the enabling work its own design`);
    }
    if (need && !enabling && !a.links.some(l => byId.get(l.target)?.stage === need)) {
      const waivable = need === 'stories' ? '' : `, or waive ${need} in ${CONFIG_PATH} with the reason the project does not need it, before the work starts`;
      problems.push(`${name}: derives from no ${need === 'user-docs' ? 'user documentation' : need} (stage order: ${need} comes before ${a.stage}); write and approve it first, then link it in derived-from${waivable}`);
    }

    if (a.stage === 'specs') {
      for (const c of parseCriteria(a.body).filter(c => c.needsTest)) {
        if (!c.sources.length) { problems.push(`${name}#${c.id}: test: criterion has no source (an approved story or user documentation section)`); continue; }
        for (const src of c.sources) {
          const link = a.links.find(l => l.key === src);
          const stage = link && byId.get(link.target)?.stage;
          if (!link) problems.push(`${name}#${c.id}: source ${src} is not in derived-from`);
          else if (stage && stage !== 'stories' && stage !== 'user-docs' && !enablingDesign(byId.get(link.target))) problems.push(`${name}#${c.id}: source ${src} is not a story or user documentation`);
        }
      }
    }
  }

  // Rule 2: cycles, reported once each.
  const state = new Map();
  const reported = new Set();
  const visit = (a, trail) => {
    state.set(a, 'open');
    for (const l of a.links) {
      const t = byId.get(l.target);
      if (!t) continue;
      if (state.get(t) === 'open') {
        const cycle = [...trail.slice(trail.indexOf(t.id)), t.id];
        const key = [...new Set(cycle)].sort().join(',');
        if (!reported.has(key)) { reported.add(key); errors.push(`cycle: ${cycle.join(' -> ')}`); }
      } else if (!state.has(t)) visit(t, [...trail, t.id]);
    }
    state.set(a, 'done');
  };
  for (const a of byId.values()) if (!state.has(a)) visit(a, [a.id]);

  // A tutorial's starts-from (lasting-tutorials AC-4) names another tutorial, and the chain ends.
  // It is read from the file the same small way the runner reads it.
  const tutorials = artifacts.filter(a => a.stage === 'tutorials' && a.id)
    .map(a => ({ id: a.id, startsFrom: startsFromOf(fs.readFileSync(path.join(root, a.file), 'utf8')) }));
  for (const p of startsFromProblems(tutorials)) {
    errors.push(p.message);
    if (p.id) involved.add(p.id);
  }

  // A tutorial's needs (lasting-tutorials AC-14) can be read, and, when process.yml says what each
  // place provides, some place provides each of them.
  const provided = config?.try?.provides ? new Set(Object.values(config.try.provides).flat()) : null;
  for (const a of artifacts.filter(x => x.stage === 'tutorials' && x.id)) {
    const { needs, error } = needsOf(fs.readFileSync(path.join(root, a.file), 'utf8'));
    if (error) { errors.push(`${a.id}: ${error}`); involved.add(a.id); continue; }
    const missing = provided ? (needs ?? []).filter(n => !provided.has(n)) : [];
    if (missing.length) {
      errors.push(`${a.id}: needs ${missing.join(', ')}, which no place in try.provides in ${CONFIG_PATH} provides; add it to the place that has it (local, preview, or staging), or remove it from needs`);
      involved.add(a.id);
    }
  }

  // Organised user documentation (lasting-tutorials AC-16 to AC-18), in a project that has any: a
  // start page, a folder with an overview for each area, links that reach every approved page, and
  // each covers: entry in one page. The shape is checked once docs/user/ has a start page or an area
  // overview, and follows the lasting setting (AC-15); covers: is new and opt-in, so its problems are
  // always errors.
  if (artifacts.some(a => a.stage === 'user-docs')) {
    const tree = workingTree(root);
    const { shape, covers } = userDocsProblems(tree.listDir(USER_DOCS), tree.read);
    for (const p of shape) {
      if (lasting === 'warn') warnings.push(p.message);
      else { errors.push(p.message); if (p.id) involved.add(p.id); }
    }
    for (const p of covers) { errors.push(p.message); if (p.id) involved.add(p.id); }
  }

  // try.local (AC-5): a command that runs a package script names one the project has.
  const script = localScript(config?.try?.local);
  if (script) {
    let pkg = null;
    try { pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')); } catch { /* no package.json, or not JSON: not checked */ }
    if (pkg && !Object.hasOwn(pkg.scripts ?? {}, script)) errors.push(`process.yml: try.local runs the package script "${script}", which package.json does not have; add a "${script}" script to package.json, or change try.local to the command that starts the product`);
  }

  // Rule 7: withdrawals since the base.
  if (base) {
    const tree = gitTree(root, base);
    if (!tree) errors.push(`base ${base} not found (is the full history fetched?)`);
    else {
      const before = new Map(loadArtifacts(tree).artifacts.filter(a => a.id).map(a => [a.id, a]));
      for (const a of artifacts) {
        // A tutorial a revision changes goes back to draft when a step's words changed (AC-6, D3):
        // the lead's validation was of the steps as they were.
        const tutorialChanged = a.stage === 'tutorials' && isApproved(before.get(a.id)) && isApproved(a);
        if (a.status === 'draft' && !a.withdrawn && isApproved(before.get(a.id)) && !(a.stage === 'tutorials' && changedSteps(before.get(a.id), a).length)) {
          errors.push(`${a.id}: was approved at ${base} and is now draft without a withdrawn entry. If you are amending it, keep status: approved; the gated merge approves the change. Set draft only to withdraw it, with withdrawn: <reason> (#<issue>)`);
          involved.add(a.id);
        }
        const steps = tutorialChanged ? changedSteps(before.get(a.id), a) : [];
        if (steps.length) {
          errors.push(`${a.id}: the words of ${steps.length === 1 ? 'step' : 'steps'} ${steps.join(', ')} changed since ${base}, so it is no longer the tutorial the lead followed; set status: draft, and it is approved again when the lead has followed it and it holds`);
          involved.add(a.id);
        }
      }
    }
  }

  const unrecorded = artifacts.filter(a => !isApproved(a)).reduce((n, a) => n + a.links.filter(l => !l.hash).length, 0);
  return { errors, warnings, notes, openItems: open, checked: artifacts.length, involved: [...involved].sort(), unrecorded };
}

// One row per persona, epic, and story: its status, the furthest stage that approved work below
// it has reached, and anything below it (or itself) that is stale or withdrawn.
export function processStatus(root) {
  const { artifacts } = load(root);
  const { byId, stale } = analyse(artifacts);
  const below = new Map([...byId.values()].map(a => [a, []]));
  for (const a of byId.values()) for (const l of a.links) { const t = byId.get(l.target); if (t && t !== a) below.get(t).push(a); }
  const rows = [];
  for (const a of byId.values()) {
    if (!['personas', 'epics', 'stories'].includes(a.stage)) continue;
    const seen = new Set([a]);
    const queue = [a];
    while (queue.length) for (const d of below.get(queue.shift())) if (!seen.has(d)) { seen.add(d); queue.push(d); }
    const approved = [...seen].filter(isApproved).map(x => STAGE_ORDER.indexOf(x.stage));
    const attention = [...seen]
      .map(x => (x.withdrawn ? { id: x.id, problem: 'withdrawn' } : stale(x) ? { id: x.id, problem: 'stale' } : null))
      .filter(Boolean)
      .sort((p, q) => p.id.localeCompare(q.id));
    rows.push({ id: a.id, stage: a.stage, status: a.status, reached: approved.length ? STAGE_ORDER[Math.max(...approved)] : null, attention });
  }
  return rows.sort((p, q) => STAGE_ORDER.indexOf(p.stage) - STAGE_ORDER.indexOf(q.stage) || p.id.localeCompare(q.id));
}

// Logins to assign the stale issue to: the approvers of each stage with a failing artifact.
// Teams are left out, because issues can only be assigned to people.
export function staleAssignees(root, opts) {
  const { config, artifacts } = load(root);
  if (!config) return [];
  const { involved } = runProcessTrace(root, opts);
  const stages = new Set(artifacts.filter(a => involved.includes(a.id)).map(a => a.stage));
  const logins = new Set();
  for (const stage of stages) for (const a of approversFor(stage, config)) if (!isTeam(a)) logins.add(login(a));
  return [...logins].sort();
}

// The rules-for-robots commit this script runs from, so local and CI runs can be compared (AC-31).
function checkoutCommit() {
  const r = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: path.dirname(fileURLToPath(import.meta.url)), encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '(commit unknown: not a git checkout)';
}

function main(argv) {
  const args = [...argv];
  const flag = name => { const i = args.indexOf(name); if (i === -1) return false; args.splice(i, 1); return true; };
  const option = name => { const i = args.indexOf(name); if (i === -1) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
  const status = flag('--status');
  const assignees = flag('--assignees');
  const json = flag('--json');
  const base = option('--base');
  const root = path.resolve(args[0] ?? '.');

  if (assignees) { console.log(staleAssignees(root).join(',')); return; }

  if (status) {
    const rows = processStatus(root);
    if (json) { console.log(JSON.stringify(rows, null, 2)); return; }
    if (!rows.length) { console.log('No personas, epics, or stories.'); return; }
    for (const r of rows) {
      const notes = r.attention.map(p => `${p.id} ${p.problem}`).join(', ');
      console.log(`${r.stage.padEnd(9)} ${r.id.padEnd(32)} ${r.status.padEnd(9)} reached: ${r.reached ?? '-'}${notes ? `  attention: ${notes}` : ''}`);
    }
    return;
  }

  const r = runProcessTrace(root, { base, lasting: process.env.RFR_LASTING_TUTORIALS === 'warn' ? 'warn' : 'fail' });
  if (!json) console.log(`Checked with rules-for-robots ${checkoutCommit()}.`);
  if (json) console.log(JSON.stringify(r, null, 2));
  for (const w of r.warnings) console.warn(`warning: ${w}`);
  for (const n of r.notes) console.warn(`note: ${n}`);
  if (!json && r.notes.length) console.warn(`note: ${r.notes.length === 1 ? 'that spec or tutorial is' : 'those specs and tutorials are'} behind an approved change. That is delivery work, not a failure: the process state lists each feature as a revision open, and /rfr-process:deliver brings it up to date.`);
  for (const e of r.errors) console.error(e);
  if (!json && r.openItems?.length) {
    console.log(`Open items (${r.openItems.length}):`);
    for (const o of r.openItems) console.log(`  ${o.file}:${o.line} ${o.marker} ${o.text}`);
  }
  if (r.errors.length) process.exit(1);
  if (!json) {
    if (!r.checked) console.log('No process artifacts.');
    else if (r.notes.length) console.log(`${r.checked} process artifact(s) checked; ${r.notes.length} link(s) of approved specs and tutorials are behind (revisions open, listed above as notes); every other recorded link is current.`);
    else if (r.unrecorded) console.log(`${r.checked} process artifact(s) checked; recorded links are current, and ${r.unrecorded} draft link(s) have hashes not yet recorded (they are recorded when each draft is approved).`);
    else console.log(`${r.checked} process artifact(s) checked; links are current.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
