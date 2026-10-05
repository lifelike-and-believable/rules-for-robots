import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateTree } from '../checks/lib/rules.mjs';

const GOOD_META = `id: TEST-900
title: Example
level: MUST
scope: core
verified-by: [hook]
check: "hook: example"
targets-failure: test-gaming
observed-on: []
rationale: Example rule for tests.`;

function makeTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-rules-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

function errorsFor(files, options) {
  const root = makeTree(files);
  try {
    return validateTree(root, options).flatMap(r => r.errors);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const rule = (meta, body = 'Do the thing, because it helps.') => `---\n${meta}\n---\n${body}\n`;

test('accepts a valid rule', () => {
  assert.deepEqual(errorsFor({ 'core/testing/TEST-900-example.md': rule(GOOD_META) }), []);
});

test('accepts the repository rules', () => {
  const results = validateTree(path.resolve('rules'));
  assert.ok(results.length > 0);
  assert.deepEqual(results.flatMap(r => r.errors), []);
});

test('rejects invalid YAML, because it would make a scoped rule load everywhere', () => {
  const errors = errorsFor({ 'core/testing/TEST-900-example.md': rule(`${GOOD_META}\npaths: [unclosed`) });
  assert.ok(errors.some(e => e.startsWith('invalid YAML')), errors.join('; '));
});

test('rejects duplicate keys', () => {
  const errors = errorsFor({ 'core/testing/TEST-900-example.md': rule(`${GOOD_META}\nlevel: SHOULD`) });
  assert.ok(errors.some(e => e.startsWith('invalid YAML')), errors.join('; '));
});

test('requires every required field', () => {
  const errors = errorsFor({ 'core/testing/TEST-900-example.md': rule(GOOD_META.replace(/^rationale:.*$/m, '')) });
  assert.ok(errors.includes('missing required field "rationale"'), errors.join('; '));
});

test('a MUST rule needs a hook or CI check', () => {
  const meta = GOOD_META.replace('verified-by: [hook]', 'verified-by: [review]').replace(/^check:.*$/m, '');
  const errors = errorsFor({ 'core/testing/TEST-900-example.md': rule(meta) });
  assert.ok(errors.includes('a MUST rule needs "hook" or "ci" in verified-by'), errors.join('; '));
});

test('hook or CI verification needs a check description', () => {
  const errors = errorsFor({ 'core/testing/TEST-900-example.md': rule(GOOD_META.replace(/^check:.*$/m, '')) });
  assert.ok(errors.includes('"check" must name the hook or CI job'), errors.join('; '));
});

test('filename must match the id', () => {
  const errors = errorsFor({ 'core/testing/TEST-901-example.md': rule(GOOD_META) });
  assert.ok(errors.some(e => e.startsWith('filename')), errors.join('; '));
});

test('scope must match the folder and the prefix', () => {
  const errors = errorsFor({ 'packs/unreal-plugin/build/TEST-900-example.md': rule(GOOD_META) });
  assert.ok(errors.some(e => e.includes('does not match folder')), errors.join('; '));
  const prefixErrors = errorsFor({ 'core/x/UE-001-example.md': rule(GOOD_META.replace('TEST-900', 'UE-001')) });
  assert.ok(prefixErrors.some(e => e.includes('belongs to pack:unreal-plugin')), prefixErrors.join('; '));
});

test('rejects unknown fields and unknown failure modes', () => {
  const errors = errorsFor({
    'core/testing/TEST-900-example.md': rule(`${GOOD_META.replace('test-gaming', 'laziness')}\napplies-to: ["src/**"]`),
  });
  assert.ok(errors.includes('unknown field "applies-to"'), errors.join('; '));
  assert.ok(errors.some(e => e.includes('failure vocabulary')), errors.join('; '));
});

test('rejects banned phrases and level keywords in the body', () => {
  const errors = errorsFor({
    'core/testing/TEST-900-example.md': rule(GOOD_META, 'CRITICAL: you MUST double-check everything.'),
  });
  assert.ok(errors.some(e => e.includes('"critical"')), errors.join('; '));
  assert.ok(errors.some(e => e.includes('"double-check"')), errors.join('; '));
  assert.ok(errors.some(e => e.includes('"MUST"')), errors.join('; '));
});

test('HTML comments are ignored when checking the body', () => {
  const errors = errorsFor({
    'core/testing/TEST-900-example.md': rule(GOOD_META, '<!-- MUST is fine in a maintainer note -->\nDo the thing, because it helps.'),
  });
  assert.deepEqual(errors, []);
});

test('enforces the body word limit', () => {
  const errors = errorsFor({ 'core/testing/TEST-900-example.md': rule(GOOD_META, 'word '.repeat(121)) });
  assert.ok(errors.some(e => e.includes('121 words')), errors.join('; '));
});

test('rejects duplicate ids across files', () => {
  const errors = errorsFor({
    'core/testing/TEST-900-example.md': rule(GOOD_META),
    'core/other/TEST-900-again.md': rule(GOOD_META),
  });
  assert.ok(errors.some(e => e.startsWith('duplicate id TEST-900')), errors.join('; '));
});

test('waivers are rejected in rules/ and validated in adopting repos', () => {
  const waiver = '---\nid: TEST-900\nwaiver: true\nreason: Regenerated by a reviewed script.\napproved-by: A. Person\ndate: 2026-10-05\n---\n';
  const file = { 'core/testing/TEST-900-example.md': waiver };
  assert.ok(errorsFor(file).includes('waivers belong in adopting repos, not in rules/'));
  assert.deepEqual(errorsFor(file, { allowWaivers: true }), []);
  const withBody = { 'core/testing/TEST-900-example.md': `${waiver}Some text.\n` };
  assert.ok(errorsFor(withBody, { allowWaivers: true }).includes('a waiver has no body'));
});
