// Tests for the second batch of feedback from the Agentic XR Pipeline project (docs/specs/project-process.md,
// "Project findings: Agentic XR Pipeline, round 1"). Each test title cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-xr2-'));
  for (const [f, t] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), t);
  }
  return root;
}

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
