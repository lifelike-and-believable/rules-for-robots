// Tests for the Agentic XR Pipeline personas feedback and the solo-merge false alarm
// (docs/specs/project-process.md, "Project findings: Agentic XR Pipeline, round 3").
// Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';
import { runApprovals } from '../checks/ci/process-approvals.mjs';
import { syncIssues } from '../checks/ci/process-sync.mjs';

function write(root, file, text) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}
function git(root, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

// ---- AC-46: [to validate] ----------------------------------------------------------------------

const CONCEPT = '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\n## Audience\n\nPerformers.\n';
const persona = body => `---\nid: persona-performer\nstatus: approved\nderived-from:\n  - concept#audience:\n---\n\n# Solo performer\n\n## Goals\n\n${body}\n`;

function personaProject(body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-xr3-'));
  write(root, 'docs/product/process.yml', 'default: [lead]\n');
  write(root, 'docs/product/concept.md', CONCEPT);
  write(root, 'docs/product/personas/performer.md', persona(body));
  relink(root, ['persona-performer']);
  return runProcessTrace(root, {});
}

test('project-process#AC-46: an approved artifact with [to validate] is listed but not warned about', () => {
  const r = personaProject('- Runs a show alone, with no operator. [to validate]\n- Streams weekly. [to validate]');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings.filter(w => /to validate/.test(w)), [], r.warnings.join('\n'));
  const items = (r.openItems ?? []).filter(o => o.id === 'persona-performer');
  assert.deepEqual(items.map(o => o.marker), ['[to validate]', '[to validate]']);
});

test('project-process#AC-46: the warning for [assumed] does not suggest rewording it as settled text', () => {
  const r = personaProject('- Runs a show alone. [assumed]');
  const w = r.warnings.filter(x => /\[assumed\]/.test(x));
  assert.equal(w.length, 1, r.warnings.join('\n'));
  assert.doesNotMatch(w[0], /reword/i);
  assert.match(w[0], /\[to validate\]/);
});

// ---- AC-47 and AC-48: approvals ----------------------------------------------------------------

const SOLO = 'mode: solo\ndefault: [lead]\n';
const artifact = (id, body = '# Title\n') => `---\nid: ${id}\nstatus: draft\n---\n\n${body}`;

function soloRepo({ squashSubject = null, gates = '' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-xr3-approvals-'));
  git(root, 'init', '-q', '-b', 'main');
  write(root, 'docs/product/process.yml', SOLO + gates);
  write(root, 'docs/product/concept.md', artifact('concept'));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  if (squashSubject) {
    write(root, 'docs/product/concept.md', artifact('concept', '# Title\n\nChanged.\n'));
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', squashSubject);
  } else {
    git(root, 'checkout', '-q', '-b', 'feature');
    write(root, 'docs/product/concept.md', artifact('concept', '# Title\n\nChanged.\n'));
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'change');
    git(root, 'checkout', '-q', 'main');
    git(root, 'merge', '-q', '--no-ff', '-m', 'Merge pull request #2 from acme/feature', 'feature');
  }
  return { root, head: git(root, 'rev-parse', 'HEAD') };
}

// A fake GitHub where the commit-to-pull-request lookup is empty. `fail` returns a status to answer
// with instead, per call to a path, to simulate server errors.
function fakeGitHub({ prs = {}, fail = () => null } = {}) {
  const issues = [];
  const counts = new Map();
  const res = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) });
  const fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const u = new URL(url);
    const key = `${method} ${u.pathname}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const status = fail(key, counts.get(key));
    if (status) return res(status, { message: 'Server Error' });
    let m;
    if (method === 'GET' && /^\/repos\/acme\/app\/commits\/[0-9a-f]+\/pulls$/.test(u.pathname)) return res(200, []);
    if (method === 'GET' && (m = /^\/repos\/acme\/app\/pulls\/(\d+)$/.exec(u.pathname))) return prs[m[1]] ? res(200, prs[m[1]]) : res(404, { message: 'Not Found' });
    if (method === 'POST' && u.pathname === '/repos/acme/app/issues') { issues.push(JSON.parse(init.body)); return res(201, { number: 50 }); }
    if (method === 'POST' && u.pathname === '/repos/acme/app/labels') return res(201, {});
    return res(404, { message: `unexpected ${key}` });
  };
  return { fetch, issues, counts };
}

const pushEnv = r => ({ GITHUB_EVENT_NAME: 'push', GITHUB_REPOSITORY: 'acme/app', GITHUB_TOKEN: 't', GITHUB_API_URL: 'https://api.github.test', GITHUB_SHA: r.head });
const approve = (r, gh) => runApprovals({ root: r.root, env: pushEnv(r), fetch: gh.fetch, log: () => {}, sleep: async () => {} });
const mergedPr = (number, sha, login = 'lead') => ({ number, merged: true, merged_at: '2026-11-05T12:00:00Z', merge_commit_sha: sha, merged_by: { login } });

test('project-process#AC-48: approvals retries a server error and then passes', async () => {
  // Since rewrite plan 25e the job calls GitHub after a merge only for a notify stage: the lookup of
  // the merge's pull request fails once with a 502, is retried, and the decision-queue issue opens.
  const r = soloRepo({ gates: 'gates:\n  concept: notify\n' });
  const gh = fakeGitHub({ fail: (key, n) => (/commits\/[0-9a-f]+\/pulls$/.test(key) && n === 1 ? 502 : null) });
  const result = await approve(r, gh);
  assert.equal(result.ok, true, result.problems.join('\n'));
  assert.equal(gh.counts.get(`GET /repos/acme/app/commits/${r.head}/pulls`), 2);
  assert.equal(gh.issues.length, 1);
  assert.match(gh.issues[0].title, /#2/, 'the pull request number comes from the merge subject when the lookup is empty');
});

// ---- AC-48: issue sync -------------------------------------------------------------------------

function syncProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-xr3-sync-'));
  write(root, 'docs/product/process.yml', 'default: [lead]\n');
  write(root, 'docs/product/concept.md', '---\nid: concept\nstatus: approved\n---\n\n# Concept\n');
  write(root, 'docs/product/personas/performer.md', '---\nid: persona-performer\nstatus: draft\n---\n\n# Performer\n');
  return root;
}

function issuesApi({ fail = () => null } = {}) {
  const issues = [];
  let creates = 0;
  const res = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) });
  const fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const u = new URL(url);
    if (method === 'GET' && u.pathname === '/repos/acme/app/issues') return res(200, []);
    if (method === 'POST' && u.pathname === '/repos/acme/app/labels') return res(201, {});
    if (method === 'POST' && u.pathname === '/repos/acme/app/issues') {
      const status = fail(++creates);
      if (status) return res(status, { message: 'Server Error' });
      const body = JSON.parse(init.body);
      issues.push(body);
      return res(201, { number: issues.length, id: 900 + issues.length, ...body, state: 'open', labels: (body.labels ?? []).map(name => ({ name })) });
    }
    return res(404, { message: `unexpected ${method} ${u.pathname}` });
  };
  return { fetch, issues };
}
const sync = (root, api) => syncIssues({ root, fetch: api.fetch, api: 'https://api.github.test', token: 't', repo: 'acme/app', sleep: async () => {}, log: () => {} });

test('project-process#AC-48: issue sync retries a server error and then creates the issue', async () => {
  const api = issuesApi({ fail: n => (n === 1 ? 500 : null) });
  const r = await sync(syncProject(), api);
  assert.equal(r.created, 1);
  assert.equal(api.issues.length, 1);
});

test('project-process#AC-48: a server error on every attempt still fails', async () => {
  const api = issuesApi({ fail: () => 500 });
  await assert.rejects(sync(syncProject(), api), /HTTP 500/);
});
