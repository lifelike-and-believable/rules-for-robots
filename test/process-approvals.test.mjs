// Tests for the approvals job (docs/specs/project-process.md, "Approval records"): in team mode an
// approving review from each touched stage's approvers on the current head; in solo mode the
// merge by an approver. The GitHub API is a fake that records calls.
// Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runApprovals } from '../checks/ci/process-approvals.mjs';

const TEAM = 'mode: team\ndefault: [lead]\nstages:\n  personas: [ux-lead, "@acme/ux"]\n';
const SOLO = 'mode: solo\ndefault: [lead]\n';

function git(root, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'core.autocrlf=false', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

function write(root, file, text) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}

const artifact = (id, body = '# Title\n') => `---\nid: ${id}\nstatus: draft\n---\n\n${body}`;

// A repository with a base commit, then `change(root)` committed on top. With `merge`, the change
// is made on a branch and merged with --no-ff, so HEAD is a merge commit whose first parent is base.
function repo(config, change, { merge = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-approvals-'));
  git(root, 'init', '-q', '-b', 'main');
  write(root, 'docs/product/process.yml', config);
  write(root, 'docs/product/concept.md', artifact('concept'));
  write(root, 'docs/product/personas/animator.md', artifact('persona-animator'));
  write(root, 'docs/specs/plain.md', '---\nstatus: draft\n---\n\n# Plain spec\n');
  write(root, 'src/app.js', 'export const a = 1;\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  const base = git(root, 'rev-parse', 'HEAD');
  if (merge) git(root, 'checkout', '-q', '-b', 'feature');
  change(root);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'change');
  if (merge) {
    git(root, 'checkout', '-q', 'main');
    git(root, 'merge', '-q', '--no-ff', '-m', 'Merge pull request #9', 'feature');
  }
  return { root, base, head: git(root, 'rev-parse', 'HEAD') };
}

const touchConcept = root => write(root, 'docs/product/concept.md', artifact('concept', '# Title\n\nChanged.\n'));
const touchPersona = root => write(root, 'docs/product/personas/animator.md', artifact('persona-animator', '# Title\n\nChanged.\n'));
const touchCode = root => write(root, 'src/app.js', 'export const a = 2;\n');

// A fake GitHub REST API for the endpoints the job uses.
function fakeGitHub({ reviews = [], members = {}, pulls = [], merged = {} } = {}) {
  const calls = [];
  const issues = [];
  const json = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) });
  const fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const u = new URL(url);
    calls.push({ method, path: u.pathname, search: u.search });
    let m;
    if (method === 'GET' && (m = /^\/repos\/acme\/app\/pulls\/(\d+)\/reviews$/.exec(u.pathname))) {
      const page = Number(u.searchParams.get('page') ?? 1);
      return json(200, page === 1 ? reviews : []);
    }
    if (method === 'GET' && (m = /^\/orgs\/([^/]+)\/teams\/([^/]+)\/memberships\/([^/]+)$/.exec(u.pathname))) {
      const ok = (members[`${m[1]}/${m[2]}`] ?? []).includes(m[3]);
      return ok ? json(200, { state: 'active' }) : json(404, { message: 'Not Found' });
    }
    if (method === 'GET' && (m = /^\/repos\/acme\/app\/commits\/([0-9a-f]+)\/pulls$/.exec(u.pathname))) return json(200, pulls);
    if (method === 'GET' && (m = /^\/repos\/acme\/app\/pulls\/(\d+)$/.exec(u.pathname))) return json(200, merged[m[1]] ?? {});
    if (method === 'POST' && u.pathname === '/repos/acme/app/issues') {
      const body = JSON.parse(init.body);
      issues.push(body);
      return json(201, { number: 100 + issues.length, ...body });
    }
    if (method === 'POST' && u.pathname === '/repos/acme/app/labels') return json(201, {});
    return json(404, { message: `unexpected ${method} ${u.pathname}` });
  };
  return { fetch, calls, issues };
}

const prEnv = ({ base, head }, extra = {}) => ({
  GITHUB_EVENT_NAME: 'pull_request', GITHUB_REPOSITORY: 'acme/app', GITHUB_TOKEN: 't', GITHUB_API_URL: 'https://api.github.test',
  PR_NUMBER: '7', BASE_SHA: base, HEAD_SHA: head, ...extra,
});
const review = (login, state, commit_id, at = '2026-10-31T10:00:00Z') => ({ user: { login }, state, commit_id, submitted_at: at });
const run = (r, env, gh) => runApprovals({ root: r.root, env, fetch: gh.fetch, log: () => {} });

// ---------------------------------------------------------------------------------------------
// Team mode (AC-5)

test('project-process#AC-5: an approving review from the stage approver on the current head passes', async () => {
  const r = repo(TEAM, touchConcept);
  const gh = fakeGitHub({ reviews: [review('lead', 'APPROVED', r.head)] });
  const result = await run(r, prEnv(r), gh);
  assert.equal(result.ok, true, result.problems.join('\n'));
});

test('project-process#AC-5: a gated change with no approving review fails and names the stage and approvers', async () => {
  const r = repo(TEAM, touchConcept);
  const result = await run(r, prEnv(r), fakeGitHub());
  assert.equal(result.ok, false);
  assert.match(result.problems.join('\n'), /concept.*lead/);
});

test('project-process#AC-5: an approval from someone who is not that stage\'s approver does not count', async () => {
  const r = repo(TEAM, touchPersona);
  const result = await run(r, prEnv(r), fakeGitHub({ reviews: [review('lead', 'APPROVED', r.head), review('mallory', 'APPROVED', r.head)] }));
  assert.equal(result.ok, false);
  assert.match(result.problems.join('\n'), /personas.*ux-lead/);

  const both = repo(TEAM, root => { touchConcept(root); touchPersona(root); });
  const partial = await run(both, prEnv(both), fakeGitHub({ reviews: [review('ux-lead', 'APPROVED', both.head)] }));
  assert.equal(partial.ok, false);
  assert.match(partial.problems.join('\n'), /concept/);
  assert.doesNotMatch(partial.problems.join('\n'), /personas/);
});

test('project-process#AC-5: an approval on an earlier commit is stale and does not count', async () => {
  const r = repo(TEAM, touchConcept);
  const result = await run(r, prEnv(r), fakeGitHub({ reviews: [review('lead', 'APPROVED', r.base)] }));
  assert.equal(result.ok, false);
  assert.match(result.problems.join('\n'), /concept/);
});

test('project-process#AC-5: a reviewer\'s latest review counts, so changes requested after an approval fails', async () => {
  const r = repo(TEAM, touchConcept);
  const result = await run(r, prEnv(r), fakeGitHub({
    reviews: [review('lead', 'APPROVED', r.head, '2026-10-31T10:00:00Z'), review('lead', 'CHANGES_REQUESTED', r.head, '2026-10-31T11:00:00Z')],
  }));
  assert.equal(result.ok, false);
});

test('project-process#AC-5: a member of an approving team can approve', async () => {
  const r = repo(TEAM, touchPersona);
  const result = await run(r, prEnv(r), fakeGitHub({ reviews: [review('ux-dana', 'APPROVED', r.head)], members: { 'acme/ux': ['ux-dana'] } }));
  assert.equal(result.ok, true, result.problems.join('\n'));
});

test('project-process#AC-5: an ungated change passes without calling the API', async () => {
  const code = repo(TEAM, touchCode);
  const gh = fakeGitHub();
  assert.equal((await run(code, prEnv(code), gh)).ok, true);
  const plainSpec = repo(TEAM, root => write(root, 'docs/specs/plain.md', '---\nstatus: draft\n---\n\n# Plain spec, edited\n'));
  assert.equal((await run(plainSpec, prEnv(plainSpec), gh)).ok, true);
  assert.deepEqual(gh.calls, []);
});

test('project-process#AC-5: a process spec is gated only when process.yml names spec approvers', async () => {
  const addSpec = root => write(root, 'docs/specs/retarget.md', artifact('spec-retarget'));
  const ungated = repo(TEAM, addSpec);
  assert.equal((await run(ungated, prEnv(ungated), fakeGitHub())).ok, true);
  const gated = repo(`${TEAM}  specs: [spec-lead]\n`, addSpec);
  const result = await run(gated, prEnv(gated), fakeGitHub());
  assert.equal(result.ok, false);
  assert.match(result.problems.join('\n'), /specs.*spec-lead/);
});

test('project-process#AC-5: review events are checked like pull request events, and pushes are not checked in team mode', async () => {
  const r = repo(TEAM, touchConcept);
  assert.equal((await run(r, prEnv(r, { GITHUB_EVENT_NAME: 'pull_request_review' }), fakeGitHub())).ok, false);
  const gh = fakeGitHub();
  assert.equal((await run(r, { ...prEnv(r), GITHUB_EVENT_NAME: 'push', GITHUB_SHA: r.head }, gh)).ok, true);
  assert.deepEqual(gh.calls, []);
});

test('project-process#AC-5: a repository without process.yml is not checked', async () => {
  const r = repo(TEAM, touchConcept);
  fs.rmSync(path.join(r.root, 'docs/product/process.yml'));
  const gh = fakeGitHub();
  assert.equal((await run(r, prEnv(r), gh)).ok, true);
  assert.deepEqual(gh.calls, []);
});

// ---------------------------------------------------------------------------------------------
// Solo mode (AC-6)

const pushEnv = r => ({ GITHUB_EVENT_NAME: 'push', GITHUB_REPOSITORY: 'acme/app', GITHUB_TOKEN: 't', GITHUB_API_URL: 'https://api.github.test', GITHUB_SHA: r.head });
const mergedPr = (r, login) => ({ pulls: [{ number: 9, merged_at: '2026-10-31T12:00:00Z', merge_commit_sha: r.head }], merged: { 9: { number: 9, merged_by: { login }, merge_commit_sha: r.head } } });

test('project-process#AC-6: in solo mode, a merge by an approver of every touched stage passes', async () => {
  const r = repo(SOLO, touchConcept, { merge: true });
  const gh = fakeGitHub(mergedPr(r, 'lead'));
  const result = await run(r, pushEnv(r), gh);
  assert.equal(result.ok, true, result.problems.join('\n'));
  assert.deepEqual(gh.issues, []);
});

test('project-process#AC-6: in solo mode, a merge by someone else fails and opens an issue', async () => {
  const r = repo(SOLO, touchConcept, { merge: true });
  const gh = fakeGitHub(mergedPr(r, 'mallory'));
  const result = await run(r, pushEnv(r), gh);
  assert.equal(result.ok, false);
  assert.match(result.problems.join('\n'), /mallory.*concept|concept.*mallory/);
  assert.equal(gh.issues.length, 1);
  assert.ok(gh.issues[0].labels.includes('process-approval'));
  assert.match(gh.issues[0].body, /mallory/);
  assert.match(gh.issues[0].body, /#9/);
});

test('project-process#AC-6: in solo mode, a direct push to a gated folder fails and opens an issue', async () => {
  const r = repo(SOLO, touchConcept);
  const gh = fakeGitHub({ pulls: [] });
  const result = await run(r, pushEnv(r), gh);
  assert.equal(result.ok, false);
  assert.match(result.problems.join('\n'), /pull request/);
  assert.equal(gh.issues.length, 1);
});

test('project-process#AC-6: in solo mode, ungated pushes and pull request events are not checked', async () => {
  const code = repo(SOLO, touchCode, { merge: true });
  const gh = fakeGitHub();
  assert.equal((await run(code, pushEnv(code), gh)).ok, true);
  const concept = repo(SOLO, touchConcept);
  const pr = await run(concept, prEnv(concept), gh);
  assert.equal(pr.ok, true);
  assert.match(pr.notes.join('\n'), /solo/);
  assert.deepEqual(gh.calls, []);
});
