// Tests for the process check (docs/specs/project-process.md): process.yml, artifact links,
// section hashes, staleness, adoption mode, and the status listing.
// Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { hashText, parseProcessConfig, sectionHash, sectionText } from '../checks/lib/process.mjs';
import { processStatus, runProcessTrace } from '../checks/process-trace.mjs';

// ---------------------------------------------------------------------------------------------
// Fixture: a small but complete project, one artifact per stage. Links are "target" or
// "target#section"; the builder records each link's hash from the target's current body.

const CONFIG = 'default: [lead]\n';

function baseDefs() {
  return {
    concept: { path: 'docs/product/concept.md', body: '# Concept\n\nAnimators need batch retargeting.\n' },
    'requirements-animation': {
      path: 'docs/product/requirements/animation.md', links: ['concept'],
      body: '# Animation requirements\n\n## REQ-animation-1: Batch retarget\n\nRetarget many clips at once.\n\n## REQ-animation-2: Preview\n\nPreview before applying.\n',
    },
    'persona-animator': {
      path: 'docs/product/personas/animator.md', links: ['concept'],
      body: '# Animator\n\n## Goals\n\nShip shots fast.\n\n## Frustrations\n\nRepetitive setup.\n',
    },
    'epic-retarget': {
      path: 'docs/product/epics/retarget.md', links: ['requirements-animation#REQ-animation-1', 'persona-animator'],
      body: '# Retargeting\n\nBatch retargeting for animators.\n',
    },
    'story-retarget-batch': {
      path: 'docs/product/stories/retarget/batch.md', links: ['epic-retarget', 'persona-animator#goals'],
      body: '# Batch retarget\n\nAs an animator, I want to retarget a batch of clips so that I ship shots faster.\n',
    },
    'design-retarget': {
      path: 'docs/design/retarget.md', links: ['story-retarget-batch'],
      body: '# Retarget dialog\n\nA dialog lists the selected clips and a target skeleton picker.\n',
    },
    'docs-retarget': {
      path: 'docs/user/retarget.md', links: ['design-retarget', 'story-retarget-batch'],
      body: '# Retargeting\n\n## Retarget a batch\n\nSelect clips, choose a target, and press Retarget.\n',
    },
    'spec-retarget': {
      path: 'docs/specs/retarget.md', links: ['story-retarget-batch', 'docs-retarget#retarget-a-batch'],
      body: '# Retarget spec\n\n## Acceptance criteria\n| # | Criterion | Verified by | Source |\n|---|---|---|---|\n| AC-1 | A batch is retargeted | test: batch | docs-retarget#retarget-a-batch |\n| AC-2 | Logs are written | command: npm run logs | |\n',
    },
  };
}

function render(id, def, defs) {
  const lines = ['---', `id: ${id}`, `status: ${def.status ?? 'approved'}`];
  if (def.withdrawn) lines.push(`withdrawn: ${def.withdrawn}`);
  if (def.links?.length) {
    lines.push('derived-from:');
    for (const link of def.links) {
      const [target, section] = link.split('#');
      const hash = def.hashes?.[link] ?? (defs[target] ? sectionHash(defs[target].body, section) ?? '' : 'deadbeef0000');
      lines.push(`  - ${link}: ${hash}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n') + def.body;
}

function write(root, file, text) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}

// Writes the project. `change` edits the definitions first; `after` edits files afterwards
// (bodies changed there keep their old recorded hashes downstream).
function project({ change, config = CONFIG } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-process-'));
  const defs = baseDefs();
  change?.(defs);
  if (config !== null) write(root, 'docs/product/process.yml', config);
  for (const [id, def] of Object.entries(defs)) write(root, def.path, render(id, def, defs));
  return { root, defs };
}

function editBody(root, defs, id, edit) {
  const def = defs[id];
  const file = path.join(root, def.path);
  const text = fs.readFileSync(file, 'utf8');
  const split = text.indexOf('\n---\n', 4) + 5;
  fs.writeFileSync(file, text.slice(0, split) + edit(text.slice(split)));
}

const errorsOf = (root, opts) => runProcessTrace(root, opts).errors.join('\n');

// ---------------------------------------------------------------------------------------------
// process.yml

test('project-process#AC-8: a valid process.yml parses, with comments, inline and block lists', () => {
  const { config, errors } = parseProcessConfig([
    '# approvers',
    'mode: team',
    'default: [lead, "@org/leads"]',
    'stages:',
    '  personas: [ux-lead]',
    '  user-docs:',
    '    - docs-lead',
    '    - lead',
    'public-api: [src/api/**, Source/MyPlugin/Public/**]  # paths',
    'adoption-until: 2026-12-31',
    '',
  ].join('\n'));
  assert.deepEqual(errors, []);
  assert.equal(config.mode, 'team');
  assert.deepEqual(config.default, ['lead', '@org/leads']);
  assert.deepEqual(config.stages, { personas: ['ux-lead'], 'user-docs': ['docs-lead', 'lead'] });
  assert.deepEqual(config.publicApi, ['src/api/**', 'Source/MyPlugin/Public/**']);
  assert.equal(config.adoptionUntil, '2026-12-31');
});

test('project-process#AC-8: mode defaults to team, and solo is accepted', () => {
  assert.equal(parseProcessConfig('default: [lead]\n').config.mode, 'team');
  const solo = parseProcessConfig('mode: solo\ndefault: [lead]\n');
  assert.deepEqual(solo.errors, []);
  assert.equal(solo.config.mode, 'solo');
});

test('project-process#AC-8: a missing or empty default is an error', () => {
  assert.match(parseProcessConfig('stages:\n  personas: [ux-lead]\n').errors.join('\n'), /default/);
  assert.match(parseProcessConfig('default: []\n').errors.join('\n'), /default/);
});

test('project-process#AC-8: unknown stages, unknown keys, a bad mode, and a bad date are errors', () => {
  assert.match(parseProcessConfig('default: [lead]\nstages:\n  implementation: [lead]\n').errors.join('\n'), /implementation/);
  assert.match(parseProcessConfig('default: [lead]\nreviewers: [lead]\n').errors.join('\n'), /reviewers/);
  assert.match(parseProcessConfig('mode: duo\ndefault: [lead]\n').errors.join('\n'), /mode/);
  assert.match(parseProcessConfig('default: [lead]\nadoption-until: 2026-02-30\n').errors.join('\n'), /adoption-until/);
  assert.match(parseProcessConfig('default: [lead]\nadoption-until: soon\n').errors.join('\n'), /adoption-until/);
});

test('project-process#AC-8: the check fails when artifacts exist without process.yml, and its errors are reported', () => {
  const missing = project({ config: null });
  assert.match(errorsOf(missing.root), /process\.yml/);
  const bad = project({ config: 'mode: duo\ndefault: [lead]\n' });
  assert.match(errorsOf(bad.root), /mode/);
});

test('project-process#AC-8: a project with no process artifacts and no process.yml passes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-process-empty-'));
  write(root, 'docs/specs/plain.md', '---\nstatus: draft\n---\n\n# A plain Phase 10 spec\n');
  const r = runProcessTrace(root);
  assert.deepEqual(r.errors, []);
  assert.equal(r.checked, 0);
});

// ---------------------------------------------------------------------------------------------
// Link rules (AC-2)

test('project-process#AC-2: a complete, current project passes', () => {
  const { root } = project();
  const r = runProcessTrace(root);
  assert.deepEqual(r.errors, []);
  assert.equal(r.checked, 8);
});

test('project-process#AC-2: missing id or status, an unknown status, and implemented outside specs are errors', () => {
  const noId = project();
  write(noId.root, 'docs/design/extra.md', '---\nstatus: draft\n---\n\n# Extra\n');
  assert.match(errorsOf(noId.root), /docs\/design\/extra\.md.*id/);

  const badStatus = project({ change: d => { d['design-retarget'].status = 'in-review'; } });
  assert.match(errorsOf(badStatus.root), /design-retarget.*in-review/);

  const implemented = project({ change: d => { d['design-retarget'].status = 'implemented'; } });
  assert.match(errorsOf(implemented.root), /design-retarget.*implemented/);
  const specImplemented = project({ change: d => { d['spec-retarget'].status = 'implemented'; } });
  assert.deepEqual(runProcessTrace(specImplemented.root).errors, []);
});

test('project-process#AC-2: a spec in docs/specs without an id is not a process artifact', () => {
  const { root } = project();
  write(root, 'docs/specs/plain.md', '---\nstatus: approved\n---\n\n# A plain Phase 10 spec\n');
  assert.deepEqual(runProcessTrace(root).errors, []);
});

test('project-process#AC-2: rule 1, a duplicate id or a link to a missing id or section, fails', () => {
  const dup = project();
  write(dup.root, 'docs/design/copy.md', '---\nid: design-retarget\nstatus: draft\n---\n\n# Copy\n');
  assert.match(errorsOf(dup.root), /duplicate id.*design-retarget/i);

  const unknownId = project({ change: d => { d['design-retarget'].links.push('story-missing'); } });
  assert.match(errorsOf(unknownId.root), /design-retarget.*story-missing/);

  const unknownSection = project({ change: d => { d['epic-retarget'].links.push('requirements-animation#REQ-animation-9'); } });
  assert.match(errorsOf(unknownSection.root), /epic-retarget.*REQ-animation-9/);
});

test('project-process#AC-2: rule 2, a cycle of links, fails', () => {
  const { root } = project({ change: d => { d['design-retarget'].links.push('docs-retarget'); } });
  assert.match(errorsOf(root), /cycle/i);
});

test('project-process#AC-2: rule 3, an approved artifact linking to a draft or withdrawn one, fails', () => {
  const draft = project({ change: d => { d['epic-retarget'].status = 'draft'; } });
  assert.match(errorsOf(draft.root), /story-retarget-batch.*epic-retarget.*draft/);

  const withdrawn = project({ change: d => { Object.assign(d['design-retarget'], { status: 'draft', withdrawn: 'flow changed (#12)' }); } });
  assert.match(errorsOf(withdrawn.root), /docs-retarget.*design-retarget.*draft/);

  const bothDraft = project({ change: d => { d['design-retarget'].status = 'draft'; d['docs-retarget'].status = 'draft'; d['spec-retarget'].links = ['story-retarget-batch']; d['spec-retarget'].body = d['spec-retarget'].body.replace('docs-retarget#retarget-a-batch |', 'story-retarget-batch |'); } });
  assert.deepEqual(runProcessTrace(bothDraft.root).errors, []);
});

test('project-process#AC-2: rule 4, a stale link, fails and passes again once the hash is re-recorded', () => {
  const { root, defs } = project();
  editBody(root, defs, 'requirements-animation', b => b.replace('Retarget many clips at once.', 'Retarget up to 500 clips at once.'));
  assert.match(errorsOf(root), /epic-retarget.*stale.*requirements-animation#REQ-animation-1/);

  const rerecorded = project({ change: d => { d['requirements-animation'].body = d['requirements-animation'].body.replace('Retarget many clips at once.', 'Retarget up to 500 clips at once.'); } });
  assert.deepEqual(runProcessTrace(rerecorded.root).errors, []);
});

test('project-process#AC-2: rule 4, an approved link with no recorded hash, fails', () => {
  const { root } = project({ change: d => { d['design-retarget'].hashes = { 'story-retarget-batch': '' }; } });
  assert.match(errorsOf(root), /design-retarget.*story-retarget-batch.*hash/);
});

test('project-process#AC-2: staleness is section-level and direct only', () => {
  const other = project();
  editBody(other.root, other.defs, 'requirements-animation', b => b.replace('Preview before applying.', 'Preview every clip before applying.'));
  assert.deepEqual(runProcessTrace(other.root).errors, [], 'a change to a section nobody links to flags nothing');

  const direct = project();
  editBody(direct.root, direct.defs, 'persona-animator', b => b.replace('Ship shots fast.', 'Ship shots fast and on budget.'));
  const errors = runProcessTrace(direct.root).errors;
  assert.equal(errors.length, 2, errors.join('\n'));
  assert.match(errors.join('\n'), /story-retarget-batch.*persona-animator#goals/, 'the story links the changed section');
  assert.match(errors.join('\n'), /epic-retarget.*persona-animator\b(?!#)/, 'the epic links the whole persona');
  assert.doesNotMatch(errors.join('\n'), /design-retarget|docs-retarget|spec-retarget/, 'the story did not change, so nothing below it is stale');
});

test('project-process#AC-2: renaming a file keeps its links, because ids are stable', () => {
  const { root, defs } = project();
  const from = path.join(root, defs['docs-retarget'].path);
  const to = path.join(root, 'docs/user/guide/retargeting.md');
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  assert.deepEqual(runProcessTrace(root).errors, []);
});

test('project-process#AC-2: links are many-to-many', () => {
  const { root } = project({
    change: d => {
      d['story-retarget-preview'] = { path: 'docs/product/stories/retarget/preview.md', links: ['epic-retarget', 'persona-animator'], body: '# Preview\n\nAs an animator, I want a preview.\n' };
      d['design-retarget'].links.push('story-retarget-preview');
      d['docs-retarget'].links.push('story-retarget-preview');
    },
  });
  assert.deepEqual(runProcessTrace(root).errors, []);
});

test('project-process#AC-2: rule 5, a story with no persona or an unapproved persona, fails even as a draft', () => {
  const none = project({ change: d => { d['story-retarget-batch'].links = ['epic-retarget']; } });
  assert.match(errorsOf(none.root), /story-retarget-batch.*persona/);

  const draftPersona = project({
    change: d => {
      d['persona-rigger'] = { path: 'docs/product/personas/rigger.md', status: 'draft', links: ['concept'], body: '# Rigger\n' };
      d['story-retarget-rig'] = { path: 'docs/product/stories/retarget/rig.md', status: 'draft', links: ['epic-retarget', 'persona-rigger'], body: '# Rig\n' };
    },
  });
  assert.match(errorsOf(draftPersona.root), /story-retarget-rig.*persona-rigger.*approved/);
});

test('project-process#AC-2: rule 6, a spec test: criterion without an approved story or docs source, fails', () => {
  const noSource = project({ change: d => { d['spec-retarget'].body = d['spec-retarget'].body.replace('| docs-retarget#retarget-a-batch |', '| |'); } });
  assert.match(errorsOf(noSource.root), /spec-retarget#AC-1.*source/i);

  const wrongStage = project({
    change: d => {
      d['spec-retarget'].links.push('concept');
      d['spec-retarget'].body = d['spec-retarget'].body.replace('| docs-retarget#retarget-a-batch |', '| concept |');
    },
  });
  assert.match(errorsOf(wrongStage.root), /spec-retarget#AC-1.*source/i);

  const notLinked = project({ change: d => { d['spec-retarget'].links = ['story-retarget-batch']; } });
  assert.match(errorsOf(notLinked.root), /spec-retarget#AC-1.*docs-retarget#retarget-a-batch/);
});

function git(root, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'core.autocrlf=false', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

function committed() {
  const p = project();
  git(p.root, 'init', '-q', '-b', 'main');
  git(p.root, 'add', '-A');
  git(p.root, 'commit', '-q', '-m', 'base');
  return p;
}

function setFront(root, defs, id, edit) {
  const file = path.join(root, defs[id].path);
  fs.writeFileSync(file, edit(fs.readFileSync(file, 'utf8')));
}

test('project-process#AC-2: rule 7, withdrawing an approved artifact needs a withdrawn reason and issue', () => {
  const bare = committed();
  setFront(bare.root, bare.defs, 'spec-retarget', t => t.replace('status: approved', 'status: draft'));
  assert.match(errorsOf(bare.root, { base: 'main' }), /spec-retarget.*withdrawn/);

  const noIssue = committed();
  setFront(noIssue.root, noIssue.defs, 'spec-retarget', t => t.replace('status: approved', 'status: draft\nwithdrawn: the flow changed'));
  assert.match(errorsOf(noIssue.root, { base: 'main' }), /spec-retarget.*withdrawn.*issue/);

  const ok = committed();
  setFront(ok.root, ok.defs, 'spec-retarget', t => t.replace('status: approved', 'status: draft\nwithdrawn: the flow changed (#12)'));
  assert.deepEqual(runProcessTrace(ok.root, { base: 'main' }).errors, []);
});

test('project-process#AC-2: rule 7 is skipped without a base, and an unknown base is an error', () => {
  const p = committed();
  setFront(p.root, p.defs, 'spec-retarget', t => t.replace('status: approved', 'status: draft'));
  assert.deepEqual(runProcessTrace(p.root).errors, []);
  assert.match(errorsOf(p.root, { base: 'no-such-ref' }), /no-such-ref/);
});

// ---------------------------------------------------------------------------------------------
// Hashes (AC-3)

const DOC = [
  '# Requirements',
  '',
  '## REQ-a-1: First',
  '',
  'One line.',
  '',
  '### Detail',
  '',
  'Nested under the first.',
  '',
  '## Second heading',
  '',
  '| ID | Text |',
  '|---|---|',
  '| REQ-a-2 | A table row |',
  '',
  '- REQ-a-3: A list item',
  '  that continues here.',
  '- REQ-a-4: Another item',
  '',
].join('\n');

test('project-process#AC-3: sections are found by heading ID, heading slug, table row, and list item', () => {
  assert.match(sectionText(DOC, 'REQ-a-1'), /One line\.[\s\S]*Nested under the first\./);
  assert.doesNotMatch(sectionText(DOC, 'REQ-a-1'), /Second heading/);
  assert.match(sectionText(DOC, 'second-heading'), /REQ-a-2/);
  assert.match(sectionText(DOC, 'REQ-a-2'), /A table row/);
  assert.doesNotMatch(sectionText(DOC, 'REQ-a-2'), /ID \| Text/);
  assert.match(sectionText(DOC, 'REQ-a-3'), /that continues here/);
  assert.doesNotMatch(sectionText(DOC, 'REQ-a-3'), /Another item/);
  assert.equal(sectionText(DOC, 'REQ-a-9'), null);
  assert.equal(sectionHash(DOC, 'REQ-a-9'), null);
});

test('project-process#AC-3: a whole-body link hashes the body, and hashes are 12 hex characters', () => {
  assert.match(sectionHash(DOC), /^[0-9a-f]{12}$/);
  assert.equal(sectionHash(DOC), hashText(DOC));
});

test('project-process#AC-3: whitespace-only edits do not change a hash; text edits do', () => {
  const spaced = DOC.replace('One line.', 'One   line.\n\n').replace('## Second heading', '##   Second heading');
  assert.equal(sectionHash(spaced, 'REQ-a-1'), sectionHash(DOC, 'REQ-a-1'));
  assert.equal(sectionHash(spaced), sectionHash(DOC));
  assert.notEqual(sectionHash(DOC.replace('One line.', 'Two lines.'), 'REQ-a-1'), sectionHash(DOC, 'REQ-a-1'));
});

test('project-process#AC-3: front matter edits, including recorded hashes, leave the file\'s own hash unchanged', () => {
  const { root, defs } = project();
  setFront(root, defs, 'story-retarget-batch', t => t.replace(/epic-retarget: [0-9a-f]+/, 'epic-retarget: 000000000000\n  - concept: 111111111111'));
  const errors = runProcessTrace(root).errors.join('\n');
  assert.doesNotMatch(errors, /design-retarget|docs-retarget|spec-retarget/, 'nothing downstream of the story is stale');
  assert.match(errors, /story-retarget-batch.*epic-retarget/, 'the story itself now records a wrong hash');
});

// ---------------------------------------------------------------------------------------------
// Adoption mode (AC-15)

const ADOPTING = 'default: [lead]\nadoption-until: 2026-12-31\n';

test('project-process#AC-15: before adoption-until, artifacts without links produce warnings only', () => {
  const { root } = project({ config: ADOPTING, change: d => { d['story-retarget-batch'].links = []; d['spec-retarget'].links = []; } });
  const r = runProcessTrace(root, { now: new Date('2026-11-15T12:00:00Z') });
  assert.deepEqual(r.errors.filter(e => /story-retarget-batch:|spec-retarget(#AC-1)?:/.test(e)), []);
  assert.match(r.warnings.join('\n'), /story-retarget-batch.*persona/);
  assert.match(r.warnings.join('\n'), /spec-retarget#AC-1/);
});

test('project-process#AC-15: before adoption-until, artifacts with links are checked fully', () => {
  const { root, defs } = project({ config: ADOPTING });
  editBody(root, defs, 'persona-animator', b => b.replace('Ship shots fast.', 'Ship shots on budget.'));
  assert.match(runProcessTrace(root, { now: new Date('2026-11-15T12:00:00Z') }).errors.join('\n'), /story-retarget-batch.*stale/);
});

test('project-process#AC-15: after adoption-until, artifacts without links fail', () => {
  const { root } = project({ config: ADOPTING, change: d => { d['story-retarget-batch'].links = []; } });
  const r = runProcessTrace(root, { now: new Date('2027-01-01T00:00:00Z') });
  assert.match(r.errors.join('\n'), /story-retarget-batch.*persona/);
});

// ---------------------------------------------------------------------------------------------
// Status listing (AC-17)

const rowFor = (rows, id) => rows.find(r => r.id === id);

test('project-process#AC-17: each persona, epic, and story is listed with its stage, status, and how far its work has reached', () => {
  const { root } = project({
    change: d => {
      d['story-retarget-preview'] = { path: 'docs/product/stories/retarget/preview.md', status: 'draft', links: ['epic-retarget', 'persona-animator'], body: '# Preview\n' };
    },
  });
  const rows = processStatus(root);
  assert.deepEqual(rows.map(r => r.id).sort(), ['epic-retarget', 'persona-animator', 'story-retarget-batch', 'story-retarget-preview']);
  assert.deepEqual(rowFor(rows, 'story-retarget-batch'), { id: 'story-retarget-batch', stage: 'stories', status: 'approved', reached: 'specs', attention: [] });
  assert.deepEqual(rowFor(rows, 'story-retarget-preview'), { id: 'story-retarget-preview', stage: 'stories', status: 'draft', reached: null, attention: [] });
  assert.equal(rowFor(rows, 'persona-animator').stage, 'personas');
  assert.equal(rowFor(rows, 'epic-retarget').reached, 'specs');
});

test('project-process#AC-17: stale and withdrawn artifacts downstream are listed under each row they affect', () => {
  const { root, defs } = project({ change: d => { Object.assign(d['design-retarget'], { status: 'draft', withdrawn: 'flow changed (#12)' }); } });
  editBody(root, defs, 'docs-retarget', b => b.replace('press Retarget', 'press Apply'));
  const story = rowFor(processStatus(root), 'story-retarget-batch');
  assert.deepEqual(story.attention, [
    { id: 'design-retarget', problem: 'withdrawn' },
    { id: 'spec-retarget', problem: 'stale' },
  ]);
  assert.equal(story.reached, 'specs');
});
