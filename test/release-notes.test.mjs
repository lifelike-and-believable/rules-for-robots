// Release notes and the prepare step (checks/release.mjs), used to tag and publish a release from
// any machine (docs/maintenance.md, Releasing).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { previousTag, releaseNotes } from '../checks/release.mjs';

const CHANGELOG = `# Changelog

Intro.

## [Unreleased]

## [1.2.0] - 2026-11-08

Pull requests: #3.

- Three.

## [1.1.1] - 2026-11-07

- Two.

## [1.1.0] - 2026-11-06

- One.
`;

test('releaseNotes takes the sections after one release, up to another', () => {
  assert.equal(releaseNotes(CHANGELOG, { since: '1.1.0', to: '1.2.0' }), '## [1.2.0] - 2026-11-08\n\nPull requests: #3.\n\n- Three.\n\n## [1.1.1] - 2026-11-07\n\n- Two.\n');
  assert.equal(releaseNotes(CHANGELOG, { since: '1.1.1', to: '1.1.1' }), '');
  assert.equal(releaseNotes(CHANGELOG, { since: null, to: '1.1.1' }), '## [1.1.1] - 2026-11-07\n\n- Two.\n\n## [1.1.0] - 2026-11-06\n\n- One.\n', 'the last section runs to the end of the file');
});

test('previousTag finds the newest rfr-v tag below a version', () => {
  assert.equal(previousTag(['rfr-v1.0.2', 'rfr-v1.1.0', 'rfr-v1.10.0', 'v9.0.0', 'rfr-v1.2.0', ''], '1.2.0'), '1.1.0');
  assert.equal(previousTag(['rfr-v1.0.2', 'rfr-v1.10.0'], '1.11.0'), '1.10.0', 'versions compare as numbers');
  assert.equal(previousTag([], '1.0.0'), null);
});

const run = (cwd, cmd, args) => spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' } });
const script = path.resolve('checks/release.mjs');

test('prepare checks a merged commit, writes the notes, and prints the commands without running them', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-release-'));
  const origin = path.join(root, 'origin.git');
  const work = path.join(root, 'work');
  run(root, 'git', ['init', '-q', '--bare', '-b', 'main', origin]);
  run(root, 'git', ['clone', '-q', origin, work]);
  fs.mkdirSync(path.join(work, 'plugins/core/.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(work, 'plugins/core/.claude-plugin/plugin.json'), '{ "name": "rfr-core", "version": "1.1.0" }\n');
  fs.writeFileSync(path.join(work, 'CHANGELOG.md'), CHANGELOG.replace(/## \[1\.2\.0\][\s\S]*?(?=## \[1\.1\.1\])/, '').replace(/## \[1\.1\.1\][\s\S]*?(?=## \[1\.1\.0\])/, ''));
  run(work, 'git', ['add', '.']);
  run(work, 'git', ['commit', '-q', '-m', 'one']);
  run(work, 'git', ['tag', 'rfr-v1.1.0']);
  fs.writeFileSync(path.join(work, 'plugins/core/.claude-plugin/plugin.json'), '{ "name": "rfr-core", "version": "1.2.0" }\n');
  fs.writeFileSync(path.join(work, 'CHANGELOG.md'), CHANGELOG);
  run(work, 'git', ['commit', '-q', '-am', 'two']);
  run(work, 'git', ['push', '-q', 'origin', 'main', 'rfr-v1.1.0']);
  const head = run(work, 'git', ['rev-parse', 'HEAD']).stdout.trim();

  const ready = run(work, process.execPath, [script, 'prepare', '--commit', head]);
  assert.equal(ready.status, 0, ready.stderr);
  assert.match(ready.stdout, new RegExp(`Ready: rfr-v1\\.2\\.0 on ${head}`));
  assert.match(ready.stdout, /releases after 1\.1\.0 up to 1\.2\.0/);
  assert.match(ready.stdout, new RegExp(`git tag -a rfr-v1\\.2\\.0 -m rfr-v1\\.2\\.0 ${head}`));
  assert.match(ready.stdout, /gh release create rfr-v1\.2\.0 --title rfr-v1\.2\.0 --notes-file ".*rfr-v1\.2\.0-notes\.md" --verify-tag/);
  assert.match(ready.stdout, /confirm with the maintainer/);
  const notesFile = /Notes: (.*?) \(/.exec(ready.stdout)[1];
  assert.equal(fs.readFileSync(notesFile, 'utf8'), releaseNotes(CHANGELOG, { since: '1.1.0', to: '1.2.0' }));
  assert.equal(run(work, 'git', ['ls-remote', '--tags', 'origin', 'rfr-v1.2.0']).stdout, '', 'nothing was pushed');

  // A tagged version, an unknown commit, and a commit that is not on origin/main are refused.
  const tagged = run(work, process.execPath, [script, 'prepare', '--commit', 'rfr-v1.1.0']);
  assert.equal(tagged.status, 1);
  assert.match(tagged.stderr, /rfr-v1\.1\.0 already exists here/);
  assert.match(run(work, process.execPath, [script, 'prepare', '--commit', 'deadbeef']).stderr, /is not a commit here/);
  fs.writeFileSync(path.join(work, 'plugins/core/.claude-plugin/plugin.json'), '{ "name": "rfr-core", "version": "1.3.0" }\n');
  fs.writeFileSync(path.join(work, 'CHANGELOG.md'), CHANGELOG.replace('## [1.2.0]', '## [1.3.0] - 2026-11-09\n\n- Four.\n\n## [1.2.0]'));
  run(work, 'git', ['commit', '-q', '-am', 'three']);
  const local = run(work, process.execPath, [script, 'prepare', '--commit', 'HEAD']);
  assert.equal(local.status, 1);
  assert.match(local.stderr, /is not on origin\/main/);
  assert.equal(run(work, process.execPath, [script, 'prepare']).status, 1, '--commit is required');
});
