// Tests for the second round of fixes from the Kettlebird pilot (docs/specs/project-process.md,
// "Pilot findings: round 2"). Each test title cites the criterion it covers (project-process#AC-n).
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-round2-'));
  for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); }
  return root;
}
const art = (id, links, body, status = 'approved') =>
  `---\nid: ${id}\nstatus: ${status}\n${links.length ? `derived-from:\n${links.map(l => `  - ${l}:\n`).join('')}` : ''}---\n\n${body}`;

// ---- AC-29: persona matching ----------------------------------------------------------------

function storyProject(role) {
  const root = project({
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': art('concept', [], '# Concept\n\n## Audience\n\nReaders.\n'),
    'docs/product/personas/fan.md': art('persona-fan', ['concept#audience'], '# Fan and reader\n\n## Goals\n\nRead comics.\n'),
    'docs/product/personas/star.md': art('persona-star', ['concept#audience'], '# Star, the artist and site editor\n\n## Goals\n\nPublish.\n'),
    'docs/product/personas/animator.md': art('persona-animator', ['concept#audience'], '# Animator\n\n## Goals\n\nShip.\n'),
    'docs/product/epics/read.md': art('epic-read', ['persona-fan#goals'], '# Reading\n\n## Outcome\n\nFans read.\n'),
    'docs/product/stories/read/first.md': art('story-first', ['epic-read#outcome', 'persona-fan#goals', 'persona-star#goals', 'persona-animator#goals'],
      `# First page\n\nAs ${role}, I want to open a comic so that I can start reading.\n\n## Acceptance criteria\n\n- The first page shows.\n`),
  });
  relink(root, ['persona-fan', 'persona-star', 'persona-animator', 'epic-read', 'story-first']);
  return runProcessTrace(root).errors.join('\n');
}

test('project-process#AC-29: a role matches by id, short name, title, the start of the title, or a whole name inside the role', () => {
  for (const role of ['a fan', 'the Fan and reader', 'persona-fan', 'Star', 'a busy animator', 'an animator']) {
    assert.doesNotMatch(storyProject(role), /story-first/, role);
  }
});

test('project-process#AC-29: a word from the middle of a title, or part of a word, does not match', () => {
  for (const role of ['a reader', 'an editor', 'a fa', 'an anim']) {
    assert.match(storyProject(role), /story-first.*role/, role);
  }
});

// ---- AC-30: names in the manual and the design -----------------------------------------------

function docsProject({ docLinks = ['design-reader', 'story-first'], docBody }) {
  const root = project({
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': art('concept', [], '# Concept\n\n## Audience\n\nReaders.\n'),
    'docs/product/personas/fan.md': art('persona-fan', ['concept#audience'], '# Fan\n\n## Goals\n\nRead.\n'),
    'docs/product/epics/read.md': art('epic-read', ['persona-fan#goals'], '# Reading\n\n## Outcome\n\nFans read.\n'),
    'docs/product/stories/read/first.md': art('story-first', ['epic-read#outcome', 'persona-fan#goals'], '# First\n\nAs a fan, I want to read so that I enjoy it.\n\n## Acceptance criteria\n\n- Pages show.\n'),
    'docs/design/reader.md': art('design-reader', ['story-first'], '# Reader\n\nThe toolbar has **Next page** and a Previous page button.\n'),
    'docs/user/reading.md': art('docs-reading', docLinks, docBody, 'draft'),
  });
  relink(root, ['persona-fan', 'epic-read', 'story-first', 'design-reader', 'docs-reading']);
  return runProcessTrace(root);
}

test('project-process#AC-30: a bold name the linked design defines raises no warning, bold or plain in the design', () => {
  const r = docsProject({ docBody: '# Reading\n\n1. Select **Next page**.\n2. Select **Previous page**.\n' });
  assert.deepEqual(r.warnings.filter(w => /docs-reading/.test(w)), []);
  assert.deepEqual(r.errors, []);
});

test('project-process#AC-30: a bold name no linked design defines is a warning, never an error', () => {
  const r = docsProject({ docBody: '# Reading\n\n1. Select **Next page**.\n2. Select **Bookmark**.\n' });
  assert.match(r.warnings.join('\n'), /docs-reading.*\*\*Bookmark\*\*.*design-reader/);
  assert.doesNotMatch(r.warnings.join('\n'), /Next page/);
  assert.deepEqual(r.errors, []);
});

test('project-process#AC-30: designs reached through a linked story count', () => {
  const r = docsProject({ docLinks: ['story-first'], docBody: '# Reading\n\nSelect **Next page**, then **Bookmark**.\n' });
  assert.doesNotMatch(r.warnings.join('\n'), /Next page/);
  assert.match(r.warnings.join('\n'), /Bookmark/);
});

test('project-process#AC-30: a page that reaches no design is not checked for names', () => {
  const r = docsProject({ docLinks: ['persona-fan#goals'], docBody: '# Reading\n\nSelect **Bookmark**.\n' });
  assert.doesNotMatch(r.warnings.join('\n'), /Bookmark/);
});

// ---- AC-31: which rules-for-robots ran --------------------------------------------------------

test('project-process#AC-31: the process check prints the rules-for-robots commit it ran from', () => {
  const head = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const root = project({ 'README.md': '# x\n' });
  const out = spawnSync(process.execPath, [path.resolve('checks/process-trace.mjs'), root], { encoding: 'utf8' });
  assert.equal(out.status, 0);
  assert.match(out.stdout, new RegExp(`rules-for-robots ${head}`));
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
