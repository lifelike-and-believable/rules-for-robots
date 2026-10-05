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
