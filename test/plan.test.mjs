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

test('the status line names the rfr-core version (improvement plan 18a)', () => {
  const plan = v => `# Plan\n\nStatus: v${v} (2026-11-09). Phases done.\n\n### Phase 8: Evals\nStatus: first round done.\n`;
  assert.deepEqual(checkPlan(plan('5.3.1'), { coreVersion: '5.3.1' }), []);
  assert.match(checkPlan(plan('1.0.2'), { coreVersion: '5.3.1' })[0], /says v1\.0\.2, but rfr-core is 5\.3\.1/);
  assert.match(checkPlan('# Plan\n\nStatus: pre-1.0.\n', { coreVersion: '5.3.1' })[0], /must name the current version/);
  assert.deepEqual(checkPlan(plan('1.0.2')), [], 'without a version to compare, the line is not checked');
});

test('a phase marked planned cannot have every slice done (improvement plan 18a)', () => {
  const stale = phase('Phase 16: Domain plugins (planned)', '- **16a:** the plugins. Done (#148).\n- **16b:** templates. Done (#150).');
  assert.match(checkPlan(stale)[0], /Phase 16.*marked planned, but every slice under it is done/);
  const open = phase('Phase 15: Guard tiers (planned)', '- **15a:** the guide. Done (#146).\n- **15e:** the eval.');
  assert.deepEqual(checkPlan(open), []);
  assert.deepEqual(checkPlan(phase('Phase 20: Later (planned)', 'No slices yet.')), []);
});

test('this repository\'s plan passes against its rfr-core version', () => {
  const version = JSON.parse(fs.readFileSync('plugins/core/.claude-plugin/plugin.json', 'utf8')).version;
  assert.deepEqual(checkPlan(fs.readFileSync('PLAN.md', 'utf8'), { coreVersion: version }), []);
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
