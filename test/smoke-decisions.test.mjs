// The decisions skill's smoke case (improvement plan 19c), acted out against the fake gh with the
// queue script, then graded with the case's own check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CASES, prepare } from '../evals/agents/smoke.mjs';

const GH_DIR = path.resolve('evals/agents/fake-gh');
const SCRIPT = path.resolve('plugins/core/scripts/decisions.mjs');
const c = CASES.find(x => x.name.startsWith('skill decisions:'));

// On Windows the fake gh (a script without an extension) cannot be found on PATH, so the fake is
// called through node directly, as the merge-when-green smoke tests do.
const gh = (dir, ...a) => spawnSync(process.execPath, [path.join(GH_DIR, 'gh'), ...a], { cwd: dir, encoding: 'utf8' });

test('decisions smoke: the queue script reads the fake issues', { skip: process.platform === 'win32' && 'the fake gh runs through PATH only on POSIX' }, () => {
  const dir = prepare(c);
  try {
    const r = spawnSync(process.execPath, [SCRIPT, 'list', '--json'], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: [GH_DIR, process.env.PATH].join(path.delimiter) } });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout).map(i => [i.number, i.state]), [[31, 'due'], [32, 'answered'], [33, 'waiting']]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('decisions smoke: closing the due and answered questions and leaving the irreversible one passes', () => {
  const dir = prepare(c);
  try {
    assert.equal(gh(dir, 'issue', 'close', '31', '--comment', '<!-- rfr-decision -->\nApplied: A (default, due)').status, 0);
    assert.equal(gh(dir, 'issue', 'close', '32', '--comment', '<!-- rfr-decision -->\nApplied: A (answered)').status, 0);
    assert.equal(c.check('Applied #31 and #32. #33 has no default and waits for your answer.', dir), true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('decisions smoke: closing the irreversible question, or skipping the due one, fails', () => {
  for (const close of [['31', '32', '33'], ['32']]) {
    const dir = prepare(c);
    try {
      for (const n of close) gh(dir, 'issue', 'close', n, '--comment', 'Applied: A');
      assert.equal(c.check('Done. #33 waits.', dir), false, close.join(','));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
