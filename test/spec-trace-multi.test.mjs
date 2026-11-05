// spec-test-traceability#AC-13: several criteria cited after one spec name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findCitations } from '../checks/lib/spec.mjs';

function cites(line) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-cite-'));
  fs.mkdirSync(path.join(root, 'test'));
  fs.writeFileSync(path.join(root, 'test', 'a.test.js'), `test('${line}', () => {});\n`);
  return findCitations(root, ['test']).map(c => `${c.slug}#${c.id}`).sort();
}

test('spec-test-traceability#AC-13: criteria separated by spaces after one spec name are each cited', () => {
  assert.deepEqual(cites('story-reader-editor#AC-2 AC-8 story checks'), ['story-reader-editor#AC-2', 'story-reader-editor#AC-8']);
});

test('spec-test-traceability#AC-13: commas and "and" separate criteria too', () => {
  assert.deepEqual(cites('unit-converter#AC-2, AC-8 and AC-9: limits'),
    ['unit-converter#AC-2', 'unit-converter#AC-8', 'unit-converter#AC-9']);
});

test('spec-test-traceability#AC-13: a criterion mentioned later in the line, after other words, is not counted', () => {
  assert.deepEqual(cites('unit-converter#AC-1 rounds like AC-3 says'), ['unit-converter#AC-1']);
});
