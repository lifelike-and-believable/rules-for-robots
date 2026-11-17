// In a freestyle folder rfr does nothing (docs/specs/freestyle.md, AC-2): rfr-android's guard exits with no output
// and no log line there, and is unchanged in a repository with a remote.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPTS = path.resolve(import.meta.dirname, '..', 'scripts');

// A home folder whose ~/.claude/rfr.json lists scratch/ as a freestyle root, a plain folder in it
// (freestyle), and a git repository with a remote in it (not freestyle). bareHome has no settings.
function world() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-freestyle-android-')));
  const home = path.join(base, 'home');
  const bareHome = path.join(base, 'bare-home');
  const scratch = path.join(base, 'scratch');
  const free = path.join(scratch, 'idea');
  const real = path.join(scratch, 'cloned');
  for (const dir of [path.join(home, '.claude'), bareHome, free, real]) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'rfr.json'), JSON.stringify({ freestyle: [scratch] }));
  for (const args of [['init', '-q'], ['remote', 'add', 'origin', 'https://example.invalid/cloned.git']]) {
    assert.equal(spawnSync('git', args, { cwd: real }).status, 0);
  }
  let n = 0;
  const run = (script, input, { settings = true } = {}) => {
    const data = path.join(base, `data-${++n}`);
    const env = { ...process.env, HOME: settings ? home : bareHome, USERPROFILE: settings ? home : bareHome, CLAUDE_PLUGIN_DATA: data };
    delete env.CLAUDE_PROJECT_DIR;
    delete env.RFR_GUARD_LOG;
    delete env.ANDROID_SERIAL;
    const r = spawnSync(process.execPath, [path.join(SCRIPTS, script)], { cwd: input.cwd, input: JSON.stringify(input), encoding: 'utf8', env });
    assert.equal(r.status, 0, r.stderr);
    const log = path.join(data, 'guard-decisions.jsonl');
    return { stdout: r.stdout, logged: fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '' };
  };
  return { free, real, run };
}

// Nothing printed or logged in the freestyle folder; in the repository with a remote, the same
// non-empty output with and without the freestyle settings, and the decision logged.
function standsDown(script, inputFor, expected) {
  const w = world();
  const free = w.run(script, inputFor(w.free));
  assert.deepEqual(free, { stdout: '', logged: '' });
  const withSettings = w.run(script, inputFor(w.real));
  assert.match(withSettings.stdout, expected);
  assert.equal(withSettings.stdout, w.run(script, inputFor(w.real), { settings: false }).stdout);
  assert.notEqual(withSettings.logged, '');
}

test('freestyle#AC-2: guard-adb stands down in a freestyle folder', () => {
  standsDown('guard-adb.mjs', cwd => ({ hook_event_name: 'PreToolUse', tool_name: 'Bash', cwd, tool_input: { command: 'adb -s TV0123 install app.apk' } }), /"permissionDecision":"deny".*rfr-android/);
});
