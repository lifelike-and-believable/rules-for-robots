// Tests for the relink script: it records current section hashes, so a stale link passes again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-relink-'));
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  write('docs/product/process.yml', 'default: [lead]\n');
  write('docs/product/concept.md', '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\nBatch retargeting.\n');
  write('docs/product/personas/animator.md', '---\nid: persona-animator\nstatus: approved\nderived-from:\n  - concept:\n---\n\n# Animator\n\n## Goals\n\nShip shots fast.\n');
  return { root, write };
}

test('relink records hashes for empty and stale links, and the check then passes', () => {
  const { root, write } = project();
  assert.match(runProcessTrace(root).errors.join('\n'), /persona-animator.*concept.*no recorded hash/);
  assert.deepEqual(relink(root, ['persona-animator']).changed, ['persona-animator']);
  assert.deepEqual(runProcessTrace(root).errors, []);

  write('docs/product/concept.md', '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\nBatch retargeting for animators.\n');
  assert.match(runProcessTrace(root).errors.join('\n'), /persona-animator: stale/);
  relink(root, ['persona-animator']);
  assert.deepEqual(runProcessTrace(root).errors, []);
  assert.deepEqual(relink(root, ['persona-animator']).unchanged, ['persona-animator']);
});

test('relink reports unknown ids and links it cannot hash, and leaves the body alone', () => {
  const { root, write } = project();
  write('docs/product/personas/rigger.md', '---\nid: persona-rigger\nstatus: draft\nderived-from:\n  - concept#missing:\n---\n\n# Rigger\n');
  const r = relink(root, ['persona-rigger', 'persona-nobody']);
  assert.match(r.problems.join('\n'), /persona-rigger: cannot hash concept#missing/);
  assert.match(r.problems.join('\n'), /persona-nobody: no such artifact/);
  assert.match(fs.readFileSync(path.join(root, 'docs/product/personas/rigger.md'), 'utf8'), /\n# Rigger\n$/);
});
