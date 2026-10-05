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

test('guard-commands asks before changing machine-wide git configuration (#31)', () => {
  for (const command of ['git config --global core.autocrlf false', 'git config --system safe.directory "*"', 'git config --global --add safe.directory C:/x', 'git config --global --unset user.name']) {
    assert.ok(findRisk(command), command);
  }
  for (const command of ['git config --global --get user.name', 'git config --global --list', 'git config -l', 'git -c safe.directory=* status', 'git config core.autocrlf false', 'git config --local core.longpaths true']) {
    assert.equal(findRisk(command), null, command);
  }
});

test('guard-commands asks when an editor -ExecCmds list does not quit (#56)', () => {
  for (const command of [
    '"C:/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe" Host.uproject -ExecCmds="Automation RunTests RfrSample" -unattended',
    'UnrealEditor-Cmd Host.uproject -ExecCmds="py run.py" -nullrhi',
    "& UnrealEditor.exe Host.uproject '-ExecCmds=DumpConsoleCommands' -unattended",
  ]) assert.ok(findRisk(command), command);
  for (const command of [
    '"C:/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe" Host.uproject -ExecCmds="Automation RunTests RfrSample;Quit" -unattended',
    'UnrealEditor-Cmd Host.uproject -ExecCmds="py run.py; quit" -nullrhi',
    'UnrealEditor-Cmd Host.uproject -run=ResavePackages',
    'grep -n ExecCmds Scripts/Verify.ps1',
  ]) assert.equal(findRisk(command), null, command);
});

function runOwnedPathsHook(projectDir, input) {
  return spawnSync(process.execPath, [path.join(SCRIPTS, 'guard-owned-paths.mjs')], {
    input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  });
}

test('guard-owned-paths asks before edits outside the owned paths (#47)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-owned-hook-'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# P\n\n## Owned paths\n\n- `Plugins/MyPlugin/**`\n');

  for (const input of [
    { tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'Source/Engine/A.cpp') } },
    { tool_name: 'NotebookEdit', tool_input: { notebook_path: path.join(dir, 'upstream/n.ipynb') } },
    { tool_name: 'Write', tool_input: { file_path: 'Source/Engine/B.h' }, cwd: dir },
  ]) {
    const result = runOwnedPathsHook(dir, input);
    assert.equal(result.status, 0, result.stderr);
    const decision = JSON.parse(result.stdout).hookSpecificOutput;
    assert.equal(decision.permissionDecision, 'ask');
    assert.match(decision.permissionDecisionReason, /public interface/);
    assert.match(decision.permissionDecisionReason, /missing interface/);
  }

  const owned = runOwnedPathsHook(dir, { tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'Plugins/MyPlugin/Source/A.cpp') } });
  assert.equal(owned.stdout, '', 'owned paths are allowed');

  const outside = runOwnedPathsHook(dir, { tool_name: 'Write', tool_input: { file_path: path.join(os.tmpdir(), 'rfr-scratch.txt') } });
  assert.equal(outside.stdout, '', 'files outside the project are left alone');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('guard-owned-paths does nothing without an Owned paths section (#47)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-owned-hook-'));
  const edit = { tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'Source/Engine/A.cpp') } };
  assert.equal(runOwnedPathsHook(dir, edit).stdout, '', 'no AGENTS.md');
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# P\n\n## Commands\n\n- `npm test`\n');
  assert.equal(runOwnedPathsHook(dir, edit).stdout, '', 'AGENTS.md without the section');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('hooks.json runs guard-owned-paths for every file-editing tool (#47)', () => {
  const config = JSON.parse(fs.readFileSync('plugins/core/hooks/hooks.json', 'utf8'));
  const entry = config.hooks.PreToolUse.find(e => e.hooks.some(h => h.command.includes('guard-owned-paths.mjs')));
  assert.ok(entry, 'guard-owned-paths is registered');
  const matcher = new RegExp(`^(${entry.matcher})$`);
  for (const tool of ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']) assert.ok(matcher.test(tool), tool);
});

// format-on-edit defers formatting to the end of the turn (Phase 8 report, "Watch hook cost").
// Each test gets its own TMPDIR so pending lists never leak between tests or into the real temp dir.
function formatEnv() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-fmt-tmp-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-fmt-proj-'));
  const env = { ...process.env, TMPDIR: tmp, TEMP: tmp, TMP: tmp, CLAUDE_PROJECT_DIR: project };
  const run = input => spawnSync(process.execPath, [path.join(SCRIPTS, 'format-on-edit.mjs')], { input: JSON.stringify({ cwd: project, ...input }), encoding: 'utf8', env });
  const pending = () => fs.readdirSync(tmp).filter(f => f.startsWith('rfr-format-pending-'));
  const cleanup = () => {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  };
  return { tmp, project, run, pending, cleanup };
}

// A fake prettier that appends a marker line, so a test can tell whether and how often it ran.
function installFakePrettier(project) {
  const binDir = path.join(project, 'node_modules/.bin');
  fs.mkdirSync(binDir, { recursive: true });
  const js = path.join(binDir, 'fake-prettier.js');
  fs.writeFileSync(js, "const fs = require('fs'); const f = process.argv[process.argv.length - 1]; fs.appendFileSync(f, '// formatted\\n');\n");
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(binDir, 'prettier.cmd'), `@"${process.execPath}" "${js}" %*\r\n`);
  } else {
    fs.writeFileSync(path.join(binDir, 'prettier'), `#!/bin/sh\nexec "${process.execPath}" "${js}" "$@"\n`, { mode: 0o755 });
  }
}

const edit = (session, file, extra = {}) => ({ session_id: session, hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: file }, ...extra });

test('format-on-edit records edited files after each edit without changing them', () => {
  const t = formatEnv();
  installFakePrettier(t.project);
  const file = path.join(t.project, 'a.ts');
  fs.writeFileSync(file, 'const a = 1;\n');
  for (const input of [edit('s1', file), edit('s1', 'a.ts'), edit('s1', file)]) {
    const result = t.run(input);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
  }
  assert.equal(fs.readFileSync(file, 'utf8'), 'const a = 1;\n', 'PostToolUse must not format');
  assert.equal(t.pending().length, 1);
  const list = fs.readFileSync(path.join(t.tmp, t.pending()[0]), 'utf8').split('\n').filter(Boolean);
  assert.deepEqual(list, [file], 'paths are resolved and deduped');
  t.cleanup();
});

test('format-on-edit formats pending files once at Stop and clears the list', () => {
  const t = formatEnv();
  installFakePrettier(t.project);
  const a = path.join(t.project, 'a.ts');
  const b = path.join(t.project, 'b.md');
  fs.writeFileSync(a, 'a\n');
  fs.writeFileSync(b, 'b\n');
  t.run(edit('s1', a));
  t.run(edit('s1', b));
  t.run(edit('s1', a));
  const stop = t.run({ session_id: 's1', hook_event_name: 'Stop', stop_hook_active: false });
  assert.equal(stop.status, 0);
  assert.equal(stop.stdout, '', 'Stop must print nothing, so it never blocks or continues the turn');
  assert.equal(fs.readFileSync(a, 'utf8'), 'a\n// formatted\n');
  assert.equal(fs.readFileSync(b, 'utf8'), 'b\n// formatted\n');
  assert.deepEqual(t.pending(), [], 'list is cleared');
  t.run({ session_id: 's1', hook_event_name: 'Stop' });
  assert.equal(fs.readFileSync(a, 'utf8'), 'a\n// formatted\n', 'a second Stop does nothing');
  t.cleanup();
});

test("format-on-edit at SubagentStop formats only that subagent's edits", () => {
  const t = formatEnv();
  installFakePrettier(t.project);
  const main = path.join(t.project, 'main.ts');
  const sub = path.join(t.project, 'sub.ts');
  fs.writeFileSync(main, 'm\n');
  fs.writeFileSync(sub, 's\n');
  t.run(edit('s1', main));
  t.run(edit('s1', sub, { agent_id: 'agent-1', agent_type: 'general-purpose' }));
  assert.equal(t.run({ session_id: 's1', hook_event_name: 'SubagentStop', agent_id: 'agent-1' }).status, 0);
  assert.equal(fs.readFileSync(sub, 'utf8'), 's\n// formatted\n');
  assert.equal(fs.readFileSync(main, 'utf8'), 'm\n', 'the main agent is mid-turn; leave its files alone');
  t.run({ session_id: 's1', hook_event_name: 'Stop' });
  assert.equal(fs.readFileSync(main, 'utf8'), 'm\n// formatted\n');
  t.cleanup();
});

test('format-on-edit does nothing at Stop when no formatter is configured', () => {
  const t = formatEnv();
  const file = path.join(t.project, 'a.ts');
  fs.writeFileSync(file, 'x\n');
  t.run(edit('s1', file));
  t.run(edit('s1', path.join(t.project, 'gone.ts')));
  const stop = t.run({ session_id: 's1', hook_event_name: 'Stop' });
  assert.equal(stop.status, 0);
  assert.equal(stop.stdout, '');
  assert.equal(fs.readFileSync(file, 'utf8'), 'x\n');
  assert.deepEqual(t.pending(), []);
  t.cleanup();
});

test('format-on-edit keeps a separate pending list per session', () => {
  const t = formatEnv();
  installFakePrettier(t.project);
  const a = path.join(t.project, 'a.ts');
  const b = path.join(t.project, 'b.ts');
  fs.writeFileSync(a, 'a\n');
  fs.writeFileSync(b, 'b\n');
  t.run(edit('s1', a));
  t.run(edit('s2', b));
  assert.equal(t.pending().length, 2);
  t.run({ session_id: 's1', hook_event_name: 'Stop' });
  assert.equal(fs.readFileSync(a, 'utf8'), 'a\n// formatted\n');
  assert.equal(fs.readFileSync(b, 'utf8'), 'b\n', "session s2's edits wait for s2's Stop");
  assert.equal(t.pending().length, 1);
  t.cleanup();
});

test('format-on-edit never fails the turn on bad input', () => {
  const t = formatEnv();
  for (const input of [{}, { hook_event_name: 'Stop' }, { hook_event_name: 'PostToolUse', session_id: '../../etc', tool_input: { file_path: 'a.ts' } }, { hook_event_name: 'Stop', session_id: '../../etc' }]) {
    const result = t.run(input);
    assert.equal(result.status, 0, JSON.stringify(input));
    assert.equal(result.stdout, '');
  }
  for (const f of fs.readdirSync(t.tmp)) assert.ok(!f.includes('..'), f);
  t.cleanup();
});

test('hooks.json defers formatting to Stop and SubagentStop', () => {
  const config = JSON.parse(fs.readFileSync('plugins/core/hooks/hooks.json', 'utf8'));
  for (const event of ['PostToolUse', 'Stop', 'SubagentStop']) {
    const entries = config.hooks[event] ?? [];
    assert.ok(entries.some(e => e.hooks.some(h => h.command.includes('format-on-edit.mjs') && h.timeout <= 30)), event);
  }
  assert.match(config.description, /end of each turn/);
});

test("format-on-edit ignores a SubagentStop with no agent_id, such as Claude Code's internal helpers", () => {
  const t = formatEnv();
  installFakePrettier(t.project);
  const main = path.join(t.project, 'main.ts');
  fs.writeFileSync(main, 'm\n');
  t.run(edit('s1', main));
  assert.equal(t.run({ session_id: 's1', hook_event_name: 'SubagentStop' }).status, 0);
  assert.equal(fs.readFileSync(main, 'utf8'), 'm\n', 'the main agent is mid-turn; leave its files alone');
  t.run({ session_id: 's1', hook_event_name: 'Stop' });
  assert.equal(fs.readFileSync(main, 'utf8'), 'm\n// formatted\n');
  t.cleanup();
});
