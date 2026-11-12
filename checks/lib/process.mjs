// Shared parsing for the project process (docs/specs/project-process.md): process.yml, artifact
// front matter, sections, and hashes. Dependency-free, so the check runs from an .rfr checkout
// without npm install. The YAML here is a small subset: scalars, inline lists, block lists, one
// level of mappings, and "- key: value" list items. Anything else is reported, not guessed at.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const CONFIG_PATH = 'docs/product/process.yml';

// Gated stages in order. `dir` is a folder (every .md below it) or a single file. Specs are only
// process artifacts when they have an `id`, so plain Phase 10 specs in docs/specs/ are left alone.
export const STAGES = [
  { name: 'concept', file: 'docs/product/concept.md' },
  { name: 'discovery', dir: 'docs/product/discovery' },
  { name: 'requirements', dir: 'docs/product/requirements' },
  { name: 'personas', dir: 'docs/product/personas' },
  { name: 'epics', dir: 'docs/product/epics' },
  { name: 'stories', dir: 'docs/product/stories' },
  { name: 'design', dir: 'docs/design' },
  { name: 'user-docs', dir: 'docs/user' },
  { name: 'specs', dir: 'docs/specs', needsId: true },
  { name: 'tutorials', dir: 'docs/tutorials' },
];
export const STAGE_ORDER = STAGES.map(s => s.name);
const CONFIG_STAGES = new Set([...STAGE_ORDER, 'release']);
const CONFIG_KEYS = new Set(['mode', 'default', 'stages', 'gates', 'public-api', 'adoption-until', 'project', 'waived']);

// Stage order (project-process AC-63): every delivery stage is required unless process.yml waives it,
// with a reason, before work starts. An artifact of each stage below must derive from an approved
// artifact of the nearest stage before it in this chain that is not waived.
const UPSTREAM = {
  design: ['stories'],
  'user-docs': ['design', 'stories'],
  specs: ['user-docs', 'design', 'stories'],
  tutorials: ['user-docs', 'design', 'stories'],
};

// The stage an artifact of `stage` must derive from: the first of its upstream stages that is not
// waived. null for a stage with no required upstream here.
export function requiredUpstream(stage, waived = {}) {
  return UPSTREAM[stage]?.find(s => !waived[s]) ?? null;
}
export const STATUSES = new Set(['draft', 'approved', 'implemented']);

// ---- YAML subset ------------------------------------------------------------------------------

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

const unquote = s => s.trim().replace(/^(['"])(.*)\1$/, '$2');

function scalarOrList(value) {
  const v = value.trim();
  if (v.startsWith('[')) {
    if (!v.endsWith(']')) return { error: `unclosed list: ${v}` };
    return { value: v.slice(1, -1).split(',').map(unquote).filter(Boolean) };
  }
  return { value: unquote(v) };
}

// Parses lines into { key: scalar | list | { key: scalar | list } }. Returns { data, errors }.
function parseYamlSubset(text) {
  const data = {};
  const errors = [];
  let parent = null;   // top-level key whose value is a mapping or block list
  let child = null;    // second-level key whose value is a block list
  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    const line = stripComment(raw).replace(/\s+$/, '');
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    const item = /^\s*-\s+(.*)$/.exec(line);
    const field = /^\s*([A-Za-z0-9_@./-]+):(?:\s+(.*))?$/.exec(line);
    if (indent === 0 && field) {
      const [, key, value] = field;
      child = null;
      if (value === undefined || value === '') { data[key] = null; parent = key; continue; }
      parent = null;
      const parsed = scalarOrList(value);
      if (parsed.error) errors.push(`line ${i + 1}: ${parsed.error}`);
      data[key] = parsed.value;
    } else if (item && parent) {
      const target = child ? data[parent][child] : null;
      if (child && (target === null || Array.isArray(target))) data[parent][child] = [...(target ?? []), unquote(item[1])];
      else if (!child && (data[parent] === null || Array.isArray(data[parent]))) data[parent] = [...(data[parent] ?? []), unquote(item[1])];
      else errors.push(`line ${i + 1}: unexpected list item`);
    } else if (field && parent && indent > 0) {
      const [, key, value] = field;
      if (data[parent] === null) data[parent] = {};
      if (Array.isArray(data[parent])) { errors.push(`line ${i + 1}: mixes a list and a mapping under ${parent}`); continue; }
      if (value === undefined || value === '') { data[parent][key] = null; child = key; continue; }
      child = null;
      const parsed = scalarOrList(value);
      if (parsed.error) errors.push(`line ${i + 1}: ${parsed.error}`);
      data[parent][key] = parsed.value;
    } else {
      errors.push(`line ${i + 1}: cannot read "${raw.trim()}"`);
    }
  }
  return { data, errors };
}

// ---- process.yml ------------------------------------------------------------------------------

const asList = v => (Array.isArray(v) ? v : v ? [v] : []);

function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s ?? '')) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function parseProcessConfig(text) {
  const { data, errors } = parseYamlSubset(text);
  const config = { mode: 'team', default: [], stages: {}, gates: {}, publicApi: [], adoptionUntil: null, project: null, waived: {} };
  for (const key of Object.keys(data)) if (!CONFIG_KEYS.has(key)) errors.push(`process.yml: unknown key "${key}"`);
  if (data.mode !== undefined && data.mode !== null) {
    if (data.mode === 'team' || data.mode === 'solo') config.mode = data.mode;
    else errors.push(`process.yml: mode must be team or solo, not "${data.mode}"`);
  }
  config.default = asList(data.default);
  if (!config.default.length) errors.push('process.yml: a non-empty "default" list of approvers is required');
  if (data.stages !== undefined && data.stages !== null) {
    if (typeof data.stages !== 'object' || Array.isArray(data.stages)) errors.push('process.yml: "stages" must map stage names to approvers');
    else {
      for (const [stage, approvers] of Object.entries(data.stages)) {
        if (!CONFIG_STAGES.has(stage)) errors.push(`process.yml: unknown stage "${stage}" (known: ${[...CONFIG_STAGES].join(', ')})`);
        else if (!asList(approvers).length) errors.push(`process.yml: stage "${stage}" names no approvers`);
        else config.stages[stage] = asList(approvers);
      }
    }
  }
  if (data.gates !== undefined && data.gates !== null) {
    if (typeof data.gates !== 'object' || Array.isArray(data.gates)) errors.push('process.yml: "gates" must map stage names to approve, notify, or agent');
    else {
      for (const [stage, type] of Object.entries(data.gates)) {
        if (!CONFIG_STAGES.has(stage)) errors.push(`process.yml: unknown stage "${stage}" in gates (known: ${[...CONFIG_STAGES].join(', ')})`);
        else if (!GATE_TYPES.includes(type)) errors.push(`process.yml: gate for "${stage}" must be one of ${GATE_TYPES.join(', ')}, not "${type}"`);
        else config.gates[stage] = type;
      }
    }
  }
  if (data.waived !== undefined && data.waived !== null) {
    if (typeof data.waived !== 'object' || Array.isArray(data.waived)) errors.push('process.yml: "waived" must map stage names to the reason each is waived');
    else {
      for (const [stage, reason] of Object.entries(data.waived)) {
        if (!['design', 'user-docs', 'specs'].includes(stage)) errors.push(`process.yml: only design, user-docs, and specs can be waived, not "${stage}"`);
        else if (typeof reason !== 'string' || reason.trim().length < 10) errors.push(`process.yml: waived ${stage} needs a reason (a sentence saying why the project does not need it)`);
        else config.waived[stage] = reason.trim();
      }
    }
  }
  config.publicApi = asList(data['public-api']);
  if (data.project !== undefined && data.project !== null) {
    const m = /^https:\/\/github\.com\/(orgs|users)\/([^/\s]+)\/projects\/(\d+)\/?$/.exec(String(data.project));
    if (m) config.project = { owner: m[2], kind: m[1] === 'orgs' ? 'organization' : 'user', number: Number(m[3]) };
    else errors.push(`process.yml: project must be a GitHub Project URL like https://github.com/orgs/<org>/projects/<number>, not "${data.project}"`);
  }
  if (data['adoption-until'] !== undefined && data['adoption-until'] !== null) {
    if (validDate(data['adoption-until'])) config.adoptionUntil = data['adoption-until'];
    else errors.push(`process.yml: adoption-until must be a date (YYYY-MM-DD), not "${data['adoption-until']}"`);
  }
  return { config, errors };
}

// ---- artifacts --------------------------------------------------------------------------------

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

// Front matter fields used by the process: id, status, withdrawn, derived-from (block list of
// "target[#section]: hash"). Other fields (Phase 10's tests-commit, unlocks) are ignored here.
export function parseArtifact(text) {
  const match = FRONT_MATTER.exec(text);
  if (!match) return { front: null, body: text, links: [], errors: [] };
  const front = { id: null, status: null, withdrawn: null };
  const links = [];
  const errors = [];
  let inLinks = false;
  for (const raw of match[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    // A link is `- id#section: hash`; a new one may have no hash yet, with or without the colon.
    const item = /^\s+-\s+([^\s:]+)(?::(?:\s+(.*))?)?\s*$/.exec(raw);
    if (inLinks && item) {
      const [target, section] = item[1].split('#');
      links.push({ key: item[1], target, section: section || null, hash: (item[2] ?? '').trim() });
      continue;
    }
    if (inLinks && /^\s+-/.test(raw)) { errors.push(`cannot read derived-from entry "${raw.trim()}" (expected "- id#section: hash")`); continue; }
    const field = /^([a-z-]+):\s*(.*)$/.exec(raw);
    inLinks = false;
    if (!field) continue;
    const [, key, value] = field;
    if (key === 'id') front.id = value.trim() || null;
    else if (key === 'status') front.status = value.trim() || null;
    else if (key === 'withdrawn') front.withdrawn = value.trim() || null;
    // A design can say the work it covers needs no user documentation, with the reason
    // (process-state AC-10). Set only when the field is present.
    else if (key === 'no-user-docs') front.noUserDocs = value.trim();
    else if (key === 'derived-from') {
      inLinks = true;
      if (value.trim() && value.trim() !== '[]') errors.push('derived-from must be a block list ("  - id#section: hash")');
    }
  }
  return { front, body: match[2], links, errors };
}

function walkMarkdown(root, rel) {
  const out = [];
  const abs = path.join(root, rel);
  let entries;
  try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return out; }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const childRel = `${rel}/${e.name}`;
    if (e.isDirectory()) out.push(...walkMarkdown(root, childRel));
    else if (e.isFile() && e.name.endsWith('.md')) out.push(childRel);
  }
  return out;
}

// Lists the process artifact files under root as { file, stage }, reading through `read(file)`
// (the working tree by default; rule 7 passes a reader for a git ref). `list(dir)` lists .md files.
export function stageFiles(listDir, fileExists) {
  const out = [];
  for (const stage of STAGES) {
    if (stage.file) { if (fileExists(stage.file)) out.push({ file: stage.file, stage }); }
    else for (const file of listDir(stage.dir)) out.push({ file, stage });
  }
  return out;
}

export function loadArtifacts({ listDir, fileExists, read }) {
  const artifacts = [];
  const errors = [];
  for (const { file, stage } of stageFiles(listDir, fileExists)) {
    const text = read(file);
    const parsed = parseArtifact(text);
    if (stage.needsId && !parsed.front?.id) continue;
    if (!parsed.front) { errors.push(`${file}: no front matter (a --- block with id and status)`); continue; }
    for (const e of parsed.errors) errors.push(`${file}: ${e}`);
    // bodyLine: the file line the body starts on, so messages can give file line numbers.
    const at = parsed.body ? text.lastIndexOf(parsed.body) : -1;
    const bodyLine = at < 0 ? 1 : text.slice(0, at).split('\n').length;
    artifacts.push({ file, stage: stage.name, ...parsed.front, body: parsed.body, bodyLine, links: parsed.links });
  }
  return { artifacts, errors };
}

export function workingTree(root) {
  return {
    listDir: dir => walkMarkdown(root, dir),
    fileExists: file => fs.existsSync(path.join(root, file)),
    read: file => fs.readFileSync(path.join(root, file), 'utf8'),
  };
}

// ---- sections and hashes ----------------------------------------------------------------------

const normalize = text => text.replace(/\s+/g, ' ').trim();

export function hashText(text) {
  return crypto.createHash('sha256').update(normalize(text)).digest('hex').slice(0, 12);
}

export function slug(heading) {
  return heading.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The text of a section: a heading with that slug, a heading containing that ID, a table row whose
// first cell is that ID, or a list item starting with that ID. Null when there is none.
export function sectionText(body, section) {
  if (!section) return body;
  const lines = body.split(/\r?\n/);
  const id = new RegExp(`(?<![\\w-])${escapeRe(section)}(?![\\w-])`);
  const headings = lines.map((l, i) => ({ i, m: HEADING.exec(l) })).filter(h => h.m);
  const heading = headings.find(h => slug(h.m[2]) === section.toLowerCase()) ?? headings.find(h => id.test(h.m[2]));
  if (heading) {
    const level = heading.m[1].length;
    const end = headings.find(h => h.i > heading.i && h.m[1].length <= level)?.i ?? lines.length;
    return lines.slice(heading.i, end).join('\n');
  }
  const row = lines.find(l => {
    const t = l.trim();
    return t.startsWith('|') && t.replace(/^\|/, '').split('|')[0].trim() === section;
  });
  if (row) return row;
  const start = lines.findIndex(l => new RegExp(`^(\\s*)[-*+]\\s+${escapeRe(section)}(?![\\w-])`).test(l));
  if (start !== -1) {
    const indent = /^\s*/.exec(lines[start])[0].length;
    let end = start + 1;
    while (end < lines.length && lines[end].trim() && /^\s*/.exec(lines[end])[0].length > indent) end++;
    return lines.slice(start, end).join('\n');
  }
  return null;
}

export function sectionHash(body, section) {
  const text = sectionText(body, section);
  return text === null ? null : hashText(text);
}

// ---- stages, gates, and approvers -------------------------------------------------------------

// The stage a repository path belongs to, or null. A docs/specs file maps to 'specs' whatever its
// content; callers decide whether it is a process artifact (it has an id).
export function stageOf(file) {
  const f = file.replace(/\\/g, '/').replace(/^\.\//, '');
  for (const stage of STAGES) {
    if (stage.file ? f === stage.file : f.startsWith(`${stage.dir}/`) && f.endsWith('.md')) return stage.name;
  }
  return null;
}

// Stages whose changes need an approver: every design and validation stage, and specs only when
// process.yml names spec approvers (agents approve specs otherwise).
export function gatedStages(config) {
  return STAGE_ORDER.filter(s => s !== 'specs' || (config?.stages?.specs?.length ?? 0) > 0);
}

// Gate types (process plan 23b, P1): approve (a person; the merge waits for them), notify (the
// person is told after the merge and can object through the decision queue), agent (an independent
// reviewer's recorded review on the head commit). process.yml's gates: map sets them per stage.
// Without it, a supervised project keeps today's rule, approve everywhere; a delegated project
// (.claude/rfr.json "mode": "delegated") leaves the person the concept, the design with its user
// documentation, the demos, and the release, and is told about the derived stages.
export const GATE_TYPES = ['approve', 'notify', 'agent'];
export const DELEGATED_GATES = { concept: 'approve', discovery: 'notify', requirements: 'notify', personas: 'notify', epics: 'notify', stories: 'notify', design: 'approve', 'user-docs': 'approve', specs: 'approve', tutorials: 'approve', release: 'approve' };

// The project's working mode, from .claude/rfr.json: 'delegated' or 'supervised' (the default).
export function readWorkMode(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.claude', 'rfr.json'), 'utf8'))?.mode === 'delegated' ? 'delegated' : 'supervised';
  } catch {
    return 'supervised';
  }
}

export function gateOf(stage, config, workMode = 'supervised') {
  return config?.gates?.[stage] ?? (workMode === 'delegated' ? DELEGATED_GATES[stage] ?? 'approve' : 'approve');
}

// The gated stages whose gate is the given type.
export function stagesWithGate(config, workMode, type) {
  return gatedStages(config).filter(stage => gateOf(stage, config, workMode) === type);
}

export function approversFor(stage, config) {
  return config?.stages?.[stage] ?? config?.default ?? [];
}

export const isTeam = approver => /^@?[^/\s]+\/[^/\s]+$/.test(approver);
export const login = approver => approver.replace(/^@/, '');

export function hasId(text) {
  return !!parseArtifact(text ?? '').front?.id;
}

export function readConfig(root) {
  const file = path.join(root, CONFIG_PATH);
  if (!fs.existsSync(file)) return null;
  return parseProcessConfig(fs.readFileSync(file, 'utf8'));
}

// ---- open-item markers ------------------------------------------------------------------------

// [open], [assumed], and [proposed] mark what an artifact has not settled (AC-42); [to validate]
// marks a working assumption the approver accepted, to check later (AC-46). Markers inside HTML
// comments, fenced code blocks, and inline code are examples, not markers.
export const MARKERS = ['[open]', '[assumed]', '[proposed]', '[to validate]'];
export const ACCEPTED_MARKERS = new Set(['[to validate]']);

// Body lines as prose: HTML comments, fenced code blocks, and inline code removed (examples, not
// content). Returns [{ index, prose, raw }] with the 0-based line index.
export function proseLines(body) {
  const out = [];
  let inFence = false;
  let inComment = false;
  for (const [index, raw] of body.split(/\r?\n/).entries()) {
    if (/^\s*(```|~~~)/.test(raw)) { inFence = !inFence; continue; }
    if (inFence) continue;
    let line = '';
    let rest = raw;
    while (rest.length) {
      if (inComment) {
        const end = rest.indexOf('-->');
        if (end < 0) { rest = ''; break; }
        inComment = false;
        rest = rest.slice(end + 3);
      } else {
        const start = rest.indexOf('<!--');
        if (start < 0) { line += rest; break; }
        line += rest.slice(0, start);
        inComment = true;
        rest = rest.slice(start + 4);
      }
    }
    out.push({ index, prose: line.replace(/`[^`]*`/g, ''), raw });
  }
  return out;
}

export function openItems(body, firstLine = 1) {
  const items = [];
  for (const { index, prose, raw } of proseLines(body)) {
    for (const marker of MARKERS) {
      if (prose.toLowerCase().includes(marker)) items.push({ marker, line: firstLine + index, text: raw.trim() });
    }
  }
  return items;
}

// Relative Markdown links to .md files in prose: [{ target (repository path), line }] (AC-43).
export function markdownLinks(body, file, firstLine = 1) {
  const links = [];
  const dir = path.posix.dirname(file.replace(/\\/g, '/'));
  for (const { index, prose } of proseLines(body)) {
    for (const m of prose.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
      const href = m[1].split('#')[0];
      if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || !/\.md$/i.test(href)) continue;
      const target = href.startsWith('/') ? href.slice(1) : path.posix.normalize(path.posix.join(dir, href));
      links.push({ target, line: firstLine + index });
    }
  }
  return links;
}

// ---- process state (docs/specs/process-state.md) ----------------------------------------------

// Approved, and not merely marked so in the working branch: an artifact is approved when the pull
// request that carries it merges, so one that is new or changed in this branch is not yet.
const approvedNow = a => (a.status === 'approved' || a.status === 'implemented') && !a.inBranch;
const STAGE_WORDS = { stories: 'the story', design: 'the design', 'user-docs': 'the user documentation', specs: 'the spec', tutorials: 'the tutorial' };

// The first thing still to do for each story, in stage order (AC-1): { story, step, stage, files,
// inBranch }, where step is approve, write, deliver, delivering, validate, or done. Artifacts
// belong to a story when they derive from it, directly or through others.
export function featureSteps(artifacts, config) {
  const waived = config?.waived ?? {};
  const byId = new Map(artifacts.filter(a => a.id).map(a => [a.id, a]));
  const below = new Map([...byId.values()].map(a => [a, []]));
  for (const a of byId.values()) for (const l of a.links ?? []) { const t = byId.get(l.target); if (t && t !== a) below.get(t).push(a); }
  const steps = [];
  for (const story of byId.values()) {
    if (story.stage !== 'stories') continue;
    const seen = new Set([story]);
    const queue = [story];
    while (queue.length) for (const d of below.get(queue.shift())) if (!seen.has(d)) { seen.add(d); queue.push(d); }
    const at = stage => [...seen].filter(a => a.stage === stage);
    const make = (step, stage, items = []) => {
      const pending = items.filter(a => !approvedNow(a));
      return { story: story.id, step, stage, files: (pending.length ? pending : items).map(a => a.file), inBranch: pending.some(a => a.inBranch), started: seen.size > 1 };
    };
    if (!approvedNow(story)) { steps.push(make('approve', 'stories', [story])); continue; }
    let found = null;
    for (const stage of ['design', 'user-docs']) {
      if (waived[stage]) continue;
      const items = at(stage);
      if (!items.length) { found = make('write', stage); break; }
      if (items.some(a => !approvedNow(a))) { found = make('approve', stage, items); break; }
    }
    if (found) { steps.push(found); continue; }
    const tutorials = at('tutorials');
    const specs = at('specs');
    if (tutorials.length && tutorials.every(approvedNow)) steps.push(make('done', 'tutorials', tutorials));
    else if (tutorials.length) steps.push(make('validate', 'tutorials', tutorials));
    else steps.push(make(specs.length ? 'delivering' : 'deliver', 'specs', specs));
  }
  return steps.sort((p, q) => p.story.localeCompare(q.story));
}

const NEXT_RULE = [
  "rfr-process: this project follows a staged process. Before any work, find the feature's stage below.",
  'Do only what that stage allows; when a stage is missing, write it instead of working round it. Approved user documentation is the definition of done.',
  'A source change belongs to a feature with an approved spec, or says `Change: fix` or `Change: trivial` at the end of a commit message (a fix changes a test and adds no source file; a trivial change adds no source file).',
  'After you push a branch the approver must review, tell them once, with the link to review it, and do not build on it until it has merged. When a feature\'s delivery is open, run /rfr-process:deliver and finish it without asking.',
];
const NEXT_MAX_LINES = 40;

// The text an agent is given at the start of a session (AC-3).
export function renderNext({ steps, product = [], note = null }) {
  const names = files => (files.length ? ` (${files.join(', ')})` : '');
  const pending = s => (s.inBranch ? 'in this branch, and not approved until its pull request merges' : 'a draft, waiting for approval');
  // Stories with nothing written for them yet: a backlog, named in one line and not as open work.
  const idle = steps.filter(s => s.step === 'write' && !s.started);
  // Stories at the same step on the same files (one design or spec often covers several) share a line.
  const groups = new Map();
  for (const s of steps) {
    if (idle.includes(s) || s.step === 'done') continue;
    const what = s.step === 'approve' ? `${STAGE_WORDS[s.stage]}${names(s.files)} is ${pending(s)}`
      : s.step === 'validate' ? `${STAGE_WORDS[s.stage]}${names(s.files)} is ${pending(s)}; the approver follows it against the delivery`
        : s.step === 'write' ? `write ${STAGE_WORDS[s.stage]}`
          : s.step === 'deliver' ? 'delivery is open: the spec, tests, implementation, and tutorial, on one branch (/rfr-process:deliver)'
            : `delivery is under way${names(s.files)}`;
    const key = `${['approve', 'validate'].includes(s.step) ? 'waiting' : 'open'}\n${what}`;
    groups.set(key, [...(groups.get(key) ?? []), s.story]);
  }
  const waiting = [];
  const open = [];
  for (const [key, stories] of groups) {
    const [kind, what] = key.split('\n');
    const shown = stories.slice(0, 6);
    const line = stories.length === 1 ? `${stories[0]}: ${what}` : `${what} (${stories.length} stories): ${shown.join(', ')}${stories.length > shown.length ? `, and ${stories.length - shown.length} more` : ''}`;
    (kind === 'waiting' ? waiting : open).push(line);
  }
  const done = steps.filter(s => s.step === 'done').length;
  const lines = [...NEXT_RULE];
  if (note) lines.push(note);
  const section = (title, items) => { if (items.length) lines.push('', title, ...items.map(i => `  - ${i}`)); };
  section('Waiting on the approver (review the pull request; do not build on these yet):', waiting);
  section('Open for an agent:', open);
  section('Product-level drafts:', product.map(a => `${a.id} (${a.stage}, ${a.file}): ${a.inBranch ? 'in this branch, not yet approved' : 'a draft'}`));
  if (idle.length) {
    const shown = idle.slice(0, 8).map(s => s.story);
    lines.push('', `Not started (${idle.length} ${idle.length === 1 ? 'story' : 'stories'} with no ${STAGE_WORDS[idle[0].stage].replace(/^the /, '')} yet): ${shown.join(', ')}${idle.length > shown.length ? `, and ${idle.length - shown.length} more` : ''}. Start one only when asked to.`);
  }
  if (!steps.length) lines.push('', 'No stories yet: the product brief (concept, requirements, personas, epics) comes first.');
  if (done) lines.push('', `Done: ${done} feature${done === 1 ? '' : 's'} with an approved tutorial.`);
  if (lines.length <= NEXT_MAX_LINES) return lines.join('\n');
  const kept = lines.slice(0, NEXT_MAX_LINES - 1);
  return [...kept, `... and ${lines.length - kept.length} more lines (node .rfr/checks/process-next.mjs lists everything)`].join('\n');
}

function gitOut(root, args) {
  const r = spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout : null;
}

// The remote default branch as a ref, or null when the repository has none to read.
export function defaultBranchRef(root) {
  const head = gitOut(root, ['symbolic-ref', '-q', '--short', 'refs/remotes/origin/HEAD']);
  if (head?.trim()) return head.trim();
  for (const ref of ['origin/main', 'origin/master']) if (gitOut(root, ['rev-parse', '--verify', '-q', ref]) !== null) return ref;
  return null;
}

// The files under docs/ that differ from a ref, or that git does not track yet: what this branch
// has that the ref does not. Two git calls, whatever the number of artifacts.
export function changedSince(root, ref) {
  const lines = out => (out ?? '').split('\n').map(l => l.trim()).filter(Boolean);
  return new Set([
    ...lines(gitOut(root, ['diff', '--name-only', ref, '--', 'docs'])),
    ...lines(gitOut(root, ['ls-files', '--others', '--exclude-standard', '--', 'docs'])),
  ]);
}

// The state for a project, or null when it has no process.yml (AC-2). Approval is read from the
// remote default branch: an artifact that is new or changed in the working tree is in this branch.
export function processNext(root) {
  const loaded = readConfig(root);
  if (!loaded) return null;
  const work = loadArtifacts(workingTree(root)).artifacts;
  const ref = defaultBranchRef(root);
  let artifacts = work;
  let note = null;
  if (ref) {
    const changed = changedSince(root, ref);
    artifacts = work.map(a => (changed.has(a.file) ? { ...a, inBranch: true } : a));
  } else {
    note = 'There is no remote default branch to read, so this is the working tree: an artifact marked approved here may not have been reviewed.';
  }
  const steps = featureSteps(artifacts, loaded.config ?? {});
  const product = artifacts.filter(a => ['concept', 'discovery', 'requirements', 'personas', 'epics'].includes(a.stage) && !approvedNow(a));
  return { steps, product, text: renderNext({ steps, product, note }) };
}
