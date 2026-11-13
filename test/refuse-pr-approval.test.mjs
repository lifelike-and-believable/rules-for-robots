// An agent approving a pull request is refused (docs/specs/github-gate.md, AC-9): by shell command,
// by the GitHub API, and by the GitHub MCP tools.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decideCommand } from '../plugins/core/scripts/guard-commands.mjs';
import { commandApprovesPr, toolApprovesPr } from '../plugins/core/scripts/pr-approval.mjs';

const settings = { taskApproval: 'off' };

test('github-gate#AC-9: a shell command that approves a pull request is refused, with the way the approver does it', () => {
  for (const command of [
    'gh pr review 12 --approve',
    'gh pr review --approve',
    'gh pr review 12 -a',
    'gh pr review 12 -a -b "looks good"',
    'gh pr review https://github.com/acme/app/pull/12 --approve --body ok',
    'cd app && gh pr review 12 --approve',
    'gh api repos/acme/app/pulls/12/reviews -f event=APPROVE',
    'gh api -X POST repos/acme/app/pulls/12/reviews --field event=APPROVE -f body=ok',
    'gh api repos/acme/app/pulls/12/reviews/99/events -f event=APPROVE',
    'gh api graphql -f query=\'mutation { addPullRequestReview(input: {pullRequestId: "PR_1", event: APPROVE}) { clientMutationId } }\'',
    'curl -X POST -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/repos/acme/app/pulls/12/reviews -d \'{"event":"APPROVE"}\'',
    'gh pr review 12 --approve; git status',
  ]) {
    const result = decideCommand(command, { settings });
    assert.equal(result?.decision, 'deny', command);
    assert.match(result.reason, /^rfr-core \(github-gate AC-9\): agents do not approve pull requests/, command);
    assert.match(result.reason, /! gh pr review <number> --approve/, command);
  }
});

test('github-gate#AC-9: reviews that do not approve, and the approve line quoted as text, are not refused', () => {
  for (const command of [
    'gh pr review 12 --comment -b "see the decision note"',
    'gh pr review 12 --request-changes -b "the tutorial is missing"',
    'gh pr view 12 --json reviews',
    'gh api repos/acme/app/pulls/12/reviews',
    'gh api repos/acme/app/pulls/12/reviews -f event=COMMENT -f body=noted',
    'git commit -m "Tell the lead to run gh pr review 12 --approve"',
    'echo "! gh pr review 12 --approve"',
    'gh pr create --fill',
  ]) {
    assert.equal(commandApprovesPr(command), null, command);
  }
});

test('github-gate#AC-9: a review sent from a file, whose event the guard cannot read, is refused', () => {
  const result = decideCommand('gh api repos/acme/app/pulls/12/reviews --input review.json', { settings });
  assert.equal(result?.decision, 'deny');
  assert.match(result.reason, /event is in a file/);
});

test('github-gate#AC-9: the refusal comes before task approval, so no instruction allows it', () => {
  // A transcript in which the person asked for the approval: the command is still refused.
  const dir = fs.mkdtempSync(path.join(process.cwd(), '.cache', 'rfr-approve-'));
  try {
    const transcript = path.join(dir, 't.jsonl');
    fs.writeFileSync(transcript, `${JSON.stringify({ type: 'user', message: { role: 'user', content: 'approve pull request 12 and merge it' } })}\n`);
    const result = decideCommand('gh pr review 12 --approve', { cwd: process.cwd(), settings: { taskApproval: 'on' }, transcriptPath: transcript, describePr: () => null });
    assert.equal(result?.decision, 'deny');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('github-gate#AC-9: a GitHub MCP tool that approves a pull request is refused by the hook', () => {
  for (const [tool, input] of [
    ['mcp__github__create_pull_request_review', { owner: 'acme', repo: 'app', pullNumber: 12, event: 'APPROVE' }],
    ['mcp__github__pull_request_review_write', { method: 'create', pullNumber: 12, event: 'APPROVE' }],
    ['mcp__plugin_github_github__submit_pending_pull_request_review', { pullNumber: 12, event: 'approve' }],
    ['mcp__github__create_and_submit_pull_request_review', JSON.stringify({ event: 'APPROVE' })],
  ]) {
    assert.equal(toolApprovesPr(tool, input), true, tool);
  }
  for (const [tool, input] of [
    ['mcp__github__create_pull_request_review', { event: 'COMMENT' }],
    ['mcp__github__pull_request_review_write', { method: 'create', event: 'REQUEST_CHANGES' }],
    ['mcp__github__get_pull_request_reviews', { pullNumber: 12 }],
    ['mcp__github__create_pull_request', { title: 'APPROVE' }],
    ['mcp__vercel__create_review', { event: 'APPROVE' }],
  ]) {
    assert.equal(toolApprovesPr(tool, input), false, tool);
  }

  const hook = path.join('plugins', 'core', 'scripts', 'guard-pr-approval.mjs');
  const run = input => spawnSync(process.execPath, [hook], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, RFR_GUARD_LOG: '0' } });
  const refused = run({ tool_name: 'mcp__github__pull_request_review_write', tool_input: { method: 'create', event: 'APPROVE' } });
  assert.equal(JSON.parse(refused.stdout).hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(run({ tool_name: 'mcp__github__pull_request_review_write', tool_input: { method: 'create', event: 'COMMENT' } }).stdout, '');

  const config = JSON.parse(fs.readFileSync('plugins/core/hooks/hooks.json', 'utf8'));
  const entry = config.hooks.PreToolUse.find(e => e.hooks.some(h => h.command.includes('guard-pr-approval.mjs')));
  assert.ok(entry, 'hooks.json runs guard-pr-approval');
  for (const tool of ['mcp__github__create_pull_request_review', 'mcp__plugin_github_github__pull_request_review_write']) assert.match(tool, new RegExp(`^(?:${entry.matcher})$`), tool);
});
