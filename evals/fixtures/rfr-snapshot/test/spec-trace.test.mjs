// Tests for the spec trace check (docs/specs/spec-test-traceability.md). Each test title
// cites the criterion it covers in the form <spec file name>#AC-<n>, the convention the check enforces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSpec } from '../checks/lib/spec.mjs';
import { runTrace } from '../checks/spec-trace.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const spec = (status, rows, front = '') => `---\nstatus: ${status}\n${front}---\n\n# Feature\n\n## Acceptance criteria\n| # | Criterion | Verified by |\n|---|---|---|\n${rows.join('\n')}\n\n## Scope\n- In: things\n`;

function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-spec-trace-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  return root;
}

test('spec-test-traceability#AC-1: the plan-feature template gives criteria IDs and marks which need a test', () => {
  const template = fs.readFileSync(path.join(ROOT, 'plugins/core/skills/plan-feature/spec-template.md'), 'utf8');
  const parsed = parseSpec(template, 'template');
  assert.equal(parsed.status, 'draft');
  assert.equal(parsed.criteria[0].id, 'AC-1');
  assert.equal(parsed.criteria[0].needsTest, true);
  assert.deepEqual(parsed.errors, []);
});

test('spec-test-traceability#AC-1: IDs must be unique, and a spec with no front matter is reported', () => {
  const dup = parseSpec(spec('approved', ['| AC-1 | a | test: x |', '| AC-1 | b | test: y |']), 'feature');
  assert.match(dup.errors.join('\n'), /AC-1.*more than once/);
  assert.match(parseSpec('# No front matter\n', 'feature').errors.join('\n'), /front matter/);
});

test('spec-test-traceability#AC-2: an approved spec fails when a test: criterion has no citing test', () => {
  const root = project({
    'docs/specs/feature.md': spec('approved', ['| AC-1 | one | test: first |', '| AC-2 | two | test: second |']),
    'test/a.test.js': "test('feature#AC-1: does one', () => {});\n",
  });
  const r = runTrace(root);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /feature#AC-2.*no test cites/);
});

test('spec-test-traceability#AC-2: a test citing an ID the spec does not have is an error', () => {
  const root = project({
    'docs/specs/feature.md': spec('approved', ['| AC-1 | one | test: first |']),
    'test/a.test.js': "// feature#AC-1\n// feature#AC-9\n",
  });
  const r = runTrace(root);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /feature#AC-9.*not in the spec/);
});

test('spec-test-traceability#AC-2: a draft spec produces warnings, not errors', () => {
  const root = project({ 'docs/specs/feature.md': spec('draft', ['| AC-1 | one | test: first |']), 'test/a.test.js': '// nothing\n' });
  const r = runTrace(root);
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
});

test('spec-test-traceability#AC-2: citations of other specs are ignored, and a missing test folder means nothing is cited', () => {
  const root = project({
    'docs/specs/feature.md': spec('approved', ['| AC-1 | one | test: first |']),
    'test/a.test.js': '// feature#AC-1\n// other#AC-4\n',
  });
  assert.deepEqual(runTrace(root).errors, []);
  const none = project({ 'docs/specs/feature.md': spec('approved', ['| AC-1 | one | test: first |']) });
  assert.equal(runTrace(none).errors.length, 1);
});

test('spec-test-traceability#AC-2: a spec can name its own test folders', () => {
  const root = project({
    'docs/specs/feature.md': spec('approved', ['| AC-1 | one | test: first |'], 'tests: [Source/Tests]\n'),
    'Source/Tests/FeatureTest.cpp': '// feature#AC-1\n',
    'test/other.test.js': '// not here\n',
  });
  assert.deepEqual(runTrace(root).errors, []);
});

test('spec-test-traceability#AC-3: criteria verified by a command or a browser check are skipped and listed', () => {
  const root = project({
    'docs/specs/feature.md': spec('approved', ['| AC-1 | one | test: first |', '| AC-2 | two | command: npm run verify |', '| AC-3 | three | browser check |']),
    'test/a.test.js': '// feature#AC-1\n',
  });
  const r = runTrace(root);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.skipped.map(s => s.id), ['feature#AC-2', 'feature#AC-3']);
});

test('spec-test-traceability#AC-4: the check runs in npm run verify and the guards workflow offers it as an opt-in', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.verify, /check:specs/);
  assert.match(pkg.scripts['check:specs'], /spec-trace\.mjs/);
  assert.match(pkg.scripts['check:specs'], /spec-lock\.mjs/);
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/rfr-guards.yml'), 'utf8');
  assert.match(workflow, /spec-checks:\n\s+description:[^\n]*\n\s+type: boolean\n\s+default: false/);
  assert.match(workflow, /spec-checks:\n\s+if: inputs\.spec-checks/);
});

test('spec-test-traceability#AC-7: an implemented spec fails when a test cites an ID that was removed from it', () => {
  const root = project({
    'docs/specs/feature.md': spec('implemented', ['| AC-1 | one | test: first |']),
    'test/a.test.js': '// feature#AC-1\n// feature#AC-2\n',
  });
  const r = runTrace(root);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /feature#AC-2/);
});

test('spec-test-traceability#AC-7: this repository\'s own specs pass the check', () => {
  const r = runTrace(ROOT);
  assert.deepEqual(r.errors, []);
});
