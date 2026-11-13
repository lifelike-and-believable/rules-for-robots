// Tests for what the test guards count as a test file and an existing test (rfr-core
// guard-test-edits, and the same paths in guard-commands and the CI test guard). Moved from
// hooks.test.mjs (rewrite plan 25e, verify inventory slice f).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findRisk } from '../plugins/core/scripts/guard-commands.mjs';
import { decideEdit, isTestPath, shouldAsk } from '../plugins/core/scripts/guard-test-edits.mjs';

const SCRIPTS = path.resolve('plugins/core/scripts');

function runHook(script, input) {
  return spawnSync(process.execPath, [path.join(SCRIPTS, script)], { input: JSON.stringify(input), encoding: 'utf8' });
}

// A git repository for the rfr-core 3.0.2 tests: one committed file in src/, plus any extra files.
function gitRepo(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-repo-'));
  const git = (...args) => {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  };
  const write = (map) => {
    for (const [file, text] of Object.entries(map)) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), text);
    }
  };
  git('init', '-q', '-b', 'main');
  write({ 'src/a.ts': 'a\n', ...files });
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  return { dir, git, write };
}

test('recognizes test paths', () => {
  for (const p of ['src/a.test.ts', 'src/a.spec.tsx', 'tests/unit/x.py', 'Plugins/My/Source/My/Tests/Spec.cpp', 'web\\__tests__\\a.js', 'src/__snapshots__/a.snap']) {
    assert.ok(isTestPath(p), p);
  }
  for (const p of ['src/test-utils.ts', 'src/latest/a.ts', 'contest.md', 'src/attestation.ts']) {
    assert.ok(!isTestPath(p), p);
  }
});

test('asks only before editing existing test files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-hooks-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src/a.test.ts'), 'test');
  assert.equal(shouldAsk('src/a.test.ts', dir), true);
  assert.equal(shouldAsk('src/b.test.ts', dir), false, 'new test files are allowed');
  assert.equal(shouldAsk('src/a.ts', dir), false);

  // Since test-change-review AC-11 passed, the default defers the change to the pull request (tier 3):
  // no permission decision, and context that names the deferral.
  const result = runHook('guard-test-edits.mjs', { cwd: dir, tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'src/a.test.ts') } });
  const output = JSON.parse(result.stdout).hookSpecificOutput;
  assert.equal(output.permissionDecision, undefined);
  assert.match(output.additionalContext, /testWeakening: defer/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Unreal test modules count as tests in every guard (#37)', async () => {
  const { isTestOrBaseline } = await import('../checks/ci/test-change-guard.mjs');
  const tests = [
    'Plugins/X/Source/XTests/Private/Core/FooTests.cpp', 'Source/Open3DBroadcastTests/Private/Core/CoreSerializationTests.cpp',
    'Source/My/Private/Tests/WebRTCSecretsTests.cpp', 'Source/My/Private/MySubsystemSpec.cpp',
  ];
  for (const p of tests) {
    assert.ok(isTestPath(p), `guard-test-edits: ${p}`);
    assert.ok(isTestOrBaseline(p), `test-change-guard: ${p}`);
    assert.ok(findRisk(`sed -i s/a/b/ ${p}`), `guard-commands: ${p}`);
  }
  for (const p of ['src/test-utils.ts', 'src/latest/a.ts', 'contest.md', 'Source/My/Private/Contest.cpp', 'Source/Latest/Private/A.cpp']) {
    assert.ok(!isTestPath(p), `guard-test-edits: ${p}`);
    assert.ok(!isTestOrBaseline(p), `test-change-guard: ${p}`);
    assert.equal(findRisk(`sed -i s/a/b/ ${p}`), null, `guard-commands: ${p}`);
  }
});

test('TEST-001 and TEST-003 load for Unreal test modules (#37)', async () => {
  const { parseRuleFile } = await import('../checks/lib/rules.mjs');
  for (const file of ['rules/core/testing/TEST-001-keep-tests-honest.md', 'rules/core/testing/TEST-003-test-behaviour-not-implementation.md']) {
    const { paths } = parseRuleFile(file).meta;
    const hit = p => paths.some(g => path.posix.matchesGlob(p, g));
    assert.ok(hit('Plugins/X/Source/XTests/Private/Core/FooTests.cpp'), file);
    assert.ok(hit('Source/My/Private/MySubsystemSpec.cpp'), file);
    assert.ok(!hit('Source/My/Private/My.cpp'), file);
  }
});

test('test guards leave alone test files added on the current branch, as the CI test guard does', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-branch-'));
  const git = (...args) => {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  };
  const write = (file, text = 'x\n') => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
  git('init', '-q', '-b', 'main');
  write('tests/old.test.ts');
  git('add', '.'); git('commit', '-q', '-m', 'base');
  git('checkout', '-q', '-b', 'feature');
  write('tests/new.test.ts');
  git('add', '.'); git('commit', '-q', '-m', 'tests first');
  write('tests/untracked.test.ts');

  assert.equal(shouldAsk('tests/old.test.ts', dir), true);
  assert.equal(shouldAsk(path.join(dir, 'tests/new.test.ts'), dir), false);
  assert.equal(shouldAsk('tests/untracked.test.ts', dir), false);
  assert.ok(findRisk('sed -i s/a/b/ tests/old.test.ts', { cwd: dir }));
  assert.equal(findRisk('sed -i s/a/b/ tests/new.test.ts', { cwd: dir }), null);
  assert.equal(findRisk("python3 - <<'PY'\np='tests/new.test.ts'\nopen(p,'w').write('y')\nPY", { cwd: dir }), null);
  assert.ok(findRisk("python3 - <<'PY'\nfor p in ['tests/new.test.ts', 'tests/old.test.ts']:\n    open(p,'w').write('y')\nPY", { cwd: dir }));

  const edit = runHook('guard-test-edits.mjs', { cwd: dir, tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'tests/new.test.ts') } });
  assert.equal(edit.stdout, '');
  // A shell write to an existing test is refused with a pointer to the Edit tool (test-change-review AC-6).
  const shell = runHook('guard-commands.mjs', { cwd: dir, tool_name: 'Bash', tool_input: { command: 'sed -i s/a/b/ tests/old.test.ts' } });
  assert.equal(JSON.parse(shell.stdout).hookSpecificOutput.permissionDecision, 'deny');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('guard-test-edits reads the specs and paths of the worktree an agent edits in (rfr-core 3.0.2)', () => {
  const spec = '---\nstatus: approved\nunlocks:\n  - tests/unit/a.test.ts: AC-1 changed the width\n---\n\n| # | Criterion | Verified by |\n|---|---|---|\n| AC-1 | Width. | test |\n';
  const body = "import { test, expect } from 'vitest';\n\ntest('width', () => {\n  expect(width()).toBe(45);\n});\n";
  const r = gitRepo({ 'docs/specs/frame.md': spec, 'tests/unit/a.test.ts': body, 'tests/unit/b.test.ts': body });
  const wt = path.join(r.dir, '.claude', 'worktrees', 'agent-2');
  r.git('worktree', 'add', '-q', '-b', 'agent-2', wt);
  const before = process.env.CLAUDE_PROJECT_DIR;
  process.env.CLAUDE_PROJECT_DIR = r.dir;
  try {
    const weaken = file => decideEdit({ cwd: wt, tool_name: 'Edit', tool_input: { file_path: path.join(wt, file), old_string: 'toBe(45)', new_string: 'toBe(50)' } });
    assert.equal(weaken('tests/unit/a.test.ts'), null, 'the unlocks entry is found in the worktree');
    const asked = weaken('tests/unit/b.test.ts');
    assert.equal(asked.decision, 'defer');
    assert.match(asked.reason, /^rfr-core \(TEST-001\): tests\/unit\/b\.test\.ts is an existing test/);
  } finally {
    if (before === undefined) delete process.env.CLAUDE_PROJECT_DIR; else process.env.CLAUDE_PROJECT_DIR = before;
  }
});
