// "Merge when green" given before the session opened its pull request (project-process AC-52, amended
// 2026-11-12): the instruction covers the pull request the session itself opened, found in the
// transcript, with no GitHub lookup; and the merge guard lists a pull request's files with git when
// there is no gh, as in cloud sessions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decideMerge, listWithGit } from '../plugins/process/scripts/guard-merge.mjs';
import { approval, openedInSession } from '../plugins/core/scripts/task-approval.mjs';

const human = (content, timestamp) => ({ type: 'user', origin: { kind: 'human' }, timestamp, isSidechain: false, message: { role: 'user', content } });
const call = (id, name, input) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });
const result = (id, text, extra = {}) => ({ type: 'user', isSidechain: false, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text }], ...extra }] } });

function transcript(entries) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-session-pr-')), 'session.jsonl');
  fs.writeFileSync(file, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
  return file;
}

// The person asks for the work and the merge first; the session then opens the pull request.
const instructedThenOpened = (opener = call('c1', 'mcp__github__create_pull_request', { owner: 'acme', repo: 'app', title: 'x' }), text = '{"number":287,"html_url":"https://github.com/acme/app/pull/287"}') => [
  human('apply the fixes, open a PR, and merge when green', '2026-11-12T00:04:00Z'),
  opener,
  result('c1', text),
];

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-session-pr-project-'));
  fs.mkdirSync(path.join(root, 'docs/product'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/product/process.yml'), 'mode: solo\ndefault: [lead]\n');
  return root;
}
const mcpMerge = (pullNumber = 287) => ({ tool_name: 'mcp__github__merge_pull_request', tool_input: { owner: 'acme', repo: 'app', pullNumber } });
const gated = () => ['docs/design/story-reader.md'];
const openedLater = () => ({ number: 287, createdAt: '2026-11-12T00:25:44Z' });
const noGh = () => { throw new Error('gh: not found'); };

test('project-process#AC-52: the session opened the pull request, so an earlier instruction naming none covers it', () => {
  assert.equal(openedInSession(transcript(instructedThenOpened()), 287, { owner: 'acme', repo: 'app' }), true);
  assert.equal(openedInSession(transcript(instructedThenOpened(call('c1', 'Bash', { command: 'gh pr create --fill --draft' }), 'https://github.com/acme/app/pull/287\n')), 287), true);
  // Another number, another repository, a failed call, or a link that only appears elsewhere does not count.
  assert.equal(openedInSession(transcript(instructedThenOpened()), 28), false);
  assert.equal(openedInSession(transcript(instructedThenOpened()), 2870), false);
  assert.equal(openedInSession(transcript(instructedThenOpened()), 287, { owner: 'acme', repo: 'other' }), false);
  assert.equal(openedInSession(transcript([call('c1', 'mcp__github__create_pull_request', {}), result('c1', 'https://github.com/acme/app/pull/287', { is_error: true })]), 287), false);
  assert.equal(openedInSession(transcript([call('c1', 'mcp__github__pull_request_read', {}), result('c1', 'https://github.com/acme/app/pull/287')]), 287), false);
  assert.equal(openedInSession(null, 287), false);

  const root = project();
  const file = transcript(instructedThenOpened());
  const decision = decideMerge({ input: { ...mcpMerge(), transcript_path: file }, root, listFiles: gated, describePr: noGh });
  assert.deepEqual([decision.ask, decision.allow], [false, true]);
  assert.match(decision.reason, /merge when green/);
  // A pull request the session did not open, opened after the instruction, still asks.
  const other = decideMerge({ input: { ...mcpMerge(288), transcript_path: file }, root, listFiles: gated, describePr: () => ({ number: 288, createdAt: '2026-11-12T00:25:44Z' }) });
  assert.equal(other.ask, true);
  assert.match(other.reason, /opened after/);
  // So does one whose opening time cannot be read.
  assert.equal(decideMerge({ input: { ...mcpMerge(288), transcript_path: file }, root, listFiles: gated, describePr: noGh }).ask, true);
  // The person typing something else since still ends the instruction.
  const since = transcript([...instructedThenOpened(), human('also fix the header', '2026-11-12T00:30:00Z')]);
  assert.equal(decideMerge({ input: { ...mcpMerge(), transcript_path: since }, root, listFiles: gated, describePr: openedLater }).ask, true);
});

test('project-process#AC-52: rfr-core approves gh pr merge for the pull request the session opened', () => {
  const file = transcript(instructedThenOpened(call('c1', 'Bash', { command: 'gh pr create --fill' }), 'https://github.com/acme/app/pull/287'));
  assert.ok(approval({ task: 'merge', target: 287 }, { transcriptPath: file, describePr: noGh }));
  assert.equal(approval({ task: 'merge', target: 288 }, { transcriptPath: file, describePr: () => ({ number: 288, createdAt: '2026-11-12T00:25:44Z' }) }), null);
});

function git(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

test('project-process#AC-52: with no gh, the merge guard lists the pull request files with git', () => {
  // A bare "GitHub" remote with main and a pull request ref, and a clone of it as the project.
  const remote = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-pr-remote-')), 'app.git');
  git(path.dirname(remote), 'init', '-q', '--bare', '-b', 'main', remote);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-pr-work-'));
  git(work, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(work, 'README.md'), 'x\n');
  git(work, 'add', '.');
  git(work, 'commit', '-q', '-m', 'base');
  git(work, 'remote', 'add', 'origin', remote);
  git(work, 'push', '-q', 'origin', 'main');
  git(work, 'switch', '-q', '-c', 'stories');
  fs.mkdirSync(path.join(work, 'docs/design'), { recursive: true });
  fs.writeFileSync(path.join(work, 'docs/design/story-reader.md'), 'story\n');
  git(work, 'add', '.');
  git(work, 'commit', '-q', '-m', 'stories');
  git(work, 'push', '-q', 'origin', 'stories:refs/pull/287/head');

  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-pr-clone-'));
  git(project, 'clone', '-q', remote, '.');
  // listWithGit checks the origin is the pull request's repository; a local path has no owner/repo,
  // so this test uses the gh-style target, which names only the number.
  assert.deepEqual(listWithGit({ kind: 'gh', ref: '287' }, project), ['docs/design/story-reader.md']);
  assert.throws(() => listWithGit({ kind: 'api', owner: 'acme', repo: 'app', number: 287 }, project), /not this checkout's origin/);
  assert.throws(() => listWithGit({ kind: 'gh', ref: '' }, project), /no number/);
  assert.throws(() => listWithGit({ kind: 'gh', ref: '999' }, project));
});
