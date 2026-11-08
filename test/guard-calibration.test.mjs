// Guard calibration, round 2: false positives found while building PR #143 (2026-11-08), and the
// guard decision log. Each case here was a real prompt or refusal that protected nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decideCommand } from '../plugins/core/scripts/guard-commands.mjs';
import { decideEdit } from '../plugins/core/scripts/guard-test-edits.mjs';

const REPO = path.resolve('.');
const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-calib-'));

test('rm -rf of a folder inside the temp directory does not ask, including through a variable set in the same command', () => {
  const dir = scratch();
  fs.mkdirSync(path.join(dir, 'wt'));
  for (const command of [
    `rm -rf ${dir}/wt`,
    `R=${dir}; rm -rf $R/wt; mkdir -p $R/wt`,
    `R=${dir} && rm -rf "\${R}/wt"`,
  ]) assert.equal(decideCommand(command, { cwd: REPO }), null, command);
});

test('rm -rf inside a git repository under the temp directory still gets the git checks', () => {
  const dir = scratch();
  spawnSync('git', ['init', '-q'], { cwd: dir });
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'x\n');
  spawnSync('git', ['add', '.'], { cwd: dir });
  // The staged files are in no commit, so the guard takes a snapshot first (guard tiers AC-11).
  const decision = decideCommand(`rm -rf ${dir}/src`, { cwd: dir });
  assert.equal(decision?.decision, 'inform');
  assert.match(decision.reason, /took a snapshot/);
});

test('rm -rf still asks for the temp directory itself, an escape from it, an unknown variable, or a path outside it', () => {
  const dir = scratch();
  for (const command of [
    `rm -rf ${os.tmpdir()}`,
    `rm -rf ${dir}/../..`,
    `rm -rf ${path.join(os.tmpdir(), 'some-tool-workspace')}`,
    'rm -rf $SOMEWHERE/wt',
    `R=$(pwd); rm -rf $R/wt`,
    `rm -rf ${os.homedir()}/project`,
    'rm -rf /',
  ]) assert.match(decideCommand(command, { cwd: REPO })?.reason ?? '', /recursive forced delete/, command);
});

test('a script that only mentions a test path in its text is not a write to that test', () => {
  // The shape of the refused command: a Python heredoc editing CHANGELOG.md whose new text names a test file in Markdown backticks.
  const command = `python3 - <<'EOF'
p='CHANGELOG.md'; s=open(p).read()
add="""### Fixed

- the guard now asks before \`tool_input.decrypt\` reads;
- \`test/hooks.test.mjs\` has rows for each.
"""
s=s.replace("old", add)
open(p,'w').write(s)
EOF`;
  assert.equal(decideCommand(command, { cwd: REPO }), null);
});

test('scripts that do write a test file are still caught', () => {
  for (const command of [
    `python3 -c "p='test/hooks.test.mjs'; s=open(p).read(); open(p,'w').write(s)"`,
    `python3 - <<'EOF'\nfor p in ['test/hooks.test.mjs', 'test/plan.test.mjs']:\n    open(p, 'w').write('')\nEOF`,
    "node -e \"require('fs').writeFileSync(`test/hooks.test.mjs`, '')\"",
    `python3 - <<'EOF'\nfrom pathlib import Path\nPath('test/hooks.test.mjs').write_text('')\nEOF`,
  ]) assert.equal(decideCommand(command, { cwd: REPO })?.decision, 'deny', command);
});

function repoWithBranch() {
  const dir = scratch();
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  fs.mkdirSync(path.join(dir, 'test'));
  const file = path.join(dir, 'test', 'a.test.mjs');
  fs.writeFileSync(file, "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\n\ntest('adds', () => {\n  assert.equal(1 + 1, 2);\n});\n");
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  git('checkout', '-q', '-b', 'feature');
  return { dir, file };
}

const edit = (dir, file, old_string, new_string) => decideEdit({ tool_name: 'Edit', cwd: dir, tool_input: { file_path: file, old_string, new_string } });

test('editing a test line added on this branch does not ask, because no existing test changes', () => {
  const { dir, file } = repoWithBranch();
  fs.appendFileSync(file, "\ntest('new', () => {\n  assert.equal(String(2), '2');\n});\n");
  // The agent rewrites an assertion it added itself, before anything was committed or reviewed.
  assert.equal(edit(dir, file, "assert.equal(String(2), '2');", "assert.equal(String(3), '3');"), null);
});

test('weakening a test that exists on the base branch still asks', () => {
  const { dir, file } = repoWithBranch();
  fs.appendFileSync(file, "\ntest('new', () => {\n  assert.equal(String(2), '2');\n});\n");
  assert.match(edit(dir, file, 'assert.equal(1 + 1, 2);', 'assert.equal(1 + 1, 3);')?.reason ?? '', /existing test/);
});

test('after an approved weakening, later edits that add nothing new to it do not ask again', () => {
  const { dir, file } = repoWithBranch();
  // An earlier, approved edit changed the base assertion, and a new test was added.
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('assert.equal(1 + 1, 2);', 'assert.equal(1 + 1, 3);') + "\ntest('new', () => {\n  assert.ok(true);\n});\n");
  assert.equal(edit(dir, file, 'assert.ok(true);', "assert.equal(typeof 1, 'number');"), null);
  // A further weakening of base content still asks.
  assert.match(edit(dir, file, "test('adds', () => {", "test.skip('adds', () => {")?.reason ?? '', /existing test/);
});

test('each ask is written to the decision log, without the command or file contents', () => {
  const data = scratch();
  const r = spawnSync(process.execPath, ['plugins/core/scripts/guard-commands.mjs'], {
    input: JSON.stringify({ session_id: 's1', tool_name: 'Bash', cwd: REPO, tool_input: { command: 'git push --force origin main' } }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_DATA: data },
  });
  assert.match(r.stdout, /"permissionDecision":"ask"/);
  const lines = fs.readFileSync(path.join(data, 'guard-decisions.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  assert.equal(lines.length, 1);
  assert.deepEqual(Object.keys(lines[0]).sort(), ['decision', 'hook', 'reason', 'session', 'time', 'tool']);
  assert.deepEqual([lines[0].hook, lines[0].tool, lines[0].decision, lines[0].session], ['guard-commands', 'Bash', 'ask', 's1']);
  assert.doesNotMatch(JSON.stringify(lines[0]), /origin main/);

  // RFR_GUARD_LOG=0 turns it off.
  const off = scratch();
  spawnSync(process.execPath, ['plugins/core/scripts/guard-commands.mjs'], {
    input: JSON.stringify({ tool_name: 'Bash', cwd: REPO, tool_input: { command: 'git push --force origin main' } }),
    env: { ...process.env, CLAUDE_PLUGIN_DATA: off, RFR_GUARD_LOG: '0' },
  });
  assert.equal(fs.existsSync(path.join(off, 'guard-decisions.jsonl')), false);
});
