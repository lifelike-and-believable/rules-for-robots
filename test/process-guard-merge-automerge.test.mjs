// Tests for the rfr-process merge guard and auto-merge (docs/specs/project-process.md, "Approval
// records"): turning on auto-merge merges the pull request later without another step, so it
// counts as a merge, while read-only calls and turning auto-merge off do not. Each test title
// cites the criterion it covers (project-process#AC-53).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decideMerge, mergeTarget } from '../plugins/process/scripts/guard-merge.mjs';

const bash = command => ({ tool_name: 'Bash', tool_input: { command } });
const enable = (pullNumber = 12) => ({ tool_name: 'mcp__github__enable_pr_auto_merge', tool_input: { owner: 'acme', repo: 'app', pullNumber } });
const api12 = { kind: 'api', owner: 'acme', repo: 'app', number: 12 };

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-guard-automerge-'));
  fs.mkdirSync(path.join(root, 'docs/product'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/product/process.yml'), 'mode: solo\ndefault: [lead]\n');
  return root;
}

test('project-process#AC-53: turning on auto-merge counts as a merge', () => {
  assert.deepEqual(mergeTarget(enable()), api12);
  assert.deepEqual(mergeTarget(bash('gh api -X PUT repos/acme/app/pulls/12/ccr/auto_merge -f merge_method=squash')), api12);
  assert.deepEqual(mergeTarget(bash('gh api --method PUT /repos/acme/app/pulls/12/ccr/auto_merge')), api12);
  assert.deepEqual(mergeTarget(bash('gh pr merge 12 --auto --squash')), { kind: 'gh', ref: '12' });
  assert.equal(mergeTarget(bash('gh api graphql -f query="mutation { enablePullRequestAutoMerge(input: {pullRequestId: \\"X\\"}) { clientMutationId } }"')).kind, 'unknown');
  assert.equal(mergeTarget(bash('gh api graphql -f query="mutation { mergePullRequest(input: {pullRequestId: \\"X\\"}) { clientMutationId } }"')).kind, 'unknown');

  const hooks = JSON.parse(fs.readFileSync('plugins/process/hooks/hooks.json', 'utf8'));
  const guarded = name => hooks.hooks.PreToolUse.some(e => new RegExp(`^(?:${e.matcher})$`).test(name) && e.hooks.some(h => /guard-merge\.mjs/.test(h.command)));
  assert.ok(guarded('mcp__github__enable_pr_auto_merge'));
  assert.ok(guarded('mcp__github__merge_pull_request'));
});

test('project-process#AC-53: auto-merge on a gated pull request asks unless the person said to merge it', () => {
  const root = project();
  const listFiles = () => ['docs/design/reader.md'];
  const describePr = () => ({ number: 12, createdAt: '2026-11-07T12:00:00Z' });
  assert.equal(decideMerge({ input: enable(), root, listFiles, describePr }).ask, true);
  const transcript = path.join(root, 'session.jsonl');
  fs.writeFileSync(transcript, JSON.stringify({ type: 'user', origin: { kind: 'human' }, timestamp: '2026-11-07T12:30:00Z', message: { role: 'user', content: 'merge when green' } }) + '\n');
  assert.equal(decideMerge({ input: { ...enable(), transcript_path: transcript }, root, listFiles, describePr }).ask, false);
  // A call whose pull request cannot be identified asks.
  const unknown = decideMerge({ input: bash('gh api graphql -f query="mutation { mergePullRequest(input: {pullRequestId: \\"X\\"}) { clientMutationId } }"'), root, listFiles: undefined, describePr });
  assert.equal(unknown.ask, true);
});

test('project-process#AC-53: read-only calls and turning auto-merge off are not merges', () => {
  assert.equal(mergeTarget(bash('gh api repos/acme/app/pulls/12/merge')), null);
  assert.equal(mergeTarget(bash('gh api -X GET repos/acme/app/pulls/12/merge')), null);
  assert.equal(mergeTarget(bash('gh api -X DELETE repos/acme/app/pulls/12/ccr/auto_merge')), null);
  assert.equal(mergeTarget({ tool_name: 'mcp__github__disable_pr_auto_merge', tool_input: { owner: 'acme', repo: 'app', pullNumber: 12 } }), null);
  assert.equal(mergeTarget(bash('gh api graphql -f query="query { repository(owner: \\"a\\", name: \\"b\\") { mergeCommitAllowed } }"')), null);
});
