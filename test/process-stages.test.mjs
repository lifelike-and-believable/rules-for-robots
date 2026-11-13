// Tests for the optional discovery stage (docs/specs/project-process.md, AC-41). Moved unchanged
// from the Agentic XR Pipeline round files (rewrite plan 25e). Each test title cites the criterion
// it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';
import { STAGE_ORDER, parseProcessConfig, stageOf } from '../checks/lib/process.mjs';

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-stages-'));
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
