// rm -rf of a folder the same command line made in a temp folder (default-allow AC-2, refined
// 2026-11-12): a cloud session's "cp -r . /var/tmp/check && cd /var/tmp/check && rm -rf node_modules
// */node_modules && ... && cd / && rm -rf /var/tmp/check" deletes only its own throwaway copy, so it
// is not a named ask. Anything that was there before the line, or that a target escapes to, still asks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decideCommand } from '../plugins/core/scripts/guard-commands.mjs';

// A path as a shell writes it: forward slashes, which bash on Windows keeps.
const sh = p => p.split(path.sep).join('/');

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-own-scratch-repo-'));
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
  const git = (...args) => spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  return dir;
}

// A folder name directly under the temp folder that does not exist yet.
const fresh = () => path.join(os.tmpdir(), `rfr-own-scratch-copy-${process.pid}-${Math.random().toString(36).slice(2)}`);

test('default-allow#AC-2: a temp folder the same line copied the repository into can be deleted without asking', () => {
  const dir = repo();
  const copy = sh(fresh());
  const line = `cp -r . ${copy} && cd ${copy} && rm -rf node_modules */node_modules && (npx -y pnpm install --frozen-lockfile 2>&1 | tail -4); cd / && rm -rf ${copy}`;
  assert.equal(decideCommand(line, { cwd: dir })?.decision, undefined, line);
  for (const made of [`mkdir -p ${sh(fresh())}`, `git clone -q https://example.com/r.git ${sh(fresh())}`, `git worktree add ${sh(fresh())} -b scratch`]) {
    const target = made.split(' ').at(made.startsWith('git worktree') ? 3 : -1);
    assert.equal(decideCommand(`${made} && rm -rf ${target}`, { cwd: dir })?.decision, undefined, made);
  }
});

test('default-allow#AC-2: a folder that was there before the line, or a target outside the new folder, still asks', () => {
  const dir = repo();
  const existing = fresh();
  fs.mkdirSync(existing);
  fs.writeFileSync(path.join(existing, 'keep.txt'), 'keep\n');
  // cp into a folder that exists merges into it, so the folder's earlier contents are not the line's own.
  assert.equal(decideCommand(`cp -r . ${sh(existing)} && rm -rf ${sh(existing)}`, { cwd: dir })?.decision, 'ask');
  // A folder directly under the temp folder that this line did not make.
  assert.equal(decideCommand(`rm -rf ${sh(existing)}`, { cwd: dir })?.decision, 'ask');
  // Escaping the new folder with .. or an absolute path.
  const copy = sh(fresh());
  assert.equal(decideCommand(`cp -r . ${copy} && cd ${copy} && rm -rf ../*`, { cwd: dir })?.decision, 'ask');
  assert.equal(decideCommand(`cp -r . ${copy} && cd ${copy} && rm -rf ${sh(existing)}`, { cwd: dir })?.decision, 'ask');
  // A folder made outside any temp folder is not covered.
  const outside = sh(path.join(dir, '..', `rfr-own-scratch-outside-${process.pid}`));
  assert.equal(decideCommand(`mkdir ${outside} && rm -rf ${outside}/..`, { cwd: dir })?.decision, 'ask');
  fs.rmSync(existing, { recursive: true, force: true });
});
