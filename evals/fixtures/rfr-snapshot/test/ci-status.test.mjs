import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marker, overallResult, postStatus, renderComment } from '../checks/ci/status-comment.mjs';

const SHA = 'b7e4c19d2f8a6e0c3b5d1a9f7e2c4b6d8a0f1e3c';
const needs = (...pairs) => Object.fromEntries(pairs.map(([job, result]) => [job, { result, outputs: {} }]));

test('overall result: passed only when every job succeeded or was skipped', () => {
  assert.equal(overallResult(needs(['verify', 'success'], ['migrations', 'skipped'])), 'passed');
  assert.equal(overallResult(needs(['verify', 'success'], ['lint', 'failure'])), 'failed');
  assert.equal(overallResult(needs(['verify', 'cancelled'])), 'cancelled');
  assert.equal(overallResult(needs(['verify', 'failure'], ['lint', 'cancelled'])), 'failed');
  assert.equal(overallResult({}), 'failed', 'no results is not a pass');
});

test('the comment names the full head SHA, each job, and the run, behind a per-workflow marker', () => {
  const body = renderComment({ workflow: 'CI', sha: SHA, needs: needs(['verify', 'success'], ['migrations', 'skipped']), runUrl: 'https://ci.example/run/1' });
  assert.ok(body.startsWith(marker('CI')));
  assert.match(body, /CI passed/);
  assert.ok(body.includes(SHA));
  assert.match(body, /\| verify \| success \|/);
  assert.match(body, /\| migrations \| skipped \|/);
  assert.match(body, /https:\/\/ci\.example\/run\/1/);
  assert.match(body, /later push/i, 'tells readers the comment goes stale on a new push');
  assert.notEqual(marker('CI'), marker('Unreal Tier 2'));
});

// A fake GitHub REST API: records calls and answers the few endpoints the script uses.
function fakeGitHub({ comments = [], pulls = [], status = 200 } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ method, url, body: init.body ? JSON.parse(init.body) : undefined });
    const ok = status < 400;
    let json = {};
    if (method === 'GET' && /\/issues\/\d+\/comments/.test(url)) json = comments;
    if (method === 'GET' && /\/commits\/[0-9a-f]+\/pulls/.test(url)) json = pulls;
    return { ok, status, json: async () => json, text: async () => JSON.stringify(json) };
  };
  return { fetch, calls };
}

const base = { token: 't', repo: 'acme/app', workflow: 'CI', sha: SHA, needs: needs(['verify', 'success']), runUrl: 'https://ci.example/run/2', log: () => {} };

test('posts a new comment on the pull request when none has the marker', async () => {
  const gh = fakeGitHub({ comments: [{ id: 1, body: 'Looks good' }] });
  await postStatus({ ...base, fetch: gh.fetch, pr: 12 });
  const post = gh.calls.find(c => c.method === 'POST');
  assert.ok(post, JSON.stringify(gh.calls));
  assert.match(post.url, /\/repos\/acme\/app\/issues\/12\/comments$/);
  assert.ok(post.body.body.includes(SHA));
});

test('updates the existing status comment instead of adding another', async () => {
  const gh = fakeGitHub({ comments: [{ id: 7, body: `${marker('CI')}\nold` }, { id: 8, body: `${marker('Guards')}\nother` }] });
  await postStatus({ ...base, fetch: gh.fetch, pr: 12 });
  assert.equal(gh.calls.filter(c => c.method === 'POST').length, 0);
  const patch = gh.calls.find(c => c.method === 'PATCH');
  assert.match(patch.url, /\/issues\/comments\/7$/);
});

test('without a pull request number, comments on the pull requests that contain the commit', async () => {
  const gh = fakeGitHub({ pulls: [{ number: 30, state: 'open' }, { number: 4, state: 'closed' }] });
  await postStatus({ ...base, fetch: gh.fetch, pr: null });
  const posts = gh.calls.filter(c => c.method === 'POST');
  assert.deepEqual(posts.map(p => p.url.match(/issues\/(\d+)/)[1]), ['30']);
});

test('never fails the workflow: no token, no pull request, or a refused write only logs', async () => {
  const logs = [];
  const log = m => logs.push(m);
  await postStatus({ ...base, token: '', fetch: fakeGitHub().fetch, pr: 12, log });
  await postStatus({ ...base, fetch: fakeGitHub({ pulls: [] }).fetch, pr: null, log });
  await postStatus({ ...base, fetch: fakeGitHub({ status: 403 }).fetch, pr: 12, log });
  assert.equal(logs.length, 3, logs.join('\n'));
});

test('the merge-gating template workflows and this repo end with an always-run status job', async () => {
  const fs = (await import('node:fs')).default;
  const reusable = fs.readFileSync('.github/workflows/rfr-ci-status.yml', 'utf8');
  assert.match(reusable, /workflow_call:/);
  assert.match(reusable, /results:\n\s+description:[^\n]*\n\s+type: string\n\s+required: true/);
  assert.match(reusable, /pull-requests: write/);
  for (const file of [
    'templates/repo-files/web-app/.github/workflows/ci.yml',
    'templates/repo-files/static-site/.github/workflows/ci.yml',
    'templates/repo-files/unreal-plugin/.github/workflows/tier1.yml',
    'templates/repo-files/unreal-plugin/.github/workflows/tier2.yml',
    '.github/workflows/verify.yml',
  ]) {
    const text = fs.readFileSync(file, 'utf8');
    const job = text.split(/\n  status:\n/)[1] ?? '';
    assert.ok(job, `${file} has a status job`);
    assert.match(job, /if: always\(\)/, file);
    assert.match(job, /rfr-ci-status\.yml/, file);
    assert.match(job, /results: \$\{\{ toJSON\(needs\) \}\}/, file);
    const jobs = [...text.split('\njobs:\n')[1].matchAll(/^  ([a-z0-9-]+):\n/gm)].map(m => m[1]).filter(j => j !== 'status');
    const needs = /needs: \[([^\]]*)\]/.exec(job)[1].split(',').map(s => s.trim());
    assert.deepEqual([...needs].sort(), [...jobs].sort(), `${file}: status needs every other job`);
  }
});
