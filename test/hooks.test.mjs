import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findRisk } from '../plugins/core/scripts/guard-commands.mjs';
import { isTestPath, shouldAsk } from '../plugins/core/scripts/guard-test-edits.mjs';
import { chooseFormatter } from '../plugins/core/scripts/format-on-edit.mjs';

const SCRIPTS = path.resolve('plugins/core/scripts');

function runHook(script, input) {
  return spawnSync(process.execPath, [path.join(SCRIPTS, script)], { input: JSON.stringify(input), encoding: 'utf8' });
}

test('flags destructive commands', () => {
  const risky = [
    'rm -rf build', 'rm -fr /', 'sudo rm -r -f dist', 'rm --recursive --force x', 'cd a && rm -Rf b',
    'git reset --hard HEAD~1', 'git clean -fdx', 'git checkout -- .', 'git restore .',
    'git push --force origin main', 'git push -f', 'git push --force-with-lease', 'git push origin +main',
    'git branch -D feature', 'git stash drop', 'git stash clear', 'git filter-repo --path x',
    'git commit -m "x" --no-verify', 'npx drizzle-kit push', 'npx drizzle-kit migrate --force',
    'npx prisma migrate dev', 'npx prisma migrate reset', 'npx prisma db push', 'npx prisma db migrate',
  ];
  for (const command of risky) assert.ok(findRisk(command), `should flag: ${command}`);
});

test('leaves ordinary commands alone', () => {
  const safe = [
    'rm build/out.txt', 'rm -r tmpdir', 'ls -rf', 'npm run format -- --force', 'git status', 'git push origin feature',
    'git checkout main', 'git restore src/a.ts', 'git reset HEAD file', 'git clean -n', 'npx prisma migrate deploy',
    'npx drizzle-kit generate', 'echo "rm -rf is dangerous"', 'git log --format=%H',
  ];
  for (const command of safe) assert.equal(findRisk(command), null, `should not flag: ${command}`);
});

test('guard-commands prints an ask decision only for risky commands', () => {
  const risky = runHook('guard-commands.mjs', { tool_name: 'Bash', tool_input: { command: 'git reset --hard' } });
  assert.equal(risky.status, 0);
  const decision = JSON.parse(risky.stdout).hookSpecificOutput;
  assert.equal(decision.hookEventName, 'PreToolUse');
  assert.equal(decision.permissionDecision, 'ask');
  assert.match(decision.permissionDecisionReason, /WA-003/);

  const safe = runHook('guard-commands.mjs', { tool_name: 'Bash', tool_input: { command: 'npm test' } });
  assert.equal(safe.status, 0);
  assert.equal(safe.stdout, '');
});

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

  const result = runHook('guard-test-edits.mjs', { cwd: dir, tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'src/a.test.ts') } });
  assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'ask');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('format-on-edit uses only formatters the project has', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-fmt-'));
  fs.mkdirSync(path.join(dir, 'Source'));
  assert.equal(chooseFormatter(path.join(dir, 'a.ts'), dir), null);
  assert.equal(chooseFormatter(path.join(dir, 'Source/a.cpp'), dir), null);

  fs.mkdirSync(path.join(dir, 'node_modules/.bin'), { recursive: true });
  const bin = path.join(dir, 'node_modules/.bin', process.platform === 'win32' ? 'prettier.cmd' : 'prettier');
  fs.writeFileSync(bin, '');
  assert.equal(chooseFormatter(path.join(dir, 'a.ts'), dir).cmd, bin);

  fs.writeFileSync(path.join(dir, '.clang-format'), 'BasedOnStyle: LLVM');
  assert.equal(chooseFormatter(path.join(dir, 'Source/a.cpp'), dir).cmd, 'clang-format');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('guard-mcp asks before Vercel actions that change or expose the account', async () => {
  const { vercelToolNeedsApproval } = await import('../plugins/core/scripts/guard-mcp.mjs');
  for (const t of ['mcp__Vercel__create_deployment', 'mcp__vercel__edit_project_env', 'mcp__plugin_vercel_vercel__delete_project', 'mcp__Vercel__buy_domain', 'mcp__Vercel__get_auth_token', 'mcp__Vercel__request_rollback', 'mcp__Vercel__update_project_protection_bypass']) {
    assert.ok(vercelToolNeedsApproval(t), t);
  }
  for (const t of ['mcp__Vercel__get_deployment', 'mcp__Vercel__list_projects', 'mcp__Vercel__get_runtime_logs', 'mcp__Vercel__search_vercel_documentation', 'mcp__github__create_pull_request', 'Bash']) {
    assert.ok(!vercelToolNeedsApproval(t), t);
  }
});

test('guard-commands asks before shell edits to test files', async () => {
  const { findRisk } = await import('../plugins/core/scripts/guard-commands.mjs');
  for (const command of [
    "python3 -c \"p='e2e/accessibility.spec.ts'; s=open(p).read(); open(p,'w').write(s)\"",
    'sed -i "s/a/b/" src/a.test.ts',
    'echo x >> tests/test_api.py',
    'cat new > src/__snapshots__/a.snap',
    'mv src/a.spec.ts /tmp/',
    'rm tests/old_test.py',
  ]) assert.ok(findRisk(command), command);
  for (const command of ['npm test', 'npx vitest run src/a.test.ts', 'cat src/a.test.ts', 'grep -n foo tests/x.py', 'node --test test/']) {
    assert.equal(findRisk(command), null, command);
  }
});

test('guard-commands catches PowerShell deletes and test writes (#23)', () => {
  const risky = [
    'Remove-Item -Recurse -Force build', 'Remove-Item build -Force -Recurse', 'rm -Recurse -Force build',
    'ri -r -fo build', 'del -Recurse -Force build', 'rm -r -fo build', 'remove-item -rec -forc build',
    'Remove-Item -Recurse:$true -Force build', 'rmdir C:\\tmp\\x -Recurse -Force',
    'Set-Content -Path src/a.test.ts -Value x', 'Out-File -FilePath tests/x.py', 'Add-Content tests/x.py y',
    'Move-Item src/a.spec.ts C:/tmp', 'Copy-Item new.ts src/a.test.ts', 'Remove-Item -LiteralPath Source\\X\\Tests\\Y.cpp',
    'sed -i s/a/b/ Source\\X\\Tests\\Y.cpp', 'git push --force origin main', 'Clear-Content src\\__tests__\\a.js',
    'New-Item -Force tests/x.py', 'ren tests\\a_test.py b_test.py', 'cd x; del tests/old_test.py',
  ];
  for (const command of risky) assert.ok(findRisk(command), `should flag: ${command}`);
  const safe = [
    'Remove-Item -Recurse build', 'Remove-Item file.txt -Force', 'Get-Content tests/x.py', 'Select-String foo tests/x.py',
    'Get-ChildItem -Recurse -Force', 'Remove-Item -r -f build', 'git commit -m "move helper out of tests/x.py"',
    'New-Item -ItemType File tests/new_test.py',
  ];
  for (const command of safe) assert.equal(findRisk(command), null, `should not flag: ${command}`);
});

test('guard-commands asks for the PowerShell tool (#23)', () => {
  const result = runHook('guard-commands.mjs', { tool_name: 'PowerShell', tool_input: { command: 'Remove-Item -Recurse -Force build' } });
  assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'ask');
});

test('hooks.json runs guard-commands for Bash and PowerShell (#23)', () => {
  const config = JSON.parse(fs.readFileSync('plugins/core/hooks/hooks.json', 'utf8'));
  const entry = config.hooks.PreToolUse.find(e => e.hooks.some(h => h.command.includes('guard-commands.mjs')));
  const matcher = new RegExp(`^(${entry.matcher})$`);
  assert.ok(matcher.test('Bash') && matcher.test('PowerShell'), entry.matcher);
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
