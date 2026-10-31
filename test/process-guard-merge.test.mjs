// Tests for the rfr-process merge guard (docs/specs/project-process.md, "Approval records"): agents
// may not merge pull requests that touch gated folders, because in solo mode the merge is the
// approval. Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decideMerge, mergeTarget } from '../plugins/process/scripts/guard-merge.mjs';

function project(config = 'mode: solo\ndefault: [lead]\n') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-guard-merge-'));
  if (config !== null) {
    fs.mkdirSync(path.join(root, 'docs/product'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs/product/process.yml'), config);
  }
  return root;
}

const bash = command => ({ tool_name: 'Bash', tool_input: { command } });
const mcp = (pullNumber = 12) => ({ tool_name: 'mcp__github__merge_pull_request', tool_input: { owner: 'acme', repo: 'app', pullNumber } });
const gated = ['src/app.ts', 'docs/user/retarget.md'];
const ungated = ['src/app.ts', 'README.md'];

test('project-process#AC-7: merge commands and the MCP merge tool are recognized', () => {
  assert.deepEqual(mergeTarget(bash('gh pr merge 12 --merge')), { kind: 'gh', ref: '12' });
  assert.deepEqual(mergeTarget(bash('gh pr merge')), { kind: 'gh', ref: '' });
  assert.deepEqual(mergeTarget(bash('git status && gh pr merge https://github.com/acme/app/pull/12 --squash')), { kind: 'gh', ref: 'https://github.com/acme/app/pull/12' });
  assert.deepEqual(mergeTarget(bash('gh pr merge --auto --merge feature-branch')), { kind: 'gh', ref: 'feature-branch' });
  assert.deepEqual(mergeTarget(bash('gh api -X PUT repos/acme/app/pulls/12/merge')), { kind: 'api', owner: 'acme', repo: 'app', number: 12 });
  assert.deepEqual(mergeTarget(mcp(12)), { kind: 'api', owner: 'acme', repo: 'app', number: 12 });
  assert.equal(mergeTarget(bash('gh pr view 12')), null);
  assert.equal(mergeTarget(bash('git merge main')), null);
  assert.equal(mergeTarget({ tool_name: 'mcp__github__get_pull_request', tool_input: {} }), null);
});

test('project-process#AC-7: merging a pull request that touches a gated folder is blocked', () => {
  const root = project();
  const seen = [];
  const listFiles = target => { seen.push(target); return gated; };
  const viaGh = decideMerge({ input: bash('gh pr merge 12 --merge'), root, listFiles });
  assert.equal(viaGh.deny, true);
  assert.match(viaGh.reason, /docs\/user\/retarget\.md/);
  assert.equal(decideMerge({ input: mcp(), root, listFiles }).deny, true);
  assert.deepEqual(seen, [{ kind: 'gh', ref: '12' }, { kind: 'api', owner: 'acme', repo: 'app', number: 12 }]);
});

test('project-process#AC-7: merging a pull request that touches no gated folder is allowed', () => {
  const root = project();
  assert.equal(decideMerge({ input: bash('gh pr merge 12'), root, listFiles: () => ungated }).deny, false);
  assert.equal(decideMerge({ input: mcp(), root, listFiles: () => ungated }).deny, false);
});

test('project-process#AC-7: process specs are gated only when spec approvers are configured', () => {
  const files = ['docs/specs/retarget.md'];
  const root = project('mode: team\ndefault: [lead]\n');
  fs.mkdirSync(path.join(root, 'docs/specs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/specs/retarget.md'), '---\nid: spec-retarget\nstatus: draft\n---\n\n# Spec\n');
  assert.equal(decideMerge({ input: bash('gh pr merge 12'), root, listFiles: () => files }).deny, false);
  fs.writeFileSync(path.join(root, 'docs/product/process.yml'), 'mode: team\ndefault: [lead]\nstages:\n  specs: [lead]\n');
  assert.equal(decideMerge({ input: bash('gh pr merge 12'), root, listFiles: () => files }).deny, true);
});

test('project-process#AC-7: when the pull request\'s files cannot be listed, the merge is blocked', () => {
  const root = project();
  const result = decideMerge({ input: bash('gh pr merge 12'), root, listFiles: () => { throw new Error('gh: not found'); } });
  assert.equal(result.deny, true);
  assert.match(result.reason, /could not/i);
});

test('project-process#AC-7: without process.yml, or for other commands, nothing is checked', () => {
  let called = false;
  const listFiles = () => { called = true; return gated; };
  assert.equal(decideMerge({ input: bash('gh pr merge 12'), root: project(null), listFiles }).deny, false);
  assert.equal(decideMerge({ input: bash('gh pr view 12'), root: project(), listFiles }).deny, false);
  assert.equal(called, false);
});

test('project-process#AC-7: the plugin registers the guard for shell commands and the MCP merge tool', () => {
  const hooks = JSON.parse(fs.readFileSync('plugins/process/hooks/hooks.json', 'utf8'));
  const entries = hooks.hooks.PreToolUse ?? [];
  const guarded = name => entries.some(e => new RegExp(`^(?:${e.matcher})$`).test(name) && e.hooks.some(h => /guard-merge\.mjs/.test(h.command)));
  assert.ok(guarded('Bash'));
  assert.ok(guarded('mcp__github__merge_pull_request'));
  assert.ok(!guarded('Edit'));
});

test('project-process#AC-7: the hook prints a deny decision, and nothing for an allowed command', () => {
  const root = project();
  const script = path.resolve('plugins/process/scripts/guard-merge.mjs');
  const quiet = spawnSync(process.execPath, [script], { input: JSON.stringify({ ...bash('gh pr view 12'), cwd: root }), encoding: 'utf8' });
  assert.equal(quiet.status, 0);
  assert.equal(quiet.stdout, '');
  // With PATH emptied, gh cannot run, so the files cannot be listed and the merge is denied.
  const denied = spawnSync(process.execPath, [script], { input: JSON.stringify({ ...bash('gh pr merge 12'), cwd: root }), encoding: 'utf8', env: { PATH: '' } });
  assert.equal(denied.status, 0);
  const out = JSON.parse(denied.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
});
