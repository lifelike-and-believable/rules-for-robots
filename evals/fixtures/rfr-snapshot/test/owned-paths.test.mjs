import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isOwned, parseOwnedPaths } from '../checks/lib/owned-paths.mjs';
import { checkOwnedPaths } from '../checks/ci/owned-paths.mjs';

const AGENTS = [
  '# My project',
  '',
  '## Owned paths',
  '',
  'Everything else comes from upstream.',
  '',
  '- `Plugins/MyPlugin/**`',
  '* `Source/MyGameTests/**` (our tests)',
  '- `AGENTS.md`',
  '- `docs/`',
  '',
  '## Commands',
  '',
  '- `npm run verify`',
].join('\n');

test('parses the globs listed under ## Owned paths', () => {
  assert.deepEqual(parseOwnedPaths(AGENTS), ['Plugins/MyPlugin/**', 'Source/MyGameTests/**', 'AGENTS.md', 'docs/']);
});

test('returns null when AGENTS.md has no Owned paths section', () => {
  assert.equal(parseOwnedPaths('# Project\n\n## Commands\n\n- `npm test`\n'), null);
  assert.equal(parseOwnedPaths(''), null);
  assert.equal(parseOwnedPaths('```md\n## Owned paths\n- `a/**`\n```\n'), null, 'a heading inside a code fence does not count');
});

test('stops at the next heading of the same or higher level, and keeps subheadings', () => {
  const text = '## Owned paths\n\n- `a/**`\n\n### Tests\n\n- `b/**`\n\n# Next\n\n- `c/**`\n';
  assert.deepEqual(parseOwnedPaths(text), ['a/**', 'b/**']);
});

test('matches paths against owned globs', () => {
  const globs = parseOwnedPaths(AGENTS);
  for (const p of ['Plugins/MyPlugin/Source/A.cpp', 'Source/MyGameTests/Private/ATests.cpp', 'AGENTS.md', 'docs/guide.md', 'docs/a/b.md']) {
    assert.ok(isOwned(p, globs), p);
  }
  for (const p of ['Source/Engine/Private/A.cpp', 'Plugins/OtherPlugin/A.cpp', 'README.md', 'Plugins/MyPluginX/A.cpp']) {
    assert.ok(!isOwned(p, globs), p);
  }
  assert.ok(isOwned('Plugins\\MyPlugin\\Source\\A.cpp', globs), 'Windows separators');
});

test('CI check fails on changed files outside the owned globs', () => {
  const result = checkOwnedPaths(AGENTS, ['Plugins/MyPlugin/A.cpp', 'Source/Engine/B.cpp', 'README.md']);
  assert.equal(result.ok, false);
  assert.deepEqual(result.outside, ['Source/Engine/B.cpp', 'README.md']);
});

test('CI check passes when every changed file is owned', () => {
  const result = checkOwnedPaths(AGENTS, ['Plugins/MyPlugin/A.cpp', 'AGENTS.md']);
  assert.equal(result.ok, true);
  assert.deepEqual(result.outside, []);
});

test('CI check passes with a note when AGENTS.md has no section', () => {
  const result = checkOwnedPaths('# Project\n', ['anything/at/all.ts']);
  assert.equal(result.ok, true);
  assert.equal(result.globs, null);
  assert.match(result.message, /no "## Owned paths" section/);
  assert.equal(checkOwnedPaths(null, ['a.ts']).ok, true, 'no AGENTS.md at all');
});

test('rfr-guards runs the owned-paths job only when a repo opts in', async () => {
  const { parse } = await import('yaml');
  const workflow = parse(fs.readFileSync('.github/workflows/rfr-guards.yml', 'utf8'));
  const input = workflow.on.workflow_call.inputs['owned-paths'];
  assert.equal(input.type, 'boolean');
  assert.equal(input.default, false, 'existing adopters see no change');
  const job = workflow.jobs['owned-paths'];
  assert.match(job.if, /inputs\.owned-paths/);
  assert.ok(job.steps.some(s => /checks\/ci\/owned-paths\.mjs/.test(s.run ?? '')));
});

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

test('CI script reads the diff against the base ref and AGENTS.md from the working tree', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-owned-'));
  const script = path.resolve('checks/ci/owned-paths.mjs');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test');
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# P\n\n## Owned paths\n\n- `mine/**`\n');
  fs.mkdirSync(path.join(dir, 'mine'));
  fs.mkdirSync(path.join(dir, 'upstream'));
  fs.writeFileSync(path.join(dir, 'upstream/a.cpp'), 'a');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  const base = git(dir, 'rev-parse', 'HEAD');

  fs.writeFileSync(path.join(dir, 'mine/b.cpp'), 'b');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'owned change');
  let r = spawnSync(process.execPath, [script, base], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /owned-paths: OK/);

  fs.writeFileSync(path.join(dir, 'upstream/a.cpp'), 'changed');
  git(dir, 'commit', '-q', '-am', 'upstream change');
  r = spawnSync(process.execPath, [script, base], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /upstream\/a\.cpp/);

  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# P\n');
  git(dir, 'commit', '-q', '-am', 'drop the section');
  r = spawnSync(process.execPath, [script, base], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /no "## Owned paths" section/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the owned-paths glob matcher agrees with path.matchesGlob without needing it (#47)', async () => {
  const path = (await import('node:path')).default;
  const { globToRegExp } = await import('../plugins/core/scripts/owned-paths.mjs');
  const globs = ['Plugins/MyPlugin/**', 'docs/**', '*.md', 'src/**/*.test.js', 'a?c.txt', '.github/**', 'Source/My.Module/**'];
  const files = ['Plugins/MyPlugin/Source/A.cpp', 'Plugins/Other/A.cpp', 'docs/x/y.md', 'README.md', 'docs/README.md', 'src/a.test.js', 'src/x/y/a.test.js', 'src/a.js', 'abc.txt', 'abbc.txt', '.github/workflows/ci.yml', 'Source/My.Module/a.h', 'Source/MyXModule/a.h'];
  for (const g of globs) for (const f of files) {
    assert.equal(globToRegExp(g).test(f), path.posix.matchesGlob(f, g), `${g} vs ${f}`);
  }
});
