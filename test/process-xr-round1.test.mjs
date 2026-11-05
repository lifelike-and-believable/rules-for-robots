// Tests for the first round of feedback from the Agentic XR Pipeline project (docs/specs/project-process.md,
// "Project findings: Agentic XR Pipeline, round 1"). Each test title cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';
import { STAGE_ORDER, parseProcessConfig, stageOf } from '../checks/lib/process.mjs';

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-xr1-'));
  for (const [f, t] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), t);
  }
  return root;
}

const CONCEPT = '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\n## Audience\n\nPerformers.\n\n## Vision\n\nLive shows.\n';

test('project-process#AC-41: discovery files are a stage between the concept and the requirements', () => {
  assert.equal(stageOf('docs/product/discovery/use-cases.md'), 'discovery');
  const i = STAGE_ORDER.indexOf('discovery');
  assert.ok(i > STAGE_ORDER.indexOf('concept') && i < STAGE_ORDER.indexOf('requirements'), STAGE_ORDER.join(','));
});

test('project-process#AC-41: process.yml accepts a discovery approver', () => {
  const { config, errors } = parseProcessConfig('default: [lead]\nstages:\n  discovery: [analyst]\n');
  assert.deepEqual(errors, []);
  assert.deepEqual(config.stages.discovery, ['analyst']);
});

test('project-process#AC-41: requirements can link to an approved discovery section', () => {
  const root = project({
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': CONCEPT,
    'docs/product/discovery/use-cases.md': '---\nid: discovery-use-cases\nstatus: approved\nderived-from:\n  - concept#vision:\n---\n\n# Use cases\n\n## UC-1: Rehearsal\n\nA performer rehearses with the pipeline.\n',
    'docs/product/requirements/show.md': '---\nid: requirements-show\nstatus: approved\nderived-from:\n  - discovery-use-cases#uc-1-rehearsal:\n---\n\n# Show requirements\n\n## REQ-show-1: Rehearse\n\nA rehearsal can run without an audience.\n',
  });
  relink(root, ['discovery-use-cases', 'requirements-show']);
  const r = runProcessTrace(root, {});
  assert.deepEqual(r.errors, []);
  assert.equal(r.checked, 3);
});

const MARKED = `# Show requirements

## REQ-show-1: Spend limit

A show stops taking paid requests at the spend limit. [proposed]

## Success measures

- [open] Audience size target, to be set by the approver after the first rehearsal.
- Latency under 200 ms. [assumed]

<!-- Markers: [open], [assumed], [proposed]. -->

\`\`\`
[open] inside a code block
\`\`\`

Inline \`[proposed]\` is code, not a marker.
`;

test('project-process#AC-42: markers in a draft are listed with their line; comments and code are ignored', () => {
  const root = project({
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': CONCEPT,
    'docs/product/requirements/show.md': `---\nid: requirements-show\nstatus: draft\nderived-from:\n  - concept#vision:\n---\n\n${MARKED}`,
  });
  const r = runProcessTrace(root, {});
  assert.deepEqual(r.errors, []);
  const items = (r.openItems ?? []).filter(o => o.id === 'requirements-show');
  assert.deepEqual(items.map(o => o.marker).sort(), ['[assumed]', '[open]', '[proposed]']);
  for (const o of items) assert.ok(Number.isInteger(o.line) && o.line > 6, JSON.stringify(o));
  assert.ok(items.some(o => /Audience size target/.test(o.text)));
  assert.equal(r.warnings.filter(w => /\[(open|assumed|proposed)\]/.test(w)).length, 0, r.warnings.join('\n'));
});

test('project-process#AC-42: an approved artifact that still has a marker gets a warning naming it', () => {
  const root = project({
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': CONCEPT,
    'docs/product/requirements/show.md': `---\nid: requirements-show\nstatus: approved\nderived-from:\n  - concept#vision:\n---\n\n${MARKED}`,
  });
  relink(root, ['requirements-show']);
  const r = runProcessTrace(root, {});
  assert.deepEqual(r.errors, []);
  const w = r.warnings.filter(x => /requirements-show/.test(x) && /\[open\]/.test(x));
  assert.equal(w.length, 1, r.warnings.join('\n'));
  assert.match(w[0], /approved/);
  assert.match(r.warnings.join('\n'), /\[proposed\]/);
  assert.match(r.warnings.join('\n'), /\[assumed\]/);
});
