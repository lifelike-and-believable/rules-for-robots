// The never-list actions guard-commands refuses outside the project (docs/specs/unattended.md, AC-2):
// pushing to the default branch, deleting on the remote, and production deploys. Pushes to other
// branches, tags, releases, and preview deploys go ahead (rewrite plan 25e). Moved from
// default-allow.test.mjs when the default-allow hook was removed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decideCommand, namedAsk } from '../plugins/core/scripts/guard-commands.mjs';

function git(dir, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
}

// A repository on a feature branch, with main as its default branch and a tag v1.0.0.
function repo({ branch = 'feature' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-never-list-'));
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'tag', 'v1.0.0');
  if (branch !== 'main') git(dir, 'switch', '-q', '-c', branch);
  return dir;
}

test('unattended#AC-2: pushes to the default branch, remote deletes, and production deploys are refused; other pushes, releases, and preview deploys are not', () => {
  const dir = repo();
  for (const command of ['git push origin main', 'git push origin HEAD:main', 'git push origin --all', 'git push origin --delete old', 'git push origin :old', 'gh repo delete acme/app --yes', 'gh release delete v1.0.0', 'npx vercel deploy --prod', 'vercel promote dpl_1', 'git -C . push origin main']) {
    assert.equal(decideCommand(command, { cwd: dir })?.decision, 'ask', command);
  }
  for (const command of ['git push -u origin feature', 'git push origin feature:feature', 'git push origin --tags', 'git push origin v1.0.0', 'gh release create v1.0.1', 'npx vercel deploy', 'git status', 'gh pr create --fill']) {
    assert.equal(namedAsk(command, dir), null, command);
    assert.equal(decideCommand(command, { cwd: dir }), null, command);
  }
  // A bare push is refused only on the default branch.
  assert.equal(namedAsk('git push', dir), null);
  assert.ok(namedAsk('git push', repo({ branch: 'main' })));
});

test('unattended#AC-2: every action in the guide\'s never-list table has tier-4 corpus cases', () => {
  const table = fs.readFileSync('practices/guards.md', 'utf8').split('### Named asks')[1].split('\n\n')[1];
  const rows = table.split('\n').filter(line => line.startsWith('| ') && !line.startsWith('| Action'));
  const ids = rows.flatMap(line => [...line.split('|').at(-2).matchAll(/`([a-z0-9-]+)`/g)].map(m => m[1]));
  const corpus = JSON.parse(fs.readFileSync('test/fixtures/guard-corpus.json', 'utf8')).cases;
  assert.ok(ids.length >= 10, `${ids.length} corpus ids in the table`);
  for (const id of ids) assert.equal(corpus.find(c => c.id === id)?.tier, 4, `${id} is a tier-4 corpus case`);
});
