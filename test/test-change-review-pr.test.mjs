// Tests for the pull request side of test change review (docs/specs/test-change-review.md, slice
// 13c): the input the reviewer agent works from, and the comment it posts. Each test title cites
// the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildReviewInput, formatReviewComment } from '../checks/test-change-review.mjs';

const approved = {
  file: 'tests/frame.test.ts', line: 6, key: 'frame > fits the width', kinds: ['expected-literal-changed'],
  reason: 'docs/specs/frame.md AC-2 changed the width from 45rem to 50rem; the new text is on main',
  head: 'pass', base: 'fail', sabotage: 'fails',
};

test('test-change-review#AC-10: an approval lists each changed test with its finding, reason, and evidence, for the head commit', () => {
  const comment = formatReviewComment({ head: 'abc1234def567', decision: 'approve', labelAdded: true, cases: [approved] });
  assert.match(comment, /<!-- rfr-test-change-review head=abc1234def567 -->/);
  assert.match(comment, /Approved/);
  assert.match(comment, /`abc1234`/);
  assert.match(comment, /tests\/frame\.test\.ts:6/);
  assert.match(comment, /frame > fits the width/);
  assert.match(comment, /expected-literal-changed/);
  assert.match(comment, /AC-2 changed the width/);
  assert.match(comment, /passes on head, fails on base, fails when the behaviour is broken/);
  assert.match(comment, /added the `tests-reviewed` label/i);
  assert.match(comment, /later push/i);
});

test('test-change-review#AC-10: until the eval passes, an approval says the change is ready for the label and does not add it', () => {
  const comment = formatReviewComment({ head: 'abc1234def567', decision: 'approve', labelAdded: false, cases: [approved] });
  assert.match(comment, /ready for the `tests-reviewed` label/i);
  assert.doesNotMatch(comment, /added the `tests-reviewed` label/i);
});

test('test-change-review#AC-10: a referral says what is missing and adds no label', () => {
  const referred = {
    ...approved, base: 'pass', sabotage: 'not run', reason: '',
    missing: ['no approved reason for the changed expected value', 'it passes on base, so it does not catch the change'],
  };
  const comment = formatReviewComment({ head: 'abc1234def567', decision: 'refer', labelAdded: false, cases: [referred] });
  assert.match(comment, /Referred to the lead/);
  assert.match(comment, /no approved reason for the changed expected value/);
  assert.match(comment, /it passes on base, so it does not catch the change/);
  assert.match(comment, /no label/i);
  assert.doesNotMatch(comment, /added the `tests-reviewed` label/i);
});

test('test-change-review#AC-10: text from the repository cannot break the comment table', () => {
  const comment = formatReviewComment({ head: 'abc1234def567', decision: 'refer', labelAdded: false, cases: [{ ...approved, key: 'a | b\nc', missing: ['x'] }] });
  const row = comment.split('\n').find(l => l.includes('a \\| b'));
  assert.ok(row, comment);
  assert.equal(row.split(/(?<!\\)\|/).length, 7, row);
});

function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-review-input-'));
  const git = (...args) => {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  const write = map => { for (const [f, t] of Object.entries(map)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); } git('add', '-A'); };
  git('init', '-q', '-b', 'main');
  write({ 'package.json': '{ "type": "module" }\n', ...files });
  git('commit', '-q', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  return { root, base, change: map => { write(map); git('commit', '-q', '-m', 'head'); return git('rev-parse', 'HEAD'); } };
}

const spec = (width, unlocks = '') => `---\nstatus: approved\n${unlocks}---\n\n# Frame\n\n| # | Criterion | Verified by |\n|---|---|---|\n| AC-1 | The frame is ${width}rem wide. | test |\n| AC-2 | The frame has a border. | test |\n`;
const testFile = width => `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { width } from '../src/frame.mjs';\n\ntest('frame#AC-1: the frame width', () => {\n  assert.equal(width, ${width});\n});\n`;

test('test-change-review#AC-10: the review input names the criteria a changed test cites, before and after, with the unlocks entries and the evidence', async () => {
  const r = repo({ 'docs/specs/frame.md': spec(45), 'src/frame.mjs': 'export const width = 45;\n', 'test/frame.test.mjs': testFile(45) });
  const head = r.change({
    'docs/specs/frame.md': spec(50, 'unlocks:\n  - test/frame.test.mjs: AC-1 widened the frame\n'),
    'src/frame.mjs': 'export const width = 50;\n',
    'test/frame.test.mjs': testFile(50),
  });
  const input = await buildReviewInput({ root: r.root, base: r.base, head });
  assert.equal(input.head, head);
  const ac1 = input.criteria.find(c => c.spec === 'docs/specs/frame.md' && c.id === 'AC-1');
  assert.equal(ac1.before, 'The frame is 45rem wide.');
  assert.equal(ac1.after, 'The frame is 50rem wide.');
  assert.equal(ac1.changed, true);
  assert.equal(ac1.status, 'approved');
  assert.deepEqual(ac1.citedBy, ['frame#AC-1: the frame width']);
  assert.ok(!input.criteria.some(c => c.id === 'AC-2'), 'only cited criteria are listed');
  assert.deepEqual(input.unlocks, [{ spec: 'docs/specs/frame.md', file: 'test/frame.test.mjs', reason: 'AC-1 widened the frame', criteria: ['AC-1'] }]);
  const c = input.cases.find(x => x.key === 'frame#AC-1: the frame width');
  assert.equal(c.head, 'pass');
  assert.equal(c.base, 'fail');
  assert.match(input.diff, /test\/frame\.test\.mjs/);
  assert.match(input.diff, /-  assert\.equal\(width, 45\);/);
  assert.equal(input.specsGated, null, 'no process.yml');
});
