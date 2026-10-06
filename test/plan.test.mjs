import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkPlan } from '../checks/plan.mjs';

const phase = (heading, body) => `### ${heading}\n${body}\n`;
const milestones = rows => `## 11. Milestones\n\n| Milestone | Contents | Status | Pull requests |\n|---|---|---|---|\n${rows.join('\n')}\n\n## 12. Next\n`;

test('a completed phase must name its pull requests', () => {
  const ok = phase('Phase 1: Foundations (complete)', 'Delivered: things.\nPull requests: #2, #3.');
  const missing = phase('Phase 1: Foundations (complete)', 'Delivered: things, see #23 for the issue.');
  const inProgress = phase('Phase 8: Evals', 'Status: first round done.');
  assert.deepEqual(checkPlan(ok + inProgress), []);
  const errors = checkPlan(missing);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Phase 1/);
});

test('a released phase counts as complete, and the line needs at least one number', () => {
  assert.equal(checkPlan(phase('Phase 9: Release (v1.0.0 released)', 'Delivered.')).length, 1);
  assert.equal(checkPlan(phase('Phase 9: Release (v1.0.0 released)', 'Pull requests: none yet.')).length, 1);
  assert.deepEqual(checkPlan(phase('Phase 9: Release (v1.0.0 released)', 'Pull requests: #19, #66.')), []);
});

test('a milestone marked done must list pull requests', () => {
  assert.deepEqual(checkPlan(milestones(['| M1 | Research | Done | #1 |', '| M8 | Later | | |'])), []);
  const errors = checkPlan(milestones(['| M1 | Research | Done | |', '| M2 | Rules | Done for v1.0 | #5 |']));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /M1/);
});

test("this repository's PLAN.md passes", () => {
  assert.deepEqual(checkPlan(fs.readFileSync('PLAN.md', 'utf8')), []);
});
