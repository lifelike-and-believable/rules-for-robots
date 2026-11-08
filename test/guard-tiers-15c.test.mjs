// Guard tiers, slice 15c (docs/specs/guard-tiers.md, AC-11): a snapshot before a destructive local
// command, which is then allowed. Each test title cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decideCommand } from '../plugins/core/scripts/guard-commands.mjs';
import { pruneSnapshots, snapshotTree, SNAPSHOT_PREFIX } from '../plugins/core/scripts/snapshot.mjs';
import { readLog, summarise, formatReport } from '../checks/guard-report.mjs';

const ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' };

function sh(dir, command) {
  const r = spawnSync('bash', ['-c', command], { cwd: dir, encoding: 'utf8', env: ENV });
  assert.equal(r.status, 0, `${command}: ${r.stderr}`);
  return r.stdout;
}

// Two commits; then a modified tracked file, a staged change, an untracked file, an untracked
// folder, and an ignored build folder.
function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-15c-'));
  sh(dir, [
    'git init -q -b main',
    "printf 'dist/\\n' > .gitignore",
    'mkdir -p src docs',
    'echo a > src/a.js && echo b > src/b.js && echo d > docs/d.md',
    'git add . && git commit -qm base',
    'echo two > src/b.js && git commit -qam second',
    'echo changed > src/a.js',
    'echo staged > docs/d.md && git add docs/d.md',
    'echo new > src/new.js',
    'mkdir -p notes && echo n > notes/n.txt',
    'mkdir -p dist && echo built > dist/app.js',
  ].join(' && '));
  return dir;
}

// What a person would want back: HEAD and the content of every file that is not ignored.
const state = dir => sh(dir, 'git rev-parse HEAD; for f in $(git ls-files --cached --others --exclude-standard | sort -u); do if [ -f "$f" ]; then echo "$f: $(cat "$f")"; fi; done');
const undoOf = reason => reason.match(/to undo it: (.*?) \(kept as /)[1];

test('guard-tiers#AC-11: each destructive local command takes a snapshot, is allowed, and the restore command brings back every file', () => {
  for (const command of ['git reset --hard', 'git checkout -- .', 'git restore .', 'git clean -fd', 'git clean -fdx', 'rm -rf src', 'rm -rf notes', 'git reset --hard HEAD~1']) {
    const dir = repo();
    const before = state(dir);
    const decision = decideCommand(command, { cwd: dir });
    assert.equal(decision?.decision, 'inform', command);
    assert.match(decision.reason, /^rfr-core \(WA-003\): the guard took a snapshot/, command);
    assert.equal(decision.snapshots.length, 1, command);
    assert.match(decision.snapshots[0], /^refs\/rfr\/snapshots\/\d{8}T\d{6}Z-[0-9a-f]+$/);
    // Taking the snapshot touched neither the working tree nor the index.
    assert.equal(state(dir), before, `${command}: the snapshot changes nothing`);
    assert.match(sh(dir, 'git diff --cached --name-only'), /docs\/d\.md/);
    sh(dir, command);
    assert.notEqual(state(dir), before, `${command}: the command did remove something`);
    sh(dir, undoOf(decision.reason));
    assert.equal(state(dir), before, `${command}: restored`);
  }
});

test('guard-tiers#AC-11: a dropped stash is kept, and the restore command puts it back on the stash list', () => {
  const dir = repo();
  sh(dir, 'git stash push -q -u -m mine');
  const sha = sh(dir, 'git rev-parse stash@{0}').trim();
  for (const command of ['git stash drop', 'git stash drop stash@{0}', 'git stash clear']) {
    const decision = decideCommand(command, { cwd: dir });
    assert.equal(decision?.decision, 'inform', command);
    assert.match(decision.reason, new RegExp(`git stash store -m "restored by rfr-core" ${sha}`), command);
  }
  const decision = decideCommand('git stash drop', { cwd: dir });
  sh(dir, 'git stash drop -q');
  assert.equal(sh(dir, 'git stash list'), '');
  sh(dir, undoOf(decision.reason));
  assert.equal(sh(dir, 'git rev-parse stash@{0}').trim(), sha);
  // Nothing on the stash: nothing to lose.
  sh(dir, 'git stash clear');
  assert.equal(decideCommand('git stash drop', { cwd: repo() }), null);
});

test('guard-tiers#AC-11: a failed snapshot asks, and a command that also changes a remote still asks', () => {
  const dir = repo();
  const failed = decideCommand('git reset --hard', { cwd: dir, snapshot: snaps => ({ failed: snaps[0].risk }) });
  assert.equal(failed.decision, 'ask');
  assert.match(failed.reason, /could not take a snapshot first\. If not approved: /);
  // A real failure: the objects folder cannot be written.
  const objects = path.join(dir, '.git', 'objects');
  fs.chmodSync(objects, 0o555);
  try {
    if (process.getuid?.() !== 0) assert.equal(decideCommand('git reset --hard', { cwd: dir }).decision, 'ask');
  } finally {
    fs.chmodSync(objects, 0o755);
  }
  assert.equal(decideCommand('git reset --hard && git push --force', { cwd: dir }).decision, 'ask');
  assert.equal(sh(dir, `git for-each-ref ${SNAPSHOT_PREFIX}`), '', 'no snapshot when a person is asked anyway');
});

test('guard-tiers#AC-11: pruning removes snapshots older than 14 days beyond the newest 50', () => {
  const dir = repo();
  const now = new Date('2026-11-08T12:00:00Z');
  const day = 86400000;
  // 60 snapshots, one a day back from today.
  for (let i = 0; i < 60; i++) snapshotTree(dir, { now: new Date(now.getTime() - i * day) });
  const removed = pruneSnapshots(dir, { now });
  assert.equal(removed.length, 10);
  const left = sh(dir, `git for-each-ref --format='%(refname)' ${SNAPSHOT_PREFIX}`).trim().split('\n');
  assert.equal(left.length, 50);
  assert.ok(left.some(r => r.includes('20261108T120000Z')), 'the newest stays');
  // Beyond 50 but within 14 days: kept.
  const recent = repo();
  for (let i = 0; i < 55; i++) snapshotTree(recent, { now: new Date(now.getTime() - i * 3600000) });
  assert.deepEqual(pruneSnapshots(recent, { now }), []);
});

test('guard-tiers#AC-11: the hook logs the snapshot with its ref, and the report counts it', () => {
  const dir = repo();
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-15c-log-'));
  const hook = spawnSync(process.execPath, ['plugins/core/scripts/guard-commands.mjs'], {
    input: JSON.stringify({ cwd: dir, session_id: 's1', tool_name: 'Bash', tool_input: { command: 'git checkout -- .' } }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_DATA: data },
  });
  const out = JSON.parse(hook.stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, undefined, 'allowed: no permission decision');
  assert.match(out.additionalContext, /git restore --source=[0-9a-f]{40} --worktree -- :\//);
  const { entries } = readLog(path.join(data, 'guard-decisions.jsonl'));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].decision, 'snapshot');
  assert.match(entries[0].refs[0], /^refs\/rfr\/snapshots\//);
  assert.equal(sh(dir, `git rev-parse --verify ${entries[0].refs[0]}`).trim().length, 40);
  const report = summarise(entries);
  assert.equal(report.snapshots, 1);
  assert.equal(report.asks, 0);
  assert.match(formatReport(report), /1 snapshot taken before a destructive command/);
});
