// A feature's pull request cannot merge before its tutorial exists (docs/specs/process-state.md,
// AC-12). Under the GitHub gate a pushed branch has auto-merge on, so a delivery pushed part-way
// would merge as soon as its checks passed, before the approver validated anything. The tutorial
// lives in a gated folder, so once it is in the pull request the approver's review holds the merge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProcessConfig } from '../checks/lib/process.mjs';
import { checkChange } from '../checks/ci/process-change.mjs';

const config = parseProcessConfig('default: [lead]\n').config;
const files = (...list) => list.map(entry => { const [status, file] = entry.split(' '); return { status, path: file }; });
const spec = (extra = {}) => ({ name: 'export', file: 'docs/specs/export.md', status: 'approved', isProcess: true, userDocs: ['user-export'], ...extra });
const check = (changed, { specs = [spec()], tutorials = [], cited = ['export'] } = {}) => checkChange({ files: files(...changed), messages: [], specs, cited, tutorials, config, today: '2026-11-12' });

test('process-state#AC-12 a feature with source changes and no tutorial yet fails', () => {
  const r = check(['A src/export.ts', 'A test/export.test.ts', 'M docs/specs/export.md']);
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /tutorial.*user-export/);
  assert.match(r.problems.join('\n'), /approver/);
});

test('process-state#AC-12 it passes once a tutorial derives from the user documentation the spec derives from', () => {
  assert.equal(check(['A src/export.ts', 'A test/export.test.ts', 'A docs/tutorials/export.md'], { tutorials: ['user-export'] }).ok, true);
  assert.equal(check(['M src/export.ts', 'M test/export.test.ts'], { tutorials: ['user-export'] }).ok, true, 'a later change to a delivered feature');
});

test('process-state#AC-12 enabling work, a spec with no user documentation behind it, needs no tutorial', () => {
  assert.equal(check(['A src/build.ts', 'A test/build.test.ts'], { specs: [spec({ userDocs: [] })] }).ok, true);
});

test('process-state#AC-12 a fix, a trivial change, and a pull request with no source are not asked for a tutorial', () => {
  assert.equal(checkChange({ files: files('M src/export.ts', 'M test/export.test.ts'), messages: ['x\n\nChange: fix'], specs: [spec()], cited: ['export'], tutorials: [], config, today: '2026-11-12' }).ok, true);
  assert.equal(check(['M docs/specs/export.md', 'A test/export.test.ts']).ok, true, 'tests and the spec alone change no source');
});
