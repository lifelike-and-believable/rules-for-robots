// Tests for the first round of fixes from the Kettlebird pilot (docs/specs/project-process.md,
// "Pilot findings: round 1"). Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runProcessTrace } from '../checks/process-trace.mjs';

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-pilot-'));
  for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); }
  return root;
}

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
