// Tests for checking the names a user manual uses against its design (docs/specs/project-process.md,
// AC-30). Moved unchanged from the pilot-round files (rewrite plan 25e). Each test title cites the
// criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-names-'));
  for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); }
  return root;
}
const art = (id, links, body, status = 'approved') =>
  `---\nid: ${id}\nstatus: ${status}\n${links.length ? `derived-from:\n${links.map(l => `  - ${l}:\n`).join('')}` : ''}---\n\n${body}`;

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

test('project-process#AC-30: the warning says how to resolve it, including removing bold that is only emphasis', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-names-'));
  const files = {
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': art('concept', [], '# Concept\n\n## Audience\n\nReaders.\n'),
    'docs/product/personas/fan.md': art('persona-fan', ['concept#audience'], '# Fan\n\n## Goals\n\nRead.\n'),
    'docs/product/epics/read.md': art('epic-read', ['persona-fan#goals'], '# Reading\n\n## Outcome\n\nFans read.\n'),
    'docs/product/stories/read/first.md': art('story-first', ['epic-read#outcome', 'persona-fan#goals'], '# First\n\nAs a fan, I want to read so that I enjoy it.\n\n## Acceptance criteria\n\n- Pages show.\n'),
    'docs/design/reader.md': art('design-reader', ['story-first'], '# Reader\n\nThe toolbar has **Next page**.\n'),
    'docs/user/reading.md': art('docs-reading', ['design-reader'], '# Reading\n\n**Tap or click** the page, then select **Next page**.\n', 'draft'),
  };
  for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); }
  relink(root, ['persona-fan', 'epic-read', 'story-first', 'design-reader', 'docs-reading']);
  const warning = runProcessTrace(root).warnings.find(w => /Tap or click/.test(w));
  assert.ok(warning, 'a warning for the bold phrase');
  assert.match(warning, /design's name/);
  assert.match(warning, /add it to the design/);
  assert.match(warning, /not a (control )?name.*(remove|drop|unbold)|(remove|drop|unbold).*not a (control )?name|emphasis/i);
});
