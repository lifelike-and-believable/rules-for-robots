// A release instruction that names no version (docs/specs/task-approval.md, AC-12): "publish the
// release" or "merge as you go, then publish a release when you're done" covers the version the project
// has prepared, stays in force after later messages, and ends when the person withdraws it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { approval, commandTask, preparedVersion, standingInstructions } from '../plugins/core/scripts/task-approval.mjs';
import { decideCommand } from '../plugins/core/scripts/guard-commands.mjs';

let clock = 0;
const human = content => ({ type: 'user', origin: { kind: 'human' }, timestamp: new Date(Date.UTC(2026, 10, 12, 2, 0, clock++)).toISOString(), isSidechain: false, message: { content } });
function transcript(...messages) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-release-')), 's.jsonl');
  fs.writeFileSync(file, messages.map(m => JSON.stringify(human(m))).join('\n') + '\n');
  return file;
}

// A project whose changelog's newest release is 6.0.0, with that version tagged locally.
function project(changelog = '# Changelog\n\n## [Unreleased]\n\n## [6.0.0] - 2026-11-12\n\n## [5.10.1] - 2026-11-12\n') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-release-project-'));
  fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), changelog);
  const git = (...args) => spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  git('tag', '-a', 'rfr-v6.0.0', '-m', 'rfr-v6.0.0');
  return dir;
}

test('task-approval#AC-12: an instruction that names no version covers the version the project prepared', () => {
  const dir = project();
  assert.equal(preparedVersion(dir), '6.0.0');
  for (const said of ['publish the release', 'fix the gap, merge, then publish the release', 'merge as you go, then publish a release when your done', 'merge when green, then release', 'release it']) {
    const file = transcript(said);
    for (const command of ['gh release create rfr-v6.0.0 --title rfr-v6.0.0 --verify-tag', 'git push origin rfr-v6.0.0']) {
      const d = decideCommand(command, { cwd: dir, transcriptPath: file });
      assert.equal(d?.decision, 'allow', `${said}: ${command}`);
      assert.match(d.reason, /task approval/);
    }
    // Another version is not the prepared one.
    assert.notEqual(decideCommand('gh release create rfr-v6.0.1', { cwd: dir, transcriptPath: file })?.decision, 'allow', said);
  }
  // Release notes, a question, and a negation are not release instructions.
  for (const said of ['write the release notes', 'should we publish the release?', "don't publish the release yet"]) {
    assert.equal(standingInstructions(transcript(said)).release, null, said);
    assert.notEqual(decideCommand('gh release create rfr-v6.0.0', { cwd: dir, transcriptPath: transcript(said) })?.decision, 'allow', said);
  }
});

test('task-approval#AC-12: it stays in force after later messages until withdrawn', () => {
  const dir = project();
  const found = commandTask('gh release create rfr-v6.0.0');
  assert.ok(approval(found, { transcriptPath: transcript('merge as you go, then publish a release when you are done', 'thanks for the clarification'), cwd: dir }));
  for (const later of ['hold off on the release', "don't publish anything", 'stop']) {
    assert.equal(approval(found, { transcriptPath: transcript('then publish the release', later), cwd: dir }), null, later);
  }
  // Without a changelog or package.json version, nothing is prepared, so nothing is approved.
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-release-bare-'));
  assert.equal(preparedVersion(bare), null);
  assert.equal(approval(found, { transcriptPath: transcript('publish the release'), cwd: bare }), null);
});
