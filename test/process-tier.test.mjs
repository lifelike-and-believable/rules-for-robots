// Tests for the size tier check (docs/specs/project-process.md, "Size tiers"). Each test title
// cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProcessConfig } from '../checks/lib/process.mjs';
import { checkTier, matchGlob } from '../checks/ci/process-tier.mjs';

const config = parseProcessConfig('default: [lead]\npublic-api: [src/api/**, Source/*/Public/**]\n').config;
const processSpecs = new Set(['docs/specs/retarget.md']);
const check = (labels, files) => checkTier({ labels, files, config, processSpecs });

test('project-process#AC-10: a pull request with no tier label, two tier labels, or an unknown tier fails', () => {
  assert.match(check([], ['src/app.ts']).problems.join('\n'), /tier/);
  assert.equal(check(['bug'], ['src/app.ts']).ok, false);
  assert.equal(check(['tier:fix', 'tier:story'], ['src/app.ts']).ok, false);
  assert.match(check(['tier:huge'], ['src/app.ts']).problems.join('\n'), /tier:huge/);
});

test('project-process#AC-10: tier:trivial fails on any process folder', () => {
  for (const file of ['docs/product/concept.md', 'docs/product/stories/a/b.md', 'docs/design/x.md', 'docs/user/x.md', 'docs/tutorials/x.md', 'docs/specs/retarget.md']) {
    const r = check(['tier:trivial'], ['src/app.ts', file]);
    assert.equal(r.ok, false, file);
    assert.match(r.problems.join('\n'), new RegExp(file.replace(/[./]/g, '\\$&')));
  }
});

test('project-process#AC-10: tier:trivial fails on public-api paths', () => {
  assert.equal(check(['tier:trivial'], ['src/api/v1/users.ts']).ok, false);
  assert.equal(check(['tier:trivial'], ['Source/MyPlugin/Public/Thing.h']).ok, false);
});

test('project-process#AC-10: tier:fix fails on product, design, or user documentation', () => {
  for (const file of ['docs/product/stories/a/b.md', 'docs/design/x.md', 'docs/user/x.md']) assert.equal(check(['tier:fix'], [file]).ok, false, file);
});

test('project-process#AC-10: each tier passes on changes it allows', () => {
  assert.equal(check(['tier:trivial'], ['src/app.ts', 'docs/specs/plain.md', 'README.md']).ok, true);
  assert.equal(check(['tier:fix'], ['src/api/v1/users.ts', 'test/users.test.ts', 'docs/tutorials/x.md']).ok, true);
  assert.equal(check(['tier:story', 'bug'], ['docs/user/x.md', 'docs/design/x.md', 'src/app.ts']).ok, true);
  assert.equal(check(['tier:epic'], ['docs/product/epics/x.md', 'docs/product/requirements/a.md']).ok, true);
  assert.equal(check(['tier:story'], ['src/app.ts']).tier, 'story');
});

test('project-process#AC-10: public-api globs match ** across folders and * within one', () => {
  assert.equal(matchGlob('src/api/**', 'src/api/a/b.ts'), true);
  assert.equal(matchGlob('src/api/**', 'src/api/x'), true);
  assert.equal(matchGlob('src/api/**', 'src/apix/y'), false);
  assert.equal(matchGlob('*.md', 'a.md'), true);
  assert.equal(matchGlob('*.md', 'docs/a.md'), false);
  assert.equal(matchGlob('Source/*/Public/**', 'Source/MyPlugin/Public/A/B.h'), true);
  assert.equal(matchGlob('Source/*/Public/**', 'Source/MyPlugin/Private/A.cpp'), false);
});
