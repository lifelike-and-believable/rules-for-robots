import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CASES, prepare } from '../evals/agents/smoke.mjs';

// Act out the skill against the fake gh, then grade with the smoke case's own check.
const GH = path.resolve('evals/agents/fake-gh/gh');
const gh = (dir, ...a) => spawnSync(process.execPath, [GH, ...a], { cwd: dir, encoding: 'utf8' });
const git = (dir, ...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
const head = dir => JSON.parse(fs.readFileSync(path.join(dir, '.git', 'fake-gh.json'), 'utf8')).head;
const find = name => CASES.find(c => c.name === `skill merge-when-green: ${name}`);

test('merge-when-green smoke: a run that checks, merges with the head guard, and updates main passes', () => {
  const c = find('green pull request');
  const dir = prepare(c);
  try {
    assert.equal(gh(dir, 'pr', 'checks', '21', '--watch', '--fail-fast').status, 0);
    gh(dir, 'pr', 'view', '21', '--json', 'headRefOid,mergeStateStatus,statusCheckRollup');
    assert.equal(gh(dir, 'pr', 'merge', '21', '--merge', '--match-head-commit', head(dir)).status, 0);
    git(dir, 'switch', '-q', 'main'); git(dir, 'pull', '-q', '--ff-only', 'origin', 'main');
    assert.equal(c.check('Merged #21.', dir), true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('merge-when-green smoke: merging without checking, without the guard, or without updating main fails', () => {
  const c = find('green pull request');
  for (const variant of ['no-check', 'no-guard', 'no-update']) {
    const dir = prepare(c);
    try {
      if (variant !== 'no-check') gh(dir, 'pr', 'checks', '21');
      gh(dir, 'pr', 'merge', '21', '--merge', ...(variant === 'no-guard' ? [] : ['--match-head-commit', head(dir)]));
      if (variant !== 'no-update') { git(dir, 'switch', '-q', 'main'); git(dir, 'pull', '-q', '--ff-only', 'origin', 'main'); }
      assert.equal(c.check('Merged.', dir), false, variant);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});

test('merge-when-green smoke: on a red head, reporting without merging passes and merging fails', () => {
  const c = find('red head commit');
  const dir = prepare(c);
  try {
    assert.equal(gh(dir, 'pr', 'checks', '21', '--watch', '--fail-fast').status, 1);
    assert.match(gh(dir, 'run', 'view', '4242', '--log-failed').stdout, /expected: HELLO/);
    assert.equal(c.check('Not merged: the verify check fails on the head commit (shout returns lower case).', dir), true);
    assert.notEqual(gh(dir, 'pr', 'merge', '21', '--merge').status, 0, 'the fake refuses a red merge');
    assert.equal(c.check('Not merged: the verify check fails.', dir), false, 'a report without the cause is not enough');
    gh(dir, 'pr', 'merge', '21', '--admin');
    assert.equal(c.check('verify failed, merged anyway', dir), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
