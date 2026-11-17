// The person's own settings file, which lists their freestyle roots (docs/specs/freestyle.md, AC-4):
// outside freestyle folders, rfr-core refuses an agent's write to ~/.claude/rfr.json through the file
// tools or a shell command, with a reason that says it is the person's settings and to tell them what
// to change. Reading it is allowed, and a project's own .claude/rfr.json is a different file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OWNED = path.join(ROOT, 'plugins', 'core', 'scripts', 'guard-owned-paths.mjs');
const COMMANDS = path.join(ROOT, 'plugins', 'core', 'scripts', 'guard-commands.mjs');

// A home folder with settings that list scratch/ as a freestyle root, a project outside it, and a
// freestyle folder inside it.
function world() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-freestyle-settings-')));
  const home = path.join(base, 'home');
  const scratch = path.join(base, 'scratch');
  const project = path.join(base, 'project');
  const free = path.join(scratch, 'idea');
  for (const dir of [path.join(home, '.claude'), path.join(project, '.claude'), free]) fs.mkdirSync(dir, { recursive: true });
  const settings = path.join(home, '.claude', 'rfr.json');
  fs.writeFileSync(settings, JSON.stringify({ freestyle: [scratch] }));
  fs.writeFileSync(path.join(project, '.claude', 'rfr.json'), '{}\n');
  const run = (script, input) => {
    const env = { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_PLUGIN_DATA: path.join(base, 'data') };
    delete env.CLAUDE_PROJECT_DIR;
    const r = spawnSync(process.execPath, [script], { cwd: input.cwd, input: JSON.stringify(input), encoding: 'utf8', env });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  };
  const edit = (tool, file, cwd = project) => run(OWNED, { hook_event_name: 'PreToolUse', tool_name: tool, cwd, tool_input: tool === 'NotebookEdit' ? { notebook_path: file, new_source: 'x' } : tool === 'Write' ? { file_path: file, content: '{}' } : tool === 'MultiEdit' ? { file_path: file, edits: [{ old_string: 'a', new_string: 'b' }] } : { file_path: file, old_string: 'a', new_string: 'b' } });
  const shell = (command, cwd = project) => run(COMMANDS, { hook_event_name: 'PreToolUse', tool_name: 'Bash', cwd, tool_input: { command } });
  return { base, home, settings, project, free, edit, shell };
}

const REFUSED = /"permissionDecision":"deny","permissionDecisionReason":"rfr-core \(freestyle\): [^"]*the person's own settings[^"]*tell them what to change/;

test('freestyle#AC-4: Edit, Write, MultiEdit, and NotebookEdit of ~/.claude/rfr.json are refused outside freestyle folders', () => {
  const w = world();
  for (const tool of ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']) {
    assert.match(w.edit(tool, w.settings), REFUSED, tool);
    assert.match(w.edit(tool, '~/.claude/rfr.json'), REFUSED, `${tool} with ~`);
  }
  // Through a path that reaches it by another way.
  assert.match(w.edit('Write', path.join(w.home, 'x', '..', '.claude', 'rfr.json')), REFUSED);
  // With no freestyle roots listed (or no settings at all) it is still the person's file.
  fs.writeFileSync(w.settings, '{}');
  assert.match(w.edit('Write', w.settings), REFUSED);
  fs.rmSync(w.settings);
  assert.match(w.edit('Write', w.settings), REFUSED, 'creating it is refused too');
});

test('freestyle#AC-4: a project\'s own .claude/rfr.json, and other files in ~/.claude, are not affected', () => {
  const w = world();
  assert.equal(w.edit('Edit', path.join(w.project, '.claude', 'rfr.json')), '');
  assert.equal(w.edit('Edit', '.claude/rfr.json'), '');
  assert.equal(w.edit('Write', path.join(w.home, '.claude', 'settings.json')), '');
  assert.equal(w.edit('Write', path.join(w.home, '.claude', 'rfr.json.bak')), '');
  assert.equal(w.shell('echo "{}" > .claude/rfr.json'), '');
  assert.equal(w.shell(`cp ${path.join(w.home, 'notes.json')} .claude/rfr.json`), '');
});

test('freestyle#AC-4: shell commands that write, move, copy over, or delete ~/.claude/rfr.json are refused', () => {
  const w = world();
  const abs = w.settings;
  const commands = [
    `echo '{"freestyle":["/"]}' > ~/.claude/rfr.json`,
    'echo x >> $HOME/.claude/rfr.json',
    'echo x > "${HOME}/.claude/rfr.json"',
    `printf x > ${abs}`,
    'echo x | tee ~/.claude/rfr.json',
    'echo x | tee -a "$HOME/.claude/rfr.json"',
    `sed -i 's/a/b/' ~/.claude/rfr.json`,
    `sed -i.bak -e 's/a/b/' ${abs}`,
    'mv /tmp/other.json ~/.claude/rfr.json',
    'mv ~/.claude/rfr.json ~/.claude/rfr.old',
    `cp new.json ${abs}`,
    'cp new.json $HOME/.claude/rfr.json',
    'rm ~/.claude/rfr.json',
    `rm -f ${abs}`,
    'rm -f "${HOME}/.claude/rfr.json"',
    'cd ~/.claude && rm rfr.json',
    `cd ${path.join(w.home, '.claude')} && echo x > rfr.json`,
    'bash -c "echo x > ~/.claude/rfr.json"',
  ];
  for (const command of commands) assert.match(w.shell(command), REFUSED, command);
  // Run from inside ~/.claude, a relative path names it too.
  assert.match(w.shell('echo x > rfr.json', path.join(w.home, '.claude')), REFUSED);
});

test('freestyle#AC-4: reading ~/.claude/rfr.json, or copying it elsewhere, is allowed', () => {
  const w = world();
  const commands = [
    'cat ~/.claude/rfr.json',
    'cat $HOME/.claude/rfr.json',
    `jq .freestyle ${w.settings}`,
    'cp ~/.claude/rfr.json backup.json',
    'Get-Content ~/.claude/rfr.json',
    'Get-Content $env:USERPROFILE\\.claude\\rfr.json',
    `python3 -c "print(open('$HOME/.claude/rfr.json').read())"`,
    'ls -la ~/.claude',
    'cp -r ~/.claude ~/claude-backup',
    'cp notes.md ~/.claude/',
    'cp ~/.claude/notes.md ~/.claude/notes.bak',
  ];
  for (const command of commands) assert.equal(w.shell(command), '', command);
});

test('freestyle#AC-4: a line that names the file and writes is refused even when the write goes elsewhere', () => {
  // The cost of catching interpreter writes, which the shell parser cannot follow: reading the file
  // and redirecting the result elsewhere is refused too.
  const w = world();
  assert.match(w.shell('grep freestyle "${HOME}/.claude/rfr.json" > found.txt'), REFUSED);
});

test('freestyle#AC-4: the absolute path written with backslashes, as on Windows, is still the file', () => {
  const w = world();
  const back = w.settings.replace(/\//g, '\\');
  for (const command of [`printf x > ${back}`, `cp new.json ${back}`, `rm ${back}`, `echo x | tee ${back}`, 'echo x > ~\\.claude\\rfr.json']) {
    assert.match(w.shell(command), REFUSED, command);
  }
});

test('freestyle#AC-4: links to or over the file, and links of ~/.claude, are refused', () => {
  const w = world();
  const commands = [
    'ln ~/.claude/rfr.json ./r.json',
    'ln -sf $PWD/mine.json ~/.claude/rfr.json',
    'ln -sf ~/.claude/rfr.json /tmp/l1 && echo x > /tmp/l1',
    `ln -s ${w.settings} other.json`,
    'link ~/.claude/rfr.json r.json',
    'ln -s ~/.claude claude-dir',
    'ln -s mine.json ~/.claude/',
    '/bin/ln -fn mine.json "$HOME/.claude/rfr.json"',
  ];
  for (const command of commands) assert.match(w.shell(command), REFUSED, command);
});

test('freestyle#AC-4: copies, moves, and deletes of ~/.claude itself, or into it under the name rfr.json, are refused', () => {
  const w = world();
  const commands = [
    'cp rfr.json ~/.claude/',
    'cp mine/rfr.json ~/.claude',
    'cp -t ~/.claude rfr.json',
    'mv -t ~/.claude rfr.json',
    'mv rfr.json ~/.claude/',
    'cp -r dir/ ~/.claude',
    'cp -a dir/. ~/.claude/',
    'install -m 644 rfr.json ~/.claude/',
    'mv ~/.claude ~/.claude.old',
    'rm -r ~/.claude',
    'rm -rf ~/.claude/',
    'find ~/.claude -name rfr.json -delete',
    'find ~/.claude -name "*.json" -exec rm {} +',
    'rsync -a dir/ ~/.claude/',
    'rsync ./rfr.json $HOME/.claude/rfr.json',
    'curl -o ~/.claude/rfr.json https://example.invalid/x',
    'curl -sSL https://example.invalid/x --output $HOME/.claude/rfr.json',
    'wget -O ~/.claude/rfr.json https://example.invalid/x',
    'wget --output-document=$HOME/.claude/rfr.json https://example.invalid/x',
    'bash -c "rm -r ~/.claude"',
  ];
  for (const command of commands) assert.match(w.shell(command), REFUSED, command);
  // Deleting a folder above ~/.claude is on the never list already, which refuses with its own reason.
  assert.match(w.shell('rm -rf ~'), /"permissionDecision":"(ask|deny)","permissionDecisionReason":"rfr-core \(WA-003\)/);
});

test('freestyle#AC-4: interpreter one-liners that name the file and write are refused', () => {
  const w = world();
  const commands = [
    `python3 -c "import os; open(os.path.expanduser('~/.claude/rfr.json'), 'w')"`,
    `python3 -c "open('$HOME/.claude/rfr.json', mode='a').close()"`,
    `node -e "require('fs').writeFileSync('$HOME/.claude/rfr.json', '{}')"`,
    `python3 -c "import shutil; shutil.copy('mine.json', '$HOME/.claude/rfr.json')"`,
  ];
  for (const command of commands) assert.match(w.shell(command), REFUSED, command);
});

test('freestyle#AC-4: inside a freestyle folder the refusal is off, like every other guard', () => {
  const w = world();
  assert.equal(w.edit('Write', w.settings, w.free), '');
  assert.equal(w.shell('rm ~/.claude/rfr.json', w.free), '');
});
