// Tests for the issue sync (docs/specs/project-process.md, "Issue sync"): personas, epics, and
// stories mirrored to GitHub issues from the files, which always win. The GitHub API is an
// in-memory fake. Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncIssues } from '../checks/ci/process-sync.mjs';

function write(root, file, text) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}

const art = (id, status, title, links = []) =>
  `---\nid: ${id}\nstatus: ${status}\n${links.length ? `derived-from:\n${links.map(l => `  - ${l}:\n`).join('')}` : ''}---\n\n# ${title}\n\nBody.\n`;

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-sync-'));
  write(root, 'docs/product/process.yml', 'default: [lead]\n');
  write(root, 'docs/product/concept.md', art('concept', 'approved', 'Concept'));
  write(root, 'docs/product/personas/animator.md', art('persona-animator', 'approved', 'Animator', ['concept']));
  write(root, 'docs/product/epics/retarget.md', art('epic-retarget', 'approved', 'Retargeting', ['persona-animator']));
  write(root, 'docs/product/stories/retarget/batch.md', art('story-retarget-batch', 'draft', 'Batch retarget', ['epic-retarget', 'persona-animator']));
  write(root, 'docs/design/retarget.md', art('design-retarget', 'draft', 'Retarget dialog', ['story-retarget-batch']));
  return root;
}

// In-memory issues API. `limit` decides, per write attempt, whether to answer with a rate limit:
// it returns null to allow, or { status, retryAfter }.
function fakeGitHub({ limit = () => null } = {}) {
  const issues = [];
  const subIssues = [];
  const labels = new Set();
  let writes = 0;
  const res = (status, body, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(headers), json: async () => body, text: async () => JSON.stringify(body) });
  const view = i => ({ ...i, labels: i.labels.map(name => ({ name })) });
  const fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    let m;
    if (method === 'GET' && u.pathname === '/repos/acme/app/issues') {
      const want = u.searchParams.get('labels');
      const page = Number(u.searchParams.get('page') ?? 1);
      const per = Number(u.searchParams.get('per_page') ?? 30);
      const all = issues.filter(i => !want || i.labels.includes(want));
      return res(200, all.slice((page - 1) * per, page * per).map(view));
    }
    if (method === 'POST' && u.pathname === '/repos/acme/app/labels') {
      if (labels.has(body.name)) return res(422, { message: 'already_exists' });
      labels.add(body.name);
      return res(201, body);
    }
    if ((method === 'POST' && u.pathname === '/repos/acme/app/issues') || (method === 'PATCH' && /^\/repos\/acme\/app\/issues\/\d+$/.test(u.pathname))) {
      const limited = limit(++writes);
      if (limited) return res(limited.status, { message: 'You have exceeded a secondary rate limit.' }, { 'retry-after': String(limited.retryAfter) });
      if (method === 'POST') {
        const issue = { number: issues.length + 1, id: 9000 + issues.length + 1, title: body.title, body: body.body, state: 'open', labels: [...(body.labels ?? [])] };
        issues.push(issue);
        return res(201, view(issue));
      }
      const issue = issues.find(i => i.number === Number(u.pathname.split('/').pop()));
      if (body.title !== undefined) issue.title = body.title;
      if (body.body !== undefined) issue.body = body.body;
      if (body.state !== undefined) issue.state = body.state;
      if (body.labels !== undefined) issue.labels = [...body.labels];
      return res(200, view(issue));
    }
    if (method === 'POST' && (m = /^\/repos\/acme\/app\/issues\/(\d+)\/sub_issues$/.exec(u.pathname))) {
      subIssues.push({ parent: Number(m[1]), child: body.sub_issue_id });
      return res(201, {});
    }
    return res(404, { message: `unexpected ${method} ${u.pathname}` });
  };
  return { fetch, issues, subIssues, labels };
}

const sync = (root, gh, extra = {}) => syncIssues({ root, fetch: gh.fetch, api: 'https://api.github.test', token: 't', repo: 'acme/app', sleep: async () => {}, log: () => {}, ...extra });
const byTitle = (gh, title) => gh.issues.find(i => i.title === title);
const labelSet = issue => [...issue.labels].sort();

test('project-process#AC-11: personas, epics, and stories each get an issue with stage labels, and stories sit under their epic', async () => {
  const root = project();
  const gh = fakeGitHub();
  const r = await sync(root, gh);
  assert.equal(r.created, 3);
  assert.equal(r.stopped, false);
  assert.deepEqual(gh.issues.map(i => i.title).sort(), ['Epic: Retargeting', 'Persona: Animator', 'Story: Batch retarget']);
  assert.deepEqual(labelSet(byTitle(gh, 'Persona: Animator')), ['rfr-process', 'stage:personas']);
  assert.deepEqual(labelSet(byTitle(gh, 'Story: Batch retarget')), ['rfr-process', 'stage:stories']);
  const story = byTitle(gh, 'Story: Batch retarget');
  assert.match(story.body, /rfr-process:story-retarget-batch/);
  assert.match(story.body, /docs\/product\/stories\/retarget\/batch\.md/);
  assert.match(story.body, /draft/);
  assert.deepEqual(gh.subIssues, [{ parent: byTitle(gh, 'Epic: Retargeting').number, child: story.id }]);
});

test('project-process#AC-11: a second run with no changes writes nothing', async () => {
  const root = project();
  const gh = fakeGitHub();
  await sync(root, gh);
  const again = await sync(root, gh);
  assert.deepEqual({ created: again.created, updated: again.updated, closed: again.closed }, { created: 0, updated: 0, closed: 0 });
  assert.equal(gh.issues.length, 3);
});

test('project-process#AC-11: changes to the file update the issue', async () => {
  const root = project();
  const gh = fakeGitHub();
  await sync(root, gh);
  write(root, 'docs/product/stories/retarget/batch.md', art('story-retarget-batch', 'approved', 'Retarget a batch of clips', ['epic-retarget', 'persona-animator']));
  const r = await sync(root, gh);
  assert.equal(r.updated, 1);
  const story = gh.issues.find(i => /rfr-process:story-retarget-batch/.test(i.body));
  assert.equal(story.title, 'Story: Retarget a batch of clips');
  assert.match(story.body, /approved/);
});

test('project-process#AC-11: hand-edited stage labels are overwritten and other labels are kept', async () => {
  const root = project();
  const gh = fakeGitHub();
  await sync(root, gh);
  const epic = byTitle(gh, 'Epic: Retargeting');
  epic.labels = ['rfr-process', 'stage:stories', 'priority:high'];
  const r = await sync(root, gh);
  assert.equal(r.updated, 1);
  assert.deepEqual(labelSet(epic), ['priority:high', 'rfr-process', 'stage:epics']);
});

test('project-process#AC-11: hand edits to an issue\'s state or title are overwritten from the file', async () => {
  const root = project();
  const gh = fakeGitHub();
  await sync(root, gh);
  const persona = byTitle(gh, 'Persona: Animator');
  persona.state = 'closed';
  persona.title = 'Animators';
  await sync(root, gh);
  assert.equal(persona.state, 'open');
  assert.equal(persona.title, 'Persona: Animator');
});

test('project-process#AC-11: deleting an artifact closes its issue', async () => {
  const root = project();
  const gh = fakeGitHub();
  await sync(root, gh);
  fs.rmSync(path.join(root, 'docs/product/stories/retarget/batch.md'));
  const r = await sync(root, gh);
  assert.equal(r.closed, 1);
  assert.equal(gh.issues.find(i => /rfr-process:story-retarget-batch/.test(i.body)).state, 'closed');
});

test('project-process#AC-11: a short rate limit is waited out and retried', async () => {
  const root = project();
  const waits = [];
  const gh = fakeGitHub({ limit: n => (n === 1 ? { status: 429, retryAfter: 2 } : null) });
  const r = await sync(root, gh, { sleep: async ms => { waits.push(ms); } });
  assert.equal(r.created, 3);
  assert.equal(r.stopped, false);
  assert.deepEqual(waits, [2000]);
});

test('project-process#AC-11: a long rate limit stops the run, and the next run resumes without duplicates', async () => {
  const root = project();
  let limited = true;
  const gh = fakeGitHub({ limit: n => (limited && n > 2 ? { status: 403, retryAfter: 600 } : null) });
  const first = await sync(root, gh);
  assert.equal(first.stopped, true);
  assert.equal(first.created, 2);
  limited = false;
  const second = await sync(root, gh);
  assert.equal(second.stopped, false);
  assert.equal(second.created, 1);
  assert.equal(gh.issues.length, 3);
  assert.equal(new Set(gh.issues.map(i => i.title)).size, 3);
});

test('project-process#AC-11: a run writes at most maxWrites times, and the next run continues', async () => {
  const root = project();
  const gh = fakeGitHub();
  const first = await sync(root, gh, { maxWrites: 2 });
  assert.equal(first.created, 2);
  assert.equal(first.stopped, true);
  const second = await sync(root, gh, { maxWrites: 2 });
  assert.equal(second.created, 1);
  assert.equal(gh.issues.length, 3);
});
