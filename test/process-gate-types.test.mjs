// Gate types (docs/specs/project-process.md AC-55 to AC-58, process plan 23b): approve, notify, and
// agent gates per stage, with defaults set by the project's working mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DELEGATED_GATES, gateOf, parseProcessConfig, readWorkMode, stagesWithGate } from '../checks/lib/process.mjs';
import { runApprovals } from '../checks/ci/process-approvals.mjs';
import { decideMerge } from '../plugins/process/scripts/guard-merge.mjs';

const parse = text => parseProcessConfig(text);

test('project-process#AC-55: gates: is parsed, and unknown stages or types are rejected', () => {
  const ok = parse('default: [lead]\ngates:\n  stories: agent\n  requirements: notify\n');
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.config.gates, { stories: 'agent', requirements: 'notify' });
  assert.match(parse('default: [lead]\ngates:\n  stories: maybe\n').errors.join('\n'), /must be one of approve, notify, agent/);
  assert.match(parse('default: [lead]\ngates:\n  sprints: notify\n').errors.join('\n'), /unknown stage "sprints"/);
  assert.match(parse('default: [lead]\ngates: [stories]\n').errors.join('\n'), /must map stage names/);
});

test('project-process#AC-55: defaults by working mode, and an explicit gate wins', () => {
  const { config } = parse('default: [lead]\n');
  for (const stage of Object.keys(DELEGATED_GATES)) assert.equal(gateOf(stage, config, 'supervised'), 'approve', stage);
  assert.deepEqual(stagesWithGate(config, 'delegated', 'approve'), ['concept', 'design', 'user-docs', 'tutorials']);
  assert.deepEqual(stagesWithGate(config, 'delegated', 'notify'), ['discovery', 'requirements', 'personas', 'epics', 'stories']);
  const explicit = parse('default: [lead]\ngates:\n  concept: notify\n  stories: approve\n').config;
  assert.equal(gateOf('concept', explicit, 'delegated'), 'notify');
  assert.equal(gateOf('stories', explicit, 'delegated'), 'approve');
  assert.equal(gateOf('concept', explicit, 'supervised'), 'notify');
});

test('project-process#AC-55: the working mode comes from .claude/rfr.json, supervised by default', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-mode-'));
  assert.equal(readWorkMode(root), 'supervised');
  fs.mkdirSync(path.join(root, '.claude'));
  fs.writeFileSync(path.join(root, '.claude', 'rfr.json'), '{ "testWeakening": "defer" }');
  assert.equal(readWorkMode(root), 'supervised');
  fs.writeFileSync(path.join(root, '.claude', 'rfr.json'), '{ "mode": "delegated" }');
  assert.equal(readWorkMode(root), 'delegated');
  fs.writeFileSync(path.join(root, '.claude', 'rfr.json'), 'not json');
  assert.equal(readWorkMode(root), 'supervised');
});

// ---- the approvals job --------------------------------------------------------------------------

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

// A repository with the given process.yml and optional work mode; `files` change on a branch that is
// merged with --no-ff as "Merge pull request #9".
function repo(config, files, { mode = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-gates-'));
  git(root, 'init', '-q', '-b', 'main');
  write(root, 'docs/product/process.yml', config);
  if (mode) write(root, '.claude/rfr.json', JSON.stringify({ mode }));
  write(root, 'docs/product/concept.md', artifact('concept'));
  write(root, 'docs/product/stories/a.md', artifact('story-a'));
  write(root, 'docs/product/requirements/r.md', artifact('req-r'));
  git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'base');
  const base = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '-q', '-b', 'feature');
  for (const f of files) write(root, f, artifact(path.basename(f, '.md'), '# Title\n\nChanged.\n'));
  git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'change');
  const branchHead = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '-q', 'main');
  git(root, 'merge', '-q', '--no-ff', '-m', 'Merge pull request #9', 'feature');
  return { root, base, branchHead, merge: git(root, 'rev-parse', 'HEAD') };
}

function fakeGitHub({ reviews = [], comments = [], mergedBy = 'lead', head = '' } = {}) {
  const issues = [];
  const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const u = new URL(url);
    const page = Number(u.searchParams.get('page') ?? 1);
    if (method === 'GET' && /\/pulls\/\d+\/reviews$/.test(u.pathname)) return json(200, page === 1 ? reviews : []);
    if (method === 'GET' && /\/issues\/\d+\/comments$/.test(u.pathname)) return json(200, page === 1 ? comments : []);
    if (method === 'GET' && /\/commits\/[0-9a-f]+\/pulls$/.test(u.pathname)) return json(200, []);
    if (method === 'GET' && /\/pulls\/9$/.test(u.pathname)) return json(200, { number: 9, merged_at: '2026-11-10T10:00:00Z', merge_commit_sha: fetch.merge, merged_by: { login: mergedBy }, head: { sha: head } });
    if (method === 'POST' && u.pathname.endsWith('/issues')) { issues.push(JSON.parse(init.body)); return json(201, { number: 50 }); }
    if (method === 'POST' && u.pathname.endsWith('/labels')) return json(201, {});
    return json(404, { message: `unexpected ${method} ${u.pathname}` });
  };
  return { fetch, issues };
}
const env = (extra) => ({ GITHUB_REPOSITORY: 'acme/app', GITHUB_TOKEN: 't', GITHUB_API_URL: 'https://api.github.test', ...extra });
const marker = sha => ({ body: `<!-- rfr-agent-review head=${sha} -->\nReviewers: code-reviewer. No findings.` });

test('project-process#AC-56: team mode: an agent stage needs the marker on the head; an approve or notify stage is not checked by the job', async () => {
  const TEAM = 'mode: team\ndefault: [lead]\ngates:\n  stories: agent\n  requirements: notify\n';
  const r = repo(TEAM, ['docs/product/stories/a.md', 'docs/product/requirements/r.md']);
  const pr = { GITHUB_EVENT_NAME: 'pull_request', PR_NUMBER: '9', BASE_SHA: r.base, HEAD_SHA: r.branchHead };
  const ok = await runApprovals({ root: r.root, env: env(pr), fetch: fakeGitHub({ comments: [marker(r.branchHead)] }).fetch, log: () => {} });
  assert.equal(ok.ok, true, ok.problems.join('\n'));
  const missing = await runApprovals({ root: r.root, env: env(pr), fetch: fakeGitHub().fetch, log: () => {} });
  assert.match(missing.problems.join('\n'), /stories: needs an independent review recorded/);
  const old = await runApprovals({ root: r.root, env: env(pr), fetch: fakeGitHub({ comments: [marker(r.base)] }).fetch, log: () => {} });
  assert.equal(old.ok, false, 'a marker on an older commit does not count');
  // An approve stage is the approver's review in GitHub (branch protection), so the job passes it
  // without calling the reviews API (amended 2026-11-12, rewrite plan 25e).
  const withConcept = repo(TEAM, ['docs/product/concept.md']);
  const calls = [];
  const inner = fakeGitHub().fetch;
  const counting = async (url, init) => { calls.push(String(url)); return inner(url, init); };
  const concept = await runApprovals({ root: withConcept.root, env: env({ GITHUB_EVENT_NAME: 'pull_request', PR_NUMBER: '9', BASE_SHA: withConcept.base, HEAD_SHA: withConcept.branchHead }), fetch: counting, log: () => {} });
  assert.equal(concept.ok, true, concept.problems.join('\n'));
  assert.deepEqual(calls, [], 'no reviews or other API call for an approve stage');
  // A pull_request_review event is checked like a pull_request event: the agent gate's re-run path.
  const review = await runApprovals({ root: r.root, env: env({ ...pr, GITHUB_EVENT_NAME: 'pull_request_review' }), fetch: fakeGitHub().fetch, log: () => {} });
  assert.match(review.problems.join('\n'), /stories: needs an independent review recorded/);
});

test('project-process#AC-56: solo mode checks an agent stage on the pull request, as team mode does, and again after the merge', async () => {
  const SOLO = 'mode: solo\ndefault: [lead]\ngates:\n  stories: agent\n';
  const r = repo(SOLO, ['docs/product/stories/a.md']);
  const pr = { GITHUB_EVENT_NAME: 'pull_request', PR_NUMBER: '9', BASE_SHA: r.base, HEAD_SHA: r.branchHead };
  const ok = await runApprovals({ root: r.root, env: env(pr), fetch: fakeGitHub({ comments: [marker(r.branchHead)] }).fetch, log: () => {} });
  assert.equal(ok.ok, true, ok.problems.join('\n'));
  const missing = await runApprovals({ root: r.root, env: env(pr), fetch: fakeGitHub().fetch, log: () => {} });
  assert.match(missing.problems.join('\n'), /stories: needs an independent review recorded/);
  const push = env({ GITHUB_EVENT_NAME: 'push', GITHUB_SHA: r.merge });
  const reviewed = fakeGitHub({ comments: [marker(r.branchHead)], mergedBy: 'agent-bot', head: r.branchHead });
  reviewed.fetch.merge = r.merge;
  const after = await runApprovals({ root: r.root, env: push, fetch: reviewed.fetch, log: () => {} });
  assert.equal(after.ok, true, after.problems.join('\n'));
  assert.equal(reviewed.issues.length, 0, 'no process-approval issue');
  const unreviewed = fakeGitHub({ mergedBy: 'agent-bot', head: r.branchHead });
  unreviewed.fetch.merge = r.merge;
  const missed = await runApprovals({ root: r.root, env: push, fetch: unreviewed.fetch, log: () => {} });
  assert.match(missed.problems.join('\n'), /stories: #9 merged with no independent review/);
  assert.equal(unreviewed.issues.length, 1, 'a process-approval issue is opened');
  assert.deepEqual(unreviewed.issues[0].labels, ['process-approval']);
});

test('project-process#AC-57: a merged notify stage opens one decision-queue issue with the files and a default', async () => {
  const r = repo('mode: solo\ndefault: [lead]\n', ['docs/product/stories/a.md', 'docs/product/requirements/r.md'], { mode: 'delegated' });
  const gh = fakeGitHub({ mergedBy: 'agent-bot', head: r.branchHead });
  gh.fetch.merge = r.merge;
  const result = await runApprovals({ root: r.root, env: env({ GITHUB_EVENT_NAME: 'push', GITHUB_SHA: r.merge }), fetch: gh.fetch, log: () => {} });
  assert.equal(result.ok, true, result.problems.join('\n'));
  assert.equal(gh.issues.length, 1);
  const [issue] = gh.issues;
  assert.deepEqual(issue.labels, ['needs-lead']);
  assert.match(issue.body, /<!-- rfr-decision -->/);
  assert.match(issue.body, /- A: Keep them as merged/);
  assert.match(issue.body, /- B: Object/);
  assert.match(issue.body, /\*\*Default:\*\* A \(takes effect \d{4}-\d{2}-\d{2}\)/);
  assert.match(issue.body, /docs\/product\/stories\/a\.md/);
  assert.match(issue.body, /docs\/product\/requirements\/r\.md/);
  assert.match(issue.title, /#9/);
  const supervised = repo('mode: solo\ndefault: [lead]\n', ['docs/product/stories/a.md']);
  const gh2 = fakeGitHub({ mergedBy: 'lead', head: supervised.branchHead });
  gh2.fetch.merge = supervised.merge;
  await runApprovals({ root: supervised.root, env: env({ GITHUB_EVENT_NAME: 'push', GITHUB_SHA: supervised.merge }), fetch: gh2.fetch, log: () => {} });
  assert.equal(gh2.issues.length, 0, 'no notify stage, no queue issue');
});

test('project-process#AC-58: the merge guard asks only for approve stages', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-guard-gates-'));
  write(root, 'docs/product/process.yml', 'mode: solo\ndefault: [lead]\n');
  write(root, '.claude/rfr.json', '{ "mode": "delegated" }');
  const input = { tool_name: 'Bash', tool_input: { command: 'gh pr merge 9 --merge' } };
  const decide = files => decideMerge({ input, root, listFiles: () => files, describePr: () => ({}) });
  assert.equal(decide(['docs/product/stories/a.md', 'docs/product/requirements/r.md']).ask, false, 'notify stages only');
  assert.equal(decide(['docs/design/home.md']).ask, true, 'design is approve in delegated mode');
  fs.writeFileSync(path.join(root, '.claude', 'rfr.json'), '{}');
  assert.equal(decide(['docs/product/stories/a.md']).ask, true, 'supervised: every stage still asks');
  write(root, 'docs/product/process.yml', 'mode: solo\ndefault: [lead]\ngates:\n  stories: agent\n');
  assert.equal(decide(['docs/product/stories/a.md']).ask, false, 'an agent gate does not ask');
});
