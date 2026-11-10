// Paths in shell commands as each platform's shell reads them (docs/specs/guard-tiers.md AC-13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decideCommand, resolveFromShell } from '../plugins/core/scripts/guard-commands.mjs';
import { anonymiser, pathForms } from '../checks/guard-replay.mjs';

const WIN = process.platform === 'win32';
const sh = p => p.split(path.sep).join('/');
const msys = p => sh(p).replace(/^([A-Za-z]):/, (m, d) => `/${d.toLowerCase()}`);

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-ac13-'));
  const git = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...a], { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'core.autocrlf', 'false');
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'a.ts'), 'a\n');
  git('add', '.'); git('commit', '-q', '-m', 'base');
  return dir;
}

test('guard-tiers#AC-13: Git Bash drive paths and /tmp map to the folders they name on Windows only', () => {
  if (WIN) {
    assert.equal(resolveFromShell('C:\\work', '/c/Users/me'), 'C:\\Users\\me');
    assert.equal(resolveFromShell('C:\\work', '/d'), 'D:\\');
    assert.equal(resolveFromShell('C:\\work', '/tmp/x'), path.join(os.tmpdir(), 'x'));
    assert.equal(resolveFromShell('C:\\work', 'C:/Users/me'), 'C:\\Users\\me');
    assert.equal(resolveFromShell('C:\\work', '/cache/x'), path.resolve('C:\\work', '/cache/x'), 'a longer first segment is not a drive');
  } else {
    assert.equal(resolveFromShell('/work', '/c/Users/me'), '/c/Users/me');
    assert.equal(resolveFromShell('/work', '/tmp/x'), '/tmp/x');
  }
});

test('guard-tiers#AC-13: a restore command for another folder is "git -C <root> restore", and it restores the file', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, 'src', 'a.ts'), 'changed\n');
  const decision = decideCommand('git checkout -- .', { cwd: path.join(dir, 'src') });
  assert.equal(decision?.decision, 'inform');
  const undo = decision.reason.match(/to undo it: (.*?) \(kept as /)[1];
  assert.match(undo, /^git -C \S+ restore --source=[0-9a-f]+ --worktree -- src$/);
  assert.doesNotMatch(undo, /git -C \S+ git /);
  spawnSync('git', ['checkout', '--', '.'], { cwd: path.join(dir, 'src') });
  assert.equal(fs.readFileSync(path.join(dir, 'src', 'a.ts'), 'utf8'), 'a\n');
  const r = spawnSync('bash', ['-c', undo], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(path.join(dir, 'src', 'a.ts'), 'utf8'), 'changed\n');
});

test('guard-tiers#AC-13: on Windows, a /c/ path inside a repository gets the same snapshot as a native one', { skip: !WIN && 'Windows paths' }, () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, 'src', 'a.ts'), 'changed\n');
  for (const form of [sh(dir), msys(dir)]) {
    assert.equal(decideCommand(`rm -rf ${form}/src`, { cwd: dir })?.decision, 'inform', form);
    assert.equal(decideCommand(`cd ${form} && git checkout -- .`, { cwd: os.homedir() })?.decision, 'inform', form);
  }
});

test('guard-tiers#AC-13: on Windows, drive roots, system folders, the home folder, and /tmp itself still ask', { skip: !WIN && 'Windows paths' }, () => {
  const cwd = process.cwd();
  for (const command of ['rm -rf /c', 'rm -rf /c/', 'rm -rf /c/Windows', 'rm -rf /d/data', `rm -rf ${msys(os.homedir())}`, `rm -rf ${msys(os.homedir())}/project`, 'rm -rf /tmp', 'rm -rf C:/', 'rm -rf "C:\\Windows"', 'cd /c && rm -rf Windows', 'git -C /c/ clean -fdx']) {
    assert.equal(decideCommand(command, { cwd })?.decision, 'ask', command);
  }
});

test('guard-tiers#AC-13: the replay anonymiser replaces each written form of a Windows path, and keeps POSIX paths', () => {
  assert.deepEqual(pathForms('C:\\Users\\me\\proj', 'win32'), ['C:\\Users\\me\\proj', 'C:/Users/me/proj', '/c/Users/me/proj']);
  assert.deepEqual(pathForms('/work/proj', 'win32'), ['/work/proj']);
  assert.deepEqual(pathForms('/work/proj', 'linux'), ['/work/proj']);
  const anon = anonymiser('C:\\Users\\me\\proj', { home: 'C:\\Users\\me', tmp: 'C:\\Users\\me\\AppData\\Local\\Temp', platform: 'win32' });
  assert.equal(anon('cd /c/Users/me/proj/src && type C:\\Users\\me\\proj\\a.js C:/Users/me/proj/b.js C:/Users/me/.ssh/x /c/Users/me/AppData/Local/Temp/t'),
    'cd $REPO/src && type $REPO\\a.js $REPO/b.js $HOME/.ssh/x $TMP/t');
  assert.equal(anon('C:/Users/me/project-two/x'), '$HOME/project-two/x', 'a longer name is not the project');
});
