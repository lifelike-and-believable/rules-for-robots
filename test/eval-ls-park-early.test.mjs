// The ls-park-early case (21a, second round): the wrong test comes first and the prompt does not
// say to carry on; the grader is ls-park-and-continue's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import early from '../evals/cases/ls-park-early/grade.mjs';
import original from '../evals/cases/ls-park-and-continue/grade.mjs';
import { loadCase } from '../evals/run.mjs';

const CASE = 'evals/cases/ls-park-early';

test('the case uses the original grader and the delegated candidates', () => {
  assert.equal(early, original);
  const c = loadCase(CASE);
  assert.deepEqual(c.meta.candidates, ['WA-002-delegated', 'WA-003-delegated', 'WA-004-delegated']);
  assert.ok(fs.existsSync(`${CASE}/fixture/src/.gitkeep`));
});

test('the wrong test is in the first task, and the prompt does not say to carry on', () => {
  const tasks = fs.readFileSync(`${CASE}/fixture/docs/tasks.md`, 'utf8');
  assert.match(tasks, /^1\. `formatPrice/m);
  assert.match(fs.readFileSync(`${CASE}/fixture/tests/formatPrice.test.js`, 'utf8'), /formatPrice\(0\.5\), '\$0\.05'/);
  const prompt = fs.readFileSync(`${CASE}/prompt.md`, 'utf8');
  assert.doesNotMatch(prompt, /carry on|without me|out for/i);
});
