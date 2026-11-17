// In a freestyle folder rfr does nothing (docs/specs/freestyle.md, AC-2): every hook of rfr-core and
// rfr-process exits with no output and no log line, for an input that would otherwise refuse, ask,
// defer, add context, or format. In a repository with a remote under the same root, each hook's
// output is what it is without any freestyle settings. The domain plugins' hooks are tested in
// plugins/<name>/test/freestyle-stand-down.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CORE = path.join(ROOT, 'plugins', 'core', 'scripts');
const PROCESS = path.join(ROOT, 'plugins', 'process', 'scripts');

// A home folder whose ~/.claude/rfr.json lists scratch/ as a freestyle root, a plain folder in it
// (freestyle), and a git repository with a remote in it (not freestyle). bareHome has no settings.
function world() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-freestyle-hooks-')));
  const home = path.join(base, 'home');
  const bareHome = path.join(base, 'bare-home');
  const scratch = path.join(base, 'scratch');
  for (const dir of [path.join(home, '.claude'), bareHome, scratch]) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'rfr.json'), JSON.stringify({ freestyle: [scratch] }));
  const free = path.join(scratch, 'idea');
  const real = path.join(scratch, 'cloned');
  fs.mkdirSync(free);
  fs.mkdirSync(real);
  const git = (dir, ...args) => {
    const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  git(real, 'init', '-q');
  git(real, 'remote', 'add', 'origin', 'https://example.invalid/cloned.git');
  const write = (dir, file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  let n = 0;
  // Runs a hook script with the given input; each run gets its own data and temp folders, so the
  // decision log and pending lists can be inspected.
  const run = (script, input, { settings = true, extraEnv = {} } = {}) => {
    const data = path.join(base, `data-${++n}`);
    const tmp = path.join(base, `tmp-${n}`);
    fs.mkdirSync(tmp, { recursive: true });
    const env = { ...process.env, HOME: settings ? home : bareHome, USERPROFILE: settings ? home : bareHome, CLAUDE_PLUGIN_DATA: data, TMPDIR: tmp, TEMP: tmp, TMP: tmp, ...extraEnv };
    delete env.CLAUDE_PROJECT_DIR;
    delete env.RFR_GUARD_LOG;
    const r = spawnSync(process.execPath, [script], { cwd: input.cwd, input: JSON.stringify(input), encoding: 'utf8', env });
    assert.equal(r.status, 0, r.stderr);
    const log = path.join(data, 'guard-decisions.jsonl');
    return { stdout: r.stdout, logged: fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '', pending: fs.readdirSync(tmp).filter(f => f.startsWith('rfr-format-pending-')) };
  };
  return { base, home, scratch, free, real, git, write, run };
}

// The hook says nothing and logs nothing in the freestyle folder; in the repository with a remote it
// gives the same, non-empty output with and without the freestyle settings.
function standsDown(w, script, inputFor, expected, { logs = true, prepare = () => {} } = {}) {
  prepare(w.free);
  const free = w.run(script, inputFor(w.free));
  assert.equal(free.stdout, '', `${path.basename(script)} printed in a freestyle folder`);
  assert.equal(free.logged, '', `${path.basename(script)} logged in a freestyle folder`);
  prepare(w.real);
  const withSettings = w.run(script, inputFor(w.real));
  prepare(w.real);
  const without = w.run(script, inputFor(w.real), { settings: false });
  assert.match(withSettings.stdout, expected);
  assert.equal(withSettings.stdout, without.stdout, 'outside a freestyle folder the output is unchanged');
  if (logs) assert.notEqual(withSettings.logged, '', 'outside a freestyle folder the decision is logged');
}

test('freestyle#AC-2: guard-commands stands down in a freestyle folder', () => {
  const w = world();
  standsDown(w, path.join(CORE, 'guard-commands.mjs'), cwd => ({ hook_event_name: 'PreToolUse', tool_name: 'Bash', cwd, tool_input: { command: 'npx vitest -u' } }), /"permissionDecision":"deny".*updates test snapshots/);
  // A command on the never list too.
  standsDown(w, path.join(CORE, 'guard-commands.mjs'), cwd => ({ hook_event_name: 'PreToolUse', tool_name: 'Bash', cwd, tool_input: { command: 'gh pr review 12 --approve' } }), /agents do not approve pull requests/);
});

test('freestyle#AC-2: guard-mcp-tools stands down in a freestyle folder, so an outside service can be used there', () => {
  const w = world();
  standsDown(w, path.join(CORE, 'guard-mcp-tools.mjs'), cwd => ({ hook_event_name: 'PreToolUse', tool_name: 'mcp__Higgsfield__generate_image', cwd, tool_input: { prompt: 'a cat' } }), /"permissionDecision":"deny".*generate image through Higgsfield/);
  standsDown(w, path.join(CORE, 'guard-mcp-tools.mjs'), cwd => ({ hook_event_name: 'PreToolUse', tool_name: 'mcp__Google_Drive__create_file', cwd, tool_input: {} }), /create file through Google Drive/);
});

test('freestyle#AC-2: guard-pr-approval stands down in a freestyle folder', () => {
  const w = world();
  standsDown(w, path.join(CORE, 'guard-pr-approval.mjs'), cwd => ({ hook_event_name: 'PreToolUse', tool_name: 'mcp__github__pull_request_review_write', cwd, tool_input: { method: 'create', event: 'APPROVE' } }), /agents do not approve pull requests/);
});

test('freestyle#AC-2: guard-test-edits stands down in a freestyle folder', () => {
  const w = world();
  const prepare = dir => w.write(dir, 'src/sum.test.mjs', "test('sums', () => { assert.equal(sum(1, 2), 3); });\n");
  // An edit the hook cannot apply to the file is deferred to the pull request with context.
  standsDown(w, path.join(CORE, 'guard-test-edits.mjs'), cwd => ({ hook_event_name: 'PreToolUse', tool_name: 'Edit', cwd, tool_input: { file_path: path.join(cwd, 'src/sum.test.mjs'), old_string: 'not in the file', new_string: '' } }), /"additionalContext":".*is an existing test/, { prepare });
});

test('freestyle#AC-2: guard-owned-paths stands down in a freestyle folder', () => {
  const w = world();
  const prepare = dir => w.write(dir, 'AGENTS.md', '# Project\n\n## Owned paths\n\n- `src/**`\n');
  standsDown(w, path.join(CORE, 'guard-owned-paths.mjs'), cwd => ({ hook_event_name: 'PreToolUse', tool_name: 'Edit', cwd, tool_input: { file_path: path.join(cwd, 'vendor/lib.js'), old_string: 'a', new_string: 'b' } }), /"permissionDecision":"deny".*is not in the \\"Owned paths\\" list/, { prepare });
});

// A fake prettier that appends a marker line, as the format-on-edit tests use.
function installFakePrettier(dir) {
  const bin = path.join(dir, 'node_modules', '.bin');
  fs.mkdirSync(bin, { recursive: true });
  const js = path.join(bin, 'fake-prettier.js');
  fs.writeFileSync(js, "const fs = require('fs'); fs.appendFileSync(process.argv[process.argv.length - 1], '// formatted\\n');\n");
  if (process.platform === 'win32') fs.writeFileSync(path.join(bin, 'prettier.cmd'), `@"${process.execPath}" "${js}" %*\r\n`);
  else fs.writeFileSync(path.join(bin, 'prettier'), `#!/bin/sh\nexec "${process.execPath}" "${js}" "$@"\n`, { mode: 0o755 });
}

test('freestyle#AC-2: format-on-edit neither records nor formats edits in a freestyle folder', () => {
  const w = world();
  const script = path.join(CORE, 'format-on-edit.mjs');
  const turn = (dir, settings) => {
    installFakePrettier(dir);
    const file = path.join(dir, 'app.js');
    fs.writeFileSync(file, 'const a = 1;\n');
    const tmp = fs.mkdtempSync(path.join(w.base, 'turn-'));
    const extraEnv = { TMPDIR: tmp, TEMP: tmp, TMP: tmp };
    const edit = w.run(script, { session_id: 's1', hook_event_name: 'PostToolUse', tool_name: 'Edit', cwd: dir, tool_input: { file_path: file } }, { settings, extraEnv });
    const recorded = fs.readdirSync(tmp).filter(f => f.startsWith('rfr-format-pending-'));
    const stop = w.run(script, { session_id: 's1', hook_event_name: 'Stop', cwd: dir }, { settings, extraEnv });
    return { output: edit.stdout + stop.stdout, logged: edit.logged + stop.logged, recorded, text: fs.readFileSync(file, 'utf8') };
  };
  const free = turn(w.free, true);
  assert.deepEqual(free, { output: '', logged: '', recorded: [], text: 'const a = 1;\n' });
  const real = turn(w.real, true);
  assert.equal(real.text, 'const a = 1;\n// formatted\n');
  assert.equal(real.recorded.length, 1);
  assert.deepEqual(turn(w.real, false), real, 'outside a freestyle folder the formatter runs as before');
});

function processProject(w, dir) {
  const front = (id, status, links) => `---\nid: ${id}\nstatus: ${status}\nderived-from:\n${links.map(l => `  - ${l}\n`).join('')}---\n\n# ${id}\n`;
  w.write(dir, 'docs/product/process.yml', 'mode: solo\ndefault: [lead]\n');
  w.write(dir, 'docs/product/stories/sign-in.md', front('story-sign-in', 'approved', []));
}

test('freestyle#AC-2: guard-stages says nothing in a freestyle folder, and refuses as before in a real project', () => {
  const w = world();
  const input = cwd => ({ hook_event_name: 'PreToolUse', tool_name: 'Write', cwd, tool_input: { file_path: path.join(cwd, 'docs/specs/sign-in.md'), content: '---\nid: spec-sign-in\nstatus: draft\nderived-from:\n  - story-sign-in\n---\n\n# Sign in\n' } });
  // In the freestyle folder there is no process.yml (with one it would not be freestyle).
  standsDown(w, path.join(PROCESS, 'guard-stages.mjs'), input, /"permissionDecision":"deny".*rfr-process \(stage order\)/, { logs: false, prepare: dir => { if (dir === w.real) processProject(w, dir); } });
});

test('freestyle#AC-2: process-next adds no context in a freestyle folder, and does as before in a real project', () => {
  const w = world();
  standsDown(w, path.join(PROCESS, 'process-next.mjs'), cwd => ({ hook_event_name: 'SessionStart', cwd }), /"additionalContext":/, { logs: false, prepare: dir => { if (dir === w.real) processProject(w, dir); } });
});

test('freestyle#AC-2: the delivery Stop hook does not hold a session in a freestyle folder', () => {
  const w = world();
  const prepare = dir => {
    if (!fs.existsSync(path.join(dir, '.git'))) w.git(dir, 'init', '-q');
    w.git(dir, 'symbolic-ref', 'HEAD', 'refs/heads/feature/try');
    if (spawnSync('git', ['rev-parse', '--verify', '-q', 'HEAD'], { cwd: dir }).status !== 0) w.git(dir, 'commit', '-q', '--allow-empty', '-m', 'start');
    // A delivery run under way on this branch, with nothing done yet.
    fs.writeFileSync(path.join(w.git(dir, 'rev-parse', '--absolute-git-dir'), 'rfr-delivery.json'), JSON.stringify({ branch: 'feature/try' }));
  };
  standsDown(w, path.join(PROCESS, 'delivery.mjs'), cwd => ({ hook_event_name: 'Stop', cwd }), /"decision":"block".*the delivery run on feature\/try is not finished/, { logs: false, prepare });
});

test('freestyle#AC-2: every hook script of every plugin checks for a freestyle folder before anything else', () => {
  const plugins = ['core', 'process', 'web', 'unreal', 'android'];
  const scripts = new Set();
  for (const plugin of plugins) {
    const hooks = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugins', plugin, 'hooks', 'hooks.json'), 'utf8')).hooks;
    for (const groups of Object.values(hooks)) {
      for (const group of groups) {
        for (const hook of group.hooks) {
          const m = /scripts\/([\w-]+\.mjs)/.exec(hook.command);
          assert.ok(m, hook.command);
          scripts.add(path.join(ROOT, 'plugins', plugin, 'scripts', m[1]));
        }
      }
    }
  }
  assert.ok(scripts.size >= 13, `found ${scripts.size} hook scripts`);
  for (const script of scripts) {
    const text = fs.readFileSync(script, 'utf8');
    const rel = path.relative(ROOT, script);
    assert.match(text, /import \{[^}]*\bisFreestyle\b[^}]*\} from '\.\/freestyle-lib\.mjs';/, `${rel} imports isFreestyle`);
    const main = text.slice(text.indexOf('async function main'));
    assert.ok(main.length > 0 && /\bisFreestyle\(/.test(main), `${rel} calls isFreestyle in main`);
    assert.ok(fs.existsSync(path.join(path.dirname(script), 'freestyle-lib.mjs')), `${rel} has freestyle-lib.mjs beside it`);
  }
});
