// Tests for how the process check reads, records, and checks the links between artifacts
// (docs/specs/project-process.md): draft links without a hash, links written without a colon,
// templates that link to sections, stale links in drafts, suggestions for stale whole-artifact links,
// and links to files that are not artifacts. Moved unchanged from the pilot-round files (rewrite plan
// 25e). Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArtifact } from '../checks/lib/process.mjs';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-links-'));
  for (const [f, t] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), t);
  }
  return root;
}

// ---- AC-28: draft links without a recorded hash -------------------------------------------------

test('project-process#AC-28: draft links without a recorded hash are counted and reported', () => {
  const root = project({
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': '---\nid: concept\nstatus: draft\n---\n\n# Concept\n',
    'docs/product/personas/fan.md': '---\nid: persona-fan\nstatus: draft\nderived-from:\n  - concept:\n---\n\n# Fan\n',
    'docs/product/personas/client.md': '---\nid: persona-client\nstatus: draft\nderived-from:\n  - concept:\n---\n\n# Client\n',
  });
  const r = runProcessTrace(root);
  assert.deepEqual(r.errors, []);
  assert.equal(r.unrecorded, 2);
  const out = spawnSync(process.execPath, [path.resolve('checks/process-trace.mjs'), root], { encoding: 'utf8' });
  assert.equal(out.status, 0);
  assert.match(out.stdout, /2 draft link\(s\) .*not yet recorded/);
  assert.doesNotMatch(out.stdout, /links are current\.$/m);
});

// ---- AC-32: templates link to sections ---------------------------------------------------------

test('project-process#AC-32: no artifact template links to a whole concept, epic, or persona', () => {
  const dir = path.resolve('plugins/process/templates/artifacts');
  const profiles = path.resolve('plugins/process/templates/profiles');
  const files = [
    ...fs.readdirSync(dir).map(f => path.join(dir, f)),
    ...fs.readdirSync(profiles).flatMap(p => fs.readdirSync(path.join(profiles, p), { recursive: true }).filter(f => f.endsWith('.md')).map(f => path.join(profiles, p, f))),
  ];
  const whole = [];
  for (const file of files) {
    for (const link of parseArtifact(fs.readFileSync(file, 'utf8')).links) {
      if (/^(concept|epic-|persona-)/.test(link.target) && !link.section) whole.push(`${path.basename(file)}: ${link.key}`);
    }
  }
  assert.deepEqual(whole, []);
});

// ---- AC-34: links written without a colon --------------------------------------------------------

function storyProject(storyLinks, status = 'approved') {
  const root = project({
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\n## Audience\n\nFans.\n',
    'docs/product/personas/fan.md': '---\nid: persona-fan\nstatus: approved\nderived-from:\n  - concept#audience:\n---\n\n# Fan\n\n## Goals\n\nRead.\n',
    'docs/product/epics/read.md': '---\nid: epic-read\nstatus: approved\nderived-from:\n  - persona-fan#goals:\n---\n\n# Reading\n\n## Outcome\n\nFans read.\n',
    'docs/product/stories/read/first.md': `---\nid: story-first\nstatus: ${status}\nderived-from:\n${storyLinks}---\n\n# First\n\nAs a fan, I want to read so that I enjoy it.\n\n## Acceptance criteria\n\n- Pages show.\n`,
  });
  relink(root, ['persona-fan', 'epic-read']);
  return root;
}

test('project-process#AC-34: an entry without a colon is read as a link with no hash', () => {
  const { links, errors } = parseArtifact('---\nid: story-x\nderived-from:\n  - epic-read#outcome\n  - persona-fan#goals:\n---\n\n# X\n');
  assert.deepEqual(errors, []);
  assert.deepEqual(links.map(l => [l.key, l.hash]), [['epic-read#outcome', ''], ['persona-fan#goals', '']]);
});

test('project-process#AC-34: relink records the hash of a new link written with or without the colon', () => {
  const root = storyProject('  - epic-read#outcome\n  - persona-fan#goals:\n');
  const r = relink(root, ['story-first']);
  assert.deepEqual(r.changed, ['story-first']);
  const { links } = parseArtifact(fs.readFileSync(path.join(root, 'docs/product/stories/read/first.md'), 'utf8'));
  for (const l of links) assert.match(l.hash, /^[0-9a-f]{12}$/, l.key);
  assert.deepEqual(runProcessTrace(root).errors, []);
});

test('project-process#AC-34: the message for an approved link with no hash names the relink command', () => {
  const root = storyProject('  - epic-read#outcome\n  - persona-fan#goals:\n');
  const errors = runProcessTrace(root).errors.filter(e => /no recorded hash/.test(e));
  assert.equal(errors.length, 2, runProcessTrace(root).errors.join('\n'));
  for (const e of errors) assert.match(e, /process-relink\.mjs story-first/);
});

// ---- AC-35: stale links in drafts ---------------------------------------------------------------

function designProject(designStatus) {
  const root = project({
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\n## Audience\n\nFans.\n',
    'docs/product/personas/fan.md': '---\nid: persona-fan\nstatus: approved\nderived-from:\n  - concept#audience:\n---\n\n# Fan\n\n## Goals\n\nRead.\n',
    'docs/product/epics/read.md': '---\nid: epic-read\nstatus: approved\nderived-from:\n  - persona-fan#goals:\n---\n\n# Reading\n\n## Outcome\n\nFans read.\n',
    'docs/product/stories/read/first.md': '---\nid: story-first\nstatus: approved\nderived-from:\n  - epic-read#outcome:\n  - persona-fan#goals:\n---\n\n# First\n\nAs a fan, I want to read so that I enjoy it.\n\n## Acceptance criteria\n\n- Pages show.\n',
    'docs/design/reader.md': `---\nid: design-reader\nstatus: ${designStatus}\nderived-from:\n  - story-first:\n---\n\n# Reader\n\nA page.\n`,
  });
  relink(root, ['persona-fan', 'epic-read', 'story-first']);
  return root;
}

test('project-process#AC-35: a draft whose recorded hash is out of date gets a warning, not an error', () => {
  const root = designProject('draft');
  relink(root, ['design-reader']);
  const story = path.join(root, 'docs/product/stories/read/first.md');
  fs.writeFileSync(story, fs.readFileSync(story, 'utf8').replace('- Pages show.', '- Pages show in order.'));
  relink(root, ['story-first']);
  const r = runProcessTrace(root);
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings.join('\n'), /design-reader.*story-first.*changed since it was recorded/);
});

test('project-process#AC-35: a draft with no recorded hash gets no stale warning', () => {
  const r = runProcessTrace(designProject('draft'));
  assert.doesNotMatch(r.warnings.join('\n'), /design-reader.*changed since/);
});

// ---- AC-38: stale whole-artifact links suggest sections ------------------------------------------

function staleDesignErrors(link) {
  const root = project({
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\n## Audience\n\nFans.\n',
    'docs/product/personas/fan.md': '---\nid: persona-fan\nstatus: approved\nderived-from:\n  - concept#audience:\n---\n\n# Fan\n\n## Goals\n\nRead.\n',
    'docs/product/epics/read.md': '---\nid: epic-read\nstatus: approved\nderived-from:\n  - persona-fan#goals:\n---\n\n# Reading\n\n## Outcome\n\nFans read.\n',
    'docs/product/stories/read/first.md': '---\nid: story-first\nstatus: approved\nderived-from:\n  - epic-read#outcome:\n  - persona-fan#goals:\n---\n\n# First\n\nAs a fan, I want to read so that I enjoy it.\n\n## Acceptance criteria\n\n- Pages show.\n',
    'docs/design/reader.md': '---\nid: design-reader\nstatus: approved\nderived-from:\n  - story-first:\n---\n\n# Reader\n\n## Flow\n\nTurn pages.\n\n## Deleting a comic\n\nNot yet.\n',
    'docs/user/reading.md': `---\nid: docs-reading\nstatus: approved\nderived-from:\n  - ${link}:\n---\n\n# Reading\n\nTurn pages.\n`,
  });
  relink(root, ['persona-fan', 'epic-read', 'story-first', 'design-reader', 'docs-reading']);
  const design = path.join(root, 'docs/design/reader.md');
  fs.writeFileSync(design, fs.readFileSync(design, 'utf8').replace('Not yet.', 'Select **Delete**, then confirm.'));
  relink(root, ['design-reader']);
  return runProcessTrace(root).errors.join('\n');
}

test('project-process#AC-38: a stale whole-artifact link lists the sections to link instead', () => {
  const errors = staleDesignErrors('design-reader');
  assert.match(errors, /docs-reading: stale: design-reader/);
  assert.match(errors, /design-reader#flow/);
  assert.match(errors, /design-reader#deleting-a-comic/);
});

test('project-process#AC-38: a section link is not stale when another section changes, and gets no suggestion', () => {
  const errors = staleDesignErrors('design-reader#flow');
  assert.doesNotMatch(errors, /docs-reading/);
});

// ---- AC-43: links to files that are not artifacts -----------------------------------------------

const CONCEPT = '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\n## Audience\n\nPerformers.\n\n## Vision\n\nLive shows.\n';

const REQ = body => `---\nid: requirements-workflow\nstatus: approved\nderived-from:\n  - concept#vision:\n---\n\n# Workflow requirements\n\n## REQ-workflow-2: Gates\n\n${body}\n`;

function linkProject(body, status = 'approved') {
  const root = project({
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': CONCEPT,
    'docs/product/notes.md': '# Notes\n\nGate list: a, b, c.\n',
    'docs/product/requirements/workflow.md': REQ(body).replace('status: approved', `status: ${status}`),
  });
  relink(root, ['requirements-workflow']);
  return runProcessTrace(root, {});
}

test('project-process#AC-43: an approved requirement that links a plain notes file is warned about', () => {
  const r = linkProject('Each gate in the [gate list](../notes.md#gates) is checked.');
  assert.deepEqual(r.errors, []);
  const w = r.warnings.filter(x => /requirements-workflow/.test(x) && /notes\.md/.test(x));
  assert.equal(w.length, 1, r.warnings.join('\n'));
  assert.match(w[0], /not a process artifact/);
});

test('project-process#AC-43: links to artifacts, web addresses, comments, code, and drafts are not reported', () => {
  for (const [body, status] of [
    ['See the [concept](../concept.md#vision).', 'approved'],
    ['See [the vendor docs](https://example.com/notes.md).', 'approved'],
    ['<!-- see [gate list](../notes.md) -->\nGates are a, b, and c.', 'approved'],
    ['Write `[gate list](../notes.md)` to link it.', 'approved'],
    ['Each gate in the [gate list](../notes.md) is checked.', 'draft'],
  ]) {
    const r = linkProject(body, status);
    assert.deepEqual(r.warnings.filter(x => /notes\.md/.test(x)), [], `${status}: ${body}`);
  }
});
