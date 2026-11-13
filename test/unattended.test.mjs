// Unattended runs (docs/specs/unattended.md): no guard prompts or asks during the run; the never list
// is refused with a reason the agent acts on; test edits never interrupt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decideEdit } from '../plugins/core/scripts/guard-test-edits.mjs';
import { decideCommand } from '../plugins/core/scripts/guard-commands.mjs';

const corpus = JSON.parse(fs.readFileSync('test/fixtures/guard-corpus.json', 'utf8')).cases;

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-unattended-'));
  const git = (...args) => spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' });
  fs.mkdirSync(path.join(dir, 'tests'));
  fs.writeFileSync(path.join(dir, 'tests', 'a.test.ts'), "import { test, expect } from 'vitest';\n\ntest('a', () => {\n  expect(1 + 1).toBe(2);\n});\n");
  fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), '# Changelog\n\n## [1.0.0] - 2026-11-12\n');
  git('init', '-q', '-b', 'main');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  git('switch', '-q', '-c', 'feature');
  return dir;
}

function transcript(...messages) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-unattended-t-')), 's.jsonl');
  fs.writeFileSync(file, messages.map((m, k) => JSON.stringify({ type: 'user', origin: { kind: 'human' }, timestamp: new Date(Date.UTC(2026, 10, 12, 3, 0, k)).toISOString(), message: { content: m } })).join('\n') + '\n');
  return file;
}

const hook = (script, input, env = {}) => {
  const r = spawnSync(process.execPath, [script], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_DATA: fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-unattended-d-')), ...env } });
  return r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput : null;
};

test('unattended#AC-1: no guard prompts for any action the corpus once asked about', () => {
  const dir = repo();
  const cases = corpus.filter(c => c.tier === 4 && c.guard === 'commands' && !c.pending);
  assert.ok(cases.length >= 10);
  for (const c of cases) {
    const out = hook('plugins/core/scripts/guard-commands.mjs', { session_id: 's', tool_name: 'Bash', cwd: dir, tool_input: { command: c.command.replace('$TMPCASE', os.tmpdir()) } });
    assert.notEqual(out?.permissionDecision, 'ask', c.id);
  }
  for (const c of corpus.filter(x => x.tier === 4 && x.guard === 'mcp')) {
    const out = hook('plugins/web/scripts/guard-mcp.mjs', { session_id: 's', tool_name: c.tool_name, tool_input: c.tool_input, cwd: dir });
    assert.equal(out?.permissionDecision, 'deny', c.id);
  }
});

test('unattended#AC-2: a never-list action is refused with what to do instead, and a yes in chat does not unlock it', () => {
  const dir = repo();
  const file = transcript('carry on');
  const input = { session_id: 's', tool_name: 'Bash', cwd: dir, transcript_path: file, tool_input: { command: 'git push --force origin feature' } };
  const first = hook('plugins/core/scripts/guard-commands.mjs', input);
  assert.equal(first.permissionDecision, 'deny');
  assert.match(first.permissionDecisionReason, /push to a new branch/);
  assert.match(first.permissionDecisionReason, /set that part aside, record what it needs and why in the pull request's ## Decisions section, and carry on/);
  fs.appendFileSync(file, `${JSON.stringify({ type: 'user', origin: { kind: 'human' }, timestamp: '2026-11-12T04:00:00Z', message: { content: 'yes, go ahead' } })}\n`);
  assert.equal(hook('plugins/core/scripts/guard-commands.mjs', input).permissionDecision, 'deny');
});

test('unattended#AC-5: test edits never interrupt the person', () => {
  const dir = repo();
  const file = path.join(dir, 'tests', 'a.test.ts');
  const edit = (old_string, new_string) => decideEdit({ tool_name: 'Edit', cwd: dir, tool_input: { file_path: file, old_string, new_string } });
  for (const d of [edit('toBe(2)', 'toBe(3)'), edit('no such text', 'x')]) assert.notEqual(d?.decision, 'ask');
  for (const command of ['git rm tests/a.test.ts', 'mv tests/a.test.ts tests/b.test.ts']) {
    assert.notEqual(decideCommand(command, { cwd: dir })?.decision, 'ask', command);
  }
  // The guard hook prints no permission decision for a weakening edit: it goes ahead with context.
  const out = hook('plugins/core/scripts/guard-test-edits.mjs', { session_id: 's', tool_name: 'Edit', cwd: dir, tool_input: { file_path: file, old_string: 'toBe(2)', new_string: 'toBe(3)' } });
  assert.equal(out?.permissionDecision, undefined);
});
