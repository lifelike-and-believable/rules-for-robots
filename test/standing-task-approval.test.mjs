// Standing task approval (docs/specs/task-approval.md, AC-9 to AC-11): "merge each PR when green" or
// "push each branch as you go" stays in force across the person's later messages until they withdraw
// it, and covers only the pull requests and branches the session itself created.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { approval, branchCreatedInSession, standingInstructions } from '../plugins/core/scripts/task-approval.mjs';
import { decideMerge } from '../plugins/process/scripts/guard-merge.mjs';

let clock = 0;
const at = () => new Date(Date.UTC(2026, 10, 12, 1, 0, clock++)).toISOString();
const human = content => ({ type: 'user', origin: { kind: 'human' }, timestamp: at(), isSidechain: false, message: { role: 'user', content } });
const call = (id, name, input) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });
const result = (id, text, extra = {}) => ({ type: 'user', timestamp: at(), isSidechain: false, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text }], ...extra }] } });
const notification = text => ({ type: 'user', timestamp: at(), isSidechain: false, message: { role: 'user', content: text } });

function transcript(entries) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-standing-')), 'session.jsonl');
  fs.writeFileSync(file, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
  return file;
}

// The session opens a pull request with the GitHub MCP tool, or creates a branch with git.
const opens = (id, number) => [call(id, 'mcp__github__create_pull_request', { owner: 'acme', repo: 'app' }), result(id, `{"number":${number},"html_url":"https://github.com/acme/app/pull/${number}"}`)];
const branches = (id, command) => [call(id, 'Bash', { command }), result(id, '')];
const noGh = () => { throw new Error('gh: not found'); };
const merge = (file, number) => approval({ task: 'merge', target: number }, { transcriptPath: file, describePr: noGh });
const push = (file, branch) => approval({ task: 'push', target: branch }, { transcriptPath: file });

test('task-approval#AC-9: a standing instruction is recognized, and stays in force across later messages', () => {
  for (const text of ['merge each PR when green', 'Merge them as they go green', 'carry out the plan, merging every PR once CI passes', 'merge PRs as you go', 'keep merging when checks pass', 'each PR: merge when green']) {
    assert.ok(standingInstructions(transcript([human(text)])).merge, text);
  }
  for (const text of ['push each branch as you go', 'keep pushing', 'push every branch and open PRs']) {
    assert.ok(standingInstructions(transcript([human(text)])).push, text);
  }
  // A single instruction, a question, or a negation is not standing.
  for (const text of ['merge when green', 'merge #12', 'merge when all checks pass', 'merge once every check is green', 'merge it after each job passes', 'should we merge each PR when green?', "don't merge each PR, I'll review them", 'never merge all of them at once']) {
    assert.equal(standingInstructions(transcript([human(text)])).merge, null, text);
  }
  // Later messages that do not withdraw it leave it in force; so do notifications and tool results.
  const file = transcript([
    human('implement the plan; merge each PR when green'),
    ...opens('c1', 301),
    human('also, use the shorter error message in the login form'),
    notification('<task-notification>CI passed</task-notification>'),
    ...opens('c2', 302),
    human('looks good so far'),
  ]);
  assert.ok(merge(file, 301));
  assert.match(merge(file, 302).reason, /merge each PR when green/);
});

test('task-approval#AC-10: a later message that says not to merge, or to stop, withdraws it', () => {
  const base = [human('merge each PR when green'), ...opens('c1', 301)];
  for (const text of ["don't merge anything else", 'stop', 'hold off on merging', 'pause', 'wait, let me review first', 'do not merge 301']) {
    assert.equal(merge(transcript([...base, human(text)]), 301), null, text);
  }
  // A new standing instruction after the withdrawal starts it again.
  assert.ok(merge(transcript([...base, human('stop'), human('ok, go on and merge each PR when green')]), 301));
  // Withdrawing merges leaves a standing push in force, and the reverse.
  const both = [human('push each branch and merge each PR as you go'), ...opens('c1', 301), ...branches('b1', 'git switch -c phase-2/api')];
  assert.ok(push(transcript([...both, human("don't merge anything yet")]), 'phase-2/api'));
  assert.ok(merge(transcript([...both, human("don't push anything else")]), 301));
});

test("task-approval#AC-11: it covers only the session's own pull requests and branches, never the default branch", () => {
  const file = transcript([
    human('push each branch and merge each PR when green'),
    ...opens('c1', 301),
    ...branches('b1', 'git switch -c phase-2/api'),
    ...branches('b2', 'git worktree add ../wt -b phase-2/ui'),
    call('b3', 'Bash', { command: 'git checkout -b phase-2/broken' }),
    result('b3', 'fatal: a branch named phase-2/broken already exists', { is_error: true }),
  ]);
  assert.equal(merge(file, 300), null, 'a pull request the session did not open');
  assert.ok(push(file, 'phase-2/api'));
  assert.ok(push(file, 'phase-2/ui'));
  assert.equal(push(file, 'phase-2/broken'), null, 'a branch command that failed');
  assert.equal(push(file, 'someone-elses-branch'), null);
  assert.equal(branchCreatedInSession(file, 'phase-2'), false, 'a prefix of a created branch');
  // The default branch is never a push target (AC-3): commandTask refuses it before any approval.
  // rfr-process's merge guard uses the same standing instruction for the GitHub MCP merge tool.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-standing-project-'));
  fs.mkdirSync(path.join(root, 'docs/product'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/product/process.yml'), 'mode: solo\ndefault: [lead]\n');
  const later = transcript([human('merge each PR when green'), ...opens('c1', 301), human('rename the button to Save')]);
  const mcp = number => ({ tool_name: 'mcp__github__merge_pull_request', tool_input: { owner: 'acme', repo: 'app', pullNumber: number }, transcript_path: later });
  const gated = () => ['docs/design/story-reader.md'];
  const own = decideMerge({ input: mcp(301), root, listFiles: gated, describePr: noGh });
  assert.deepEqual([own.ask, own.allow], [false, true]);
  assert.equal(decideMerge({ input: mcp(300), root, listFiles: gated, describePr: noGh }).ask, true);
});
