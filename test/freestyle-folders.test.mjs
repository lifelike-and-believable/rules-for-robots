// Which folders are freestyle (docs/specs/freestyle.md, AC-1): a folder whose project folder (the
// git top level, or the folder itself without git) is one of the roots the person lists in
// ~/.claude/rfr.json, or inside one, unless it has docs/product/process.yml or a git remote.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { freestyleRoots, isFreestyle, parseRoots, projectFolder } from '../plugins/core/scripts/freestyle-lib.mjs';

// roots: undefined lists the scratch folder, null writes no settings file.
function setup(roots) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-freestyle-')));
  const home = path.join(base, 'home');
  const scratch = path.join(base, 'scratch');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.mkdirSync(scratch, { recursive: true });
  const settings = value => fs.writeFileSync(path.join(home, '.claude', 'rfr.json'), typeof value === 'string' ? value : JSON.stringify(value));
  if (roots !== null) settings({ freestyle: roots === undefined ? [scratch] : roots });
  const folder = rel => {
    const dir = path.join(base, rel);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };
  const git = (dir, ...args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  };
  return { base, home, scratch, settings, folder, git };
}

test('freestyle#AC-1: a folder inside a listed root, or the root itself, is freestyle; one outside is not', () => {
  const t = setup([]);
  t.settings({ freestyle: [t.scratch] });
  assert.equal(isFreestyle(t.folder('scratch/idea'), { home: t.home }), true);
  assert.equal(isFreestyle(t.folder('scratch/idea/deeper/still'), { home: t.home }), true);
  assert.equal(isFreestyle(t.scratch, { home: t.home }), true, 'the root itself');
  assert.equal(isFreestyle(t.folder('elsewhere'), { home: t.home }), false);
  assert.equal(isFreestyle(t.folder('scratch2'), { home: t.home }), false, 'a sibling whose name starts with the root\'s is outside it');
  assert.equal(isFreestyle(t.base, { home: t.home }), false, 'the folder above a root');
  assert.deepEqual(freestyleRoots({ home: t.home }), [t.scratch]);
});

test('freestyle#AC-1: any listed root counts, not only the first', () => {
  const t = setup([]);
  const other = t.folder('other-root');
  t.settings({ freestyle: [t.scratch, other] });
  assert.equal(isFreestyle(t.folder('other-root/spike'), { home: t.home }), true);
});

test('freestyle#AC-1: a root written with ~ is expanded from the home folder', () => {
  const t = setup([]);
  const inHome = path.join(t.home, 'scratch');
  fs.mkdirSync(path.join(inHome, 'idea'), { recursive: true });
  t.settings({ freestyle: ['~/scratch'] });
  assert.equal(isFreestyle(path.join(inHome, 'idea'), { home: t.home }), true);
  assert.equal(isFreestyle(t.folder('scratch/idea'), { home: t.home }), false, 'the same name outside the home folder is not the root');
  t.settings({ freestyle: ['~'] });
  assert.equal(isFreestyle(path.join(inHome, 'idea'), { home: t.home }), true, 'a bare ~ is the home folder');
});

test('freestyle#AC-1: a relative root does not count, since it is not an absolute path after expansion', () => {
  const t = setup([]);
  t.settings({ freestyle: ['scratch', './scratch', `${path.basename(t.base)}/scratch`] });
  const idea = t.folder('scratch/idea');
  assert.equal(isFreestyle(idea, { home: t.home }), false);
  assert.deepEqual(freestyleRoots({ home: t.home }), []);
});

test('freestyle#AC-1: a missing, unreadable, or malformed settings file, or one with no freestyle list, means not freestyle', () => {
  const t = setup(null);
  const idea = t.folder('scratch/idea');
  assert.equal(isFreestyle(idea, { home: t.home }), false, 'no file');
  for (const bad of ['{ "freestyle": [', '', 'null', '[]', '"scratch"', JSON.stringify({ other: true }), JSON.stringify({ freestyle: t.scratch }), JSON.stringify({ freestyle: null }), JSON.stringify({ freestyle: [42, null, {}] })]) {
    t.settings(bad);
    assert.equal(isFreestyle(idea, { home: t.home }), false, bad);
  }
  // A settings path that is a folder cannot be read as a file.
  fs.rmSync(path.join(t.home, '.claude', 'rfr.json'));
  fs.mkdirSync(path.join(t.home, '.claude', 'rfr.json'));
  assert.equal(isFreestyle(idea, { home: t.home }), false, 'unreadable');
  assert.equal(isFreestyle(idea, { home: path.join(t.base, 'no-such-home') }), false, 'no home folder');
});

test('freestyle#AC-1: a folder with docs/product/process.yml under a root is a real project, not freestyle', () => {
  const t = setup();
  const project = t.folder('scratch/real');
  fs.mkdirSync(path.join(project, 'docs', 'product'), { recursive: true });
  fs.writeFileSync(path.join(project, 'docs', 'product', 'process.yml'), 'mode: solo\n');
  assert.equal(isFreestyle(project, { home: t.home }), false);
  assert.equal(isFreestyle(t.folder('scratch/real/src'), { home: t.home }), true, 'without git the project folder is the folder itself');
  t.git(project, 'init', '-q');
  assert.equal(isFreestyle(path.join(project, 'src'), { home: t.home }), false, 'with git the project folder is the top level, which has process.yml');
});

test('freestyle#AC-1: a git repository with a remote under a root is not freestyle; one without a remote is', () => {
  const t = setup();
  const repo = t.folder('scratch/cloned');
  t.git(repo, 'init', '-q');
  const sub = t.folder('scratch/cloned/src');
  assert.equal(isFreestyle(sub, { home: t.home }), true, 'git with no remote');
  assert.equal(projectFolder(sub), repo);
  t.git(repo, 'remote', 'add', 'origin', 'https://example.invalid/cloned.git');
  assert.equal(isFreestyle(repo, { home: t.home }), false);
  assert.equal(isFreestyle(sub, { home: t.home }), false);
});

test('freestyle#AC-1: nested git: the project folder is the git top level, so a repository that holds the root is not freestyle', () => {
  const t = setup([]);
  // A repository above the root (the person's home folder under git, say): the project folder of a
  // folder inside the root is that repository, which is not inside the root.
  const outer = t.folder('outer');
  t.git(outer, 'init', '-q');
  const root = t.folder('outer/scratch');
  t.settings({ freestyle: [root] });
  assert.equal(isFreestyle(t.folder('outer/scratch/idea'), { home: t.home }), false);
  // A repository of its own inside the root is freestyle.
  const inner = t.folder('outer/scratch/idea2');
  t.git(inner, 'init', '-q');
  assert.equal(isFreestyle(path.join(inner), { home: t.home }), true);
  assert.equal(isFreestyle(t.folder('outer/scratch/idea2/lib'), { home: t.home }), true);
});

test('freestyle#AC-1: Windows paths compare without regard to case or slash direction', () => {
  const t = setup([]);
  t.settings({ freestyle: ['D:/Experiments'] });
  assert.equal(isFreestyle('d:\\experiments\\spike', { home: t.home, platform: 'win32' }), true);
  assert.equal(isFreestyle('D:\\EXPERIMENTS', { home: t.home, platform: 'win32' }), true);
  assert.equal(isFreestyle('D:\\Experiments2\\spike', { home: t.home, platform: 'win32' }), false);
  assert.equal(isFreestyle('C:\\Experiments\\spike', { home: t.home, platform: 'win32' }), false);
  assert.deepEqual(parseRoots({ freestyle: ['~\\Scratch', '~/Other', 'C:\\Exp'] }, { home: 'C:\\Users\\Pat', platform: 'win32' }), ['C:\\Users\\Pat\\Scratch', 'C:\\Users\\Pat\\Other', 'C:\\Exp']);
  t.settings({ freestyle: ['Experiments'] });
  assert.equal(isFreestyle('C:\\Experiments\\spike', { home: t.home, platform: 'win32' }), false, 'a relative root on Windows does not count');
});

test('freestyle#AC-1: case is ignored on macOS and kept on Linux', () => {
  const t = setup([]);
  t.settings({ freestyle: ['/Users/Pat/Scratch'] });
  assert.equal(isFreestyle('/users/pat/scratch/idea', { home: t.home, platform: 'darwin' }), true);
  assert.equal(isFreestyle('/users/pat/scratch/idea', { home: t.home, platform: 'linux' }), false);
  assert.equal(isFreestyle('/Users/Pat/Scratch/idea', { home: t.home, platform: 'linux' }), true);
});
