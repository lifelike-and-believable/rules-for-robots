// Tests for the format-on-edit hook (rfr-core): which formatter it uses, and formatting deferred to
// the end of the turn. Moved from hooks.test.mjs (rewrite plan 25e, verify inventory slice f).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chooseFormatter } from '../plugins/core/scripts/format-on-edit.mjs';

const SCRIPTS = path.resolve('plugins/core/scripts');

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
