// Tests for open-item markers in artifacts ([open], [assumed], [proposed], [to validate];
// docs/specs/project-process.md, AC-42 and AC-46). Moved unchanged from the Agentic XR Pipeline
// round files (rewrite plan 25e). Each test title cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-markers-'));
  for (const [f, t] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), t);
  }
  return root;
}

const CONCEPT = '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\n## Audience\n\nPerformers.\n\n## Vision\n\nLive shows.\n';

// ---- AC-42: [open], [assumed], [proposed] --------------------------------------------------------

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

// ---- AC-46: [to validate] ----------------------------------------------------------------------

const PERSONA_CONCEPT = '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\n## Audience\n\nPerformers.\n';
const persona = body => `---\nid: persona-performer\nstatus: approved\nderived-from:\n  - concept#audience:\n---\n\n# Solo performer\n\n## Goals\n\n${body}\n`;

function personaProject(body) {
  const root = project({
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': PERSONA_CONCEPT,
    'docs/product/personas/performer.md': persona(body),
  });
  relink(root, ['persona-performer']);
  return runProcessTrace(root, {});
}

test('project-process#AC-46: an approved artifact with [to validate] is listed but not warned about', () => {
  const r = personaProject('- Runs a show alone, with no operator. [to validate]\n- Streams weekly. [to validate]');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings.filter(w => /to validate/.test(w)), [], r.warnings.join('\n'));
  const items = (r.openItems ?? []).filter(o => o.id === 'persona-performer');
  assert.deepEqual(items.map(o => o.marker), ['[to validate]', '[to validate]']);
});

test('project-process#AC-46: the warning for [assumed] does not suggest rewording it as settled text', () => {
  const r = personaProject('- Runs a show alone. [assumed]');
  const w = r.warnings.filter(x => /\[assumed\]/.test(x));
  assert.equal(w.length, 1, r.warnings.join('\n'));
  assert.doesNotMatch(w[0], /reword/i);
  assert.match(w[0], /\[to validate\]/);
});
