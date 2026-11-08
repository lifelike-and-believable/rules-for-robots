// Guard tiers, slice 15b (docs/specs/guard-tiers.md): the tier changes to the guards and the
// testWeakening setting. Each test title cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decideCommand } from '../plugins/core/scripts/guard-commands.mjs';
import { decideEdit } from '../plugins/core/scripts/guard-test-edits.mjs';
import { ownedPathsReason } from '../plugins/core/scripts/guard-owned-paths.mjs';
import { vercelAskReason } from '../plugins/web/scripts/guard-mcp.mjs';
import { decideUnreal } from '../plugins/unreal/scripts/guard-unreal.mjs';

const corpus = JSON.parse(fs.readFileSync('test/fixtures/guard-corpus.json', 'utf8')).cases;

function git(dir, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
}

// A repository on a feature branch, with a tracked test, a tracked build/ folder, and an ignored dist/.
function repo(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-15b-'));
  const write = files => {
    for (const [f, s] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.writeFileSync(path.join(dir, f), s);
    }
  };
  write({
    '.gitignore': 'dist/\n',
    'src/a.js': 'export const a = 1;\n',
    'build/make.mjs': 'console.log("build");\n',
    'build/lib/util.mjs': 'export const u = 1;\n',
    'tests/a.test.ts': "import { test, expect } from 'vitest';\n\ntest('a', () => {\n  expect(1 + 1).toBe(2);\n});\n",
    ...extra,
  });
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'feature');
  write({ 'dist/app.js': 'built\n' });
  return { dir, write };
}

const weaken = dir => decideEdit({ tool_name: 'Edit', cwd: dir, tool_input: { file_path: path.join(dir, 'tests', 'a.test.ts'), old_string: 'toBe(2)', new_string: 'toBe(3)' } });

// An ask reason: "<source>: <action>. <why>. If not approved: <instead>."
const ASK_SHAPE = /^rfr-[\w-]+ \([^)]+\): (?<action>.+)\. (?<why>[^.]+)\. If not approved: (?<instead>.+)\.$/s;

test('guard-tiers#AC-3: tier-4 corpus cases ask, and each ask reason names the action, why it cannot be undone, and what to do if not approved', () => {
  const reasons = [];
  for (const c of corpus.filter(x => x.tier === 4 && !x.pending)) {
    let decision;
    if (c.guard === 'commands') decision = decideCommand(c.command, { cwd: repo().dir });
    else if (c.guard === 'mcp') {
      const reason = vercelAskReason(c.tool_name, c.tool_input);
      decision = reason && { decision: 'ask', reason };
    } else if (c.guard === 'test-edits' && c.edit === 'weaken-base') decision = weaken(repo().dir);
    else continue;
    assert.equal(decision?.decision, 'ask', c.id);
    reasons.push([c.id, decision.reason]);
  }
  assert.ok(reasons.length >= 10, `checked ${reasons.length} asks`);
  for (const [id, reason] of reasons) {
    const m = reason.match(ASK_SHAPE);
    assert.ok(m, `${id}: ${reason}`);
    for (const part of ['action', 'why', 'instead']) assert.ok(m.groups[part].trim().length > 10, `${id}: ${part}`);
  }
  // The secret read in rfr-web keeps the words people already know.
  assert.match(vercelAskReason('mcp__Vercel__get_project_env', {}), /returns secret values/);
});

test('guard-tiers#AC-4: tier-2 corpus cases are refused with a next step, and never ask', () => {
  const nextStep = {
    'test-shell-write': /Edit tool/,
    'snapshot-update': /RFR_SNAPSHOT_REASON=.* and give the same reason in your report/,
    'execcmds-without-quit': /Add ";Quit"/,
  };
  for (const c of corpus.filter(x => x.tier === 2 && !x.pending)) {
    const decision = c.guard === 'unreal' ? decideUnreal(c.command) : decideCommand(c.command, { cwd: repo().dir });
    assert.equal(decision?.decision, 'deny', c.id);
    assert.ok(nextStep[c.id], `${c.id}: add its next step to this test`);
    assert.match(decision.reason, nextStep[c.id], c.id);
  }
  // A snapshot update with its reason stated goes through.
  assert.equal(decideCommand('RFR_SNAPSHOT_REASON="the header now shows the plan name" npx vitest run -u', { cwd: repo().dir }), null);
  assert.equal(decideCommand('npx jest --updateSnapshot', { cwd: repo().dir })?.decision, 'deny');
  // guard-owned-paths refuses with the next step: use the public interface, or report the missing one.
  const owned = ownedPathsReason('Source/Engine/A.cpp');
  assert.match(owned, /public interfaces/);
  assert.match(owned, /report the missing interface/);
  assert.doesNotMatch(owned, /Approve/);
});

test('guard-tiers#AC-5: testWeakening chooses between asking and deferring to the pull request, and defaults to ask', () => {
  const tierOf = d => (d.decision === 'ask' ? 4 : /say so in your report|pull request decides/i.test(d.reason) ? 3 : 2);

  const plain = repo();
  assert.equal(tierOf(weaken(plain.dir)), 4, 'no setting: ask');
  assert.equal(decideCommand('git rm tests/a.test.ts', { cwd: plain.dir }).decision, 'ask');

  const asking = repo({ '.claude/rfr.json': '{ "testWeakening": "ask" }\n' });
  assert.equal(tierOf(weaken(asking.dir)), 4, 'ask: ask');

  const deferring = repo({ '.claude/rfr.json': '{ "testWeakening": "defer" }\n' });
  const deferred = weaken(deferring.dir);
  assert.equal(tierOf(deferred), 3, 'defer: refused for the pull request');
  assert.match(deferred.reason, /tests\/a\.test\.ts is an existing test, and this edit weakens it/);
  assert.match(deferred.reason, /testWeakening: defer/);
  for (const command of ['git rm tests/a.test.ts', 'mv tests/a.test.ts tests/b.test.ts']) {
    assert.equal(tierOf(decideCommand(command, { cwd: deferring.dir })), 3, command);
  }
  // A shell write is still a tier-2 refusal, whatever the setting.
  assert.equal(tierOf(decideCommand("sed -i 's/2/3/' tests/a.test.ts", { cwd: deferring.dir })), 2);

  // An unknown value keeps the default.
  const odd = repo({ '.claude/rfr.json': '{ "testWeakening": "never" }\n' });
  assert.equal(tierOf(weaken(odd.dir)), 4);
});

test('guard-tiers#AC-12: rm -rf of clean tracked files is allowed with the command that restores them; a modified file still stops it', () => {
  const r = repo();
  const allowed = decideCommand('rm -rf build', { cwd: r.dir });
  assert.equal(allowed.decision, 'inform');
  assert.match(allowed.reason, /git checkout -- build/);
  assert.equal(decideCommand('rm -rf build/lib dist', { cwd: r.dir }).decision, 'inform');

  // The hook prints context only, with no permission decision.
  const hook = spawnSync(process.execPath, ['plugins/core/scripts/guard-commands.mjs'], { input: JSON.stringify({ cwd: r.dir, tool_name: 'Bash', tool_input: { command: 'rm -rf build' } }), encoding: 'utf8', env: { ...process.env, RFR_GUARD_LOG: '0' } });
  const out = JSON.parse(hook.stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, undefined);
  assert.match(out.additionalContext, /git checkout -- build/);

  // A modified file or an untracked file inside: git cannot bring it back, so the guard takes a snapshot (AC-11).
  r.write({ 'build/make.mjs': 'changed\n' });
  assert.match(decideCommand('rm -rf build', { cwd: r.dir }).reason, /took a snapshot/);
  const u = repo();
  u.write({ 'build/notes.txt': 'mine\n' });
  assert.match(decideCommand('rm -rf build', { cwd: u.dir }).reason, /took a snapshot/);
});
