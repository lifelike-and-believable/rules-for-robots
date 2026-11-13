// Tests that an approved tutorial ships with approved user documentation that links to it
// (docs/specs/lasting-tutorials.md, AC-9). Each test title cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runProcessTrace } from '../checks/process-trace.mjs';

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-tutorial-linked-'));
  for (const [file, text] of Object.entries({ 'docs/product/process.yml': 'default: [lead]\nwaived:\n  stories: x\n  design: x\n  specs: x\n', ...files })) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

const concept = '---\nid: concept\nstatus: approved\n---\n\n# Concept\n';
const doc = (status, link) => `---\nid: docs-export\nstatus: ${status}\nderived-from:\n  - concept:\n---\n\n# Export\n\n## Export a clip\n\n1. Click **Export**.\n\n${link}\n`;
const tutorial = status => `---\nid: tutorial-export\nstatus: ${status}\nrunner: manual\nderived-from:\n  - docs-export:\n---\n\n# Tutorial: export a clip\n\n## Steps\n\n1. Click **Export**.\n`;

const unlinkedProblems = root => runProcessTrace(root).errors.filter(e => /tutorial-export.*links to docs\/tutorials\/export\.md|no approved user documentation links/.test(e));

test('lasting-tutorials#AC-9: an approved tutorial that approved user documentation links to passes', () => {
  const root = project({
    'docs/product/concept.md': concept,
    'docs/user/export.md': doc('approved', 'Try it: [Export a clip](../tutorials/export.md)'),
    'docs/tutorials/export.md': tutorial('approved'),
  });
  assert.deepEqual(unlinkedProblems(root), []);
});

test('lasting-tutorials#AC-9: an approved tutorial that no user documentation links to fails', () => {
  const root = project({
    'docs/product/concept.md': concept,
    'docs/user/export.md': doc('approved', 'No link here.'),
    'docs/tutorials/export.md': tutorial('approved'),
  });
  const found = unlinkedProblems(root);
  assert.equal(found.length, 1, runProcessTrace(root).errors.join('\n'));
  assert.match(found[0], /tutorial-export: no approved user documentation links to docs\/tutorials\/export\.md/);
});

test('lasting-tutorials#AC-9: user documentation that is still a draft does not count as a link', () => {
  const root = project({
    'docs/product/concept.md': concept,
    'docs/user/export.md': doc('draft', 'Try it: [Export a clip](../tutorials/export.md)'),
    'docs/tutorials/export.md': tutorial('approved'),
  });
  assert.equal(unlinkedProblems(root).length, 1);
});

test('lasting-tutorials#AC-9: a link to a different tutorial does not count', () => {
  const root = project({
    'docs/product/concept.md': concept,
    'docs/user/export.md': doc('approved', 'Try it: [Other](../tutorials/other.md)'),
    'docs/tutorials/export.md': tutorial('approved'),
  });
  assert.equal(unlinkedProblems(root).length, 1);
});

test('lasting-tutorials#AC-9: a draft tutorial is not checked for a link', () => {
  const root = project({
    'docs/product/concept.md': concept,
    'docs/user/export.md': doc('approved', 'No link here.'),
    'docs/tutorials/export.md': tutorial('draft'),
  });
  assert.deepEqual(unlinkedProblems(root), []);
});

test('lasting-tutorials#AC-9: the user documentation template has a "Try it" line with a link to a tutorial', () => {
  const text = fs.readFileSync(path.resolve('plugins/process/templates/artifacts/user-doc.md'), 'utf8');
  assert.match(text, /^Try it: \[[^\]]+\]\(\.\.\/tutorials\/[^)]+\.md\)\s*$/m);
});
