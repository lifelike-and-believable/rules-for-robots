// Tests for the guard-owned-paths hook (rfr-core). Moved from hooks.test.mjs (rewrite plan 25e,
// verify inventory slice f).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPTS = path.resolve('plugins/core/scripts');

function runOwnedPathsHook(projectDir, input) {
  return spawnSync(process.execPath, [path.join(SCRIPTS, 'guard-owned-paths.mjs')], {
    input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  });
}

test('guard-owned-paths refuses edits outside the owned paths, with a next step (#47)', () => {
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
    assert.equal(decision.permissionDecision, 'deny');
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
