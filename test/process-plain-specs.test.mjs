// A plain Phase 10 spec (no id) in docs/specs/ is not a process artifact, so it stays ungated even
// when process.yml names spec approvers. Added after the 11b sabotage pass found this untested.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runApprovals } from '../checks/ci/process-approvals.mjs';
import { decideMerge } from '../plugins/process/scripts/guard-merge.mjs';

const CONFIG = 'mode: team\ndefault: [lead]\nstages:\n  specs: [spec-lead]\n';
const PLAIN = '---\nstatus: draft\n---\n\n# Plain spec\n';

function git(root, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-plain-specs-'));
  fs.mkdirSync(path.join(root, 'docs/product'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs/specs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/product/process.yml'), CONFIG);
  fs.writeFileSync(path.join(root, 'docs/specs/plain.md'), PLAIN);
  return root;
}

test('project-process#AC-5: with spec approvers configured, a plain spec change needs no approval', async () => {
  const root = project();
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  const base = git(root, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(root, 'docs/specs/plain.md'), `${PLAIN}\nEdited.\n`);
  git(root, 'commit', '-q', '-am', 'edit');
  const head = git(root, 'rev-parse', 'HEAD');
  const calls = [];
  const fetch = async url => { calls.push(url); return { ok: true, status: 200, json: async () => [] }; };
  const env = { GITHUB_EVENT_NAME: 'pull_request', GITHUB_REPOSITORY: 'acme/app', GITHUB_TOKEN: 't', PR_NUMBER: '1', BASE_SHA: base, HEAD_SHA: head };
  const r = await runApprovals({ root, env, fetch, log: () => {} });
  assert.equal(r.ok, true, r.problems.join('\n'));
  assert.deepEqual(calls, []);
});

test('project-process#AC-7: with spec approvers configured, merging a plain spec change is allowed', () => {
  const root = project();
  const input = { tool_name: 'Bash', tool_input: { command: 'gh pr merge 3' } };
  assert.equal(decideMerge({ input, root, listFiles: () => ['docs/specs/plain.md'] }).deny, false);
});
