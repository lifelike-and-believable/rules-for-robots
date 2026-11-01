// Tests for the Project board in the issue sync (docs/specs/project-process.md, amendment AC-22):
// with `project` in process.yml and an RFR_PROJECT_TOKEN, persona, epic, and story issues are added
// to the GitHub Project and their Stage field is set from the files. REST and GraphQL are fakes.
// Each test title cites the criterion it covers (project-process#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';
import { parseProcessConfig } from '../checks/lib/process.mjs';
import { syncIssues } from '../checks/ci/process-sync.mjs';

function write(root, file, text) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}
const art = (id, status, title, links = []) =>
  `---\nid: ${id}\nstatus: ${status}\n${links.length ? `derived-from:\n${links.map(l => `  - ${l}:\n`).join('')}` : ''}---\n\n# ${title}\n\nBody.\n`;

function project(config = 'default: [lead]\nproject: https://github.com/orgs/acme/projects/7\n') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-sync-project-'));
  write(root, 'docs/product/process.yml', config);
  write(root, 'docs/product/concept.md', art('concept', 'approved', 'Concept'));
  write(root, 'docs/product/personas/animator.md', art('persona-animator', 'approved', 'Animator', ['concept']));
  write(root, 'docs/product/epics/retarget.md', art('epic-retarget', 'approved', 'Retargeting', ['persona-animator']));
  write(root, 'docs/product/stories/retarget/batch.md', art('story-retarget-batch', 'draft', 'Batch retarget', ['epic-retarget', 'persona-animator']));
  write(root, 'docs/design/retarget.md', art('design-retarget', 'draft', 'Retarget dialog', ['story-retarget-batch']));
  return root;
}

const STAGE_OPTIONS = ['Personas', 'Epics', 'Stories', 'Design', 'User docs', 'Specs', 'Tutorials'];

// Fake REST issues API plus a fake Projects v2 GraphQL API.
function fakeGitHub({ owner = 'organization', options = STAGE_OPTIONS } = {}) {
  const issues = [];
  const items = []; // { id, contentId, optionId }
  const graphql = [];
  const res = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) });
  const view = i => ({ ...i, labels: i.labels.map(name => ({ name })) });
  const optionList = options.map((name, n) => ({ id: `opt-${n}`, name }));
  const fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    if (u.pathname === '/graphql') {
      graphql.push({ query: body.query, variables: body.variables, auth: init.headers?.authorization });
      const q = body.query;
      if (/projectV2\(number/.test(q)) {
        const node = { id: 'PVT_1', fields: { nodes: [{ id: 'F_title', name: 'Title' }, { id: 'F_stage', name: 'Stage', options: optionList }] } };
        const data = owner === 'organization' ? { organization: { projectV2: node }, user: null } : { user: { projectV2: node }, organization: null };
        return res(200, { data });
      }
      if (/items\(first/.test(q)) {
        return res(200, { data: { node: { items: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: items.map(i => ({ id: i.id, content: { id: i.contentId }, fieldValueByName: i.optionId ? { optionId: i.optionId } : null })) } } } });
      }
      if (/addProjectV2ItemById/.test(q)) {
        let item = items.find(i => i.contentId === body.variables.contentId);
        if (!item) { item = { id: `PVTI_${items.length + 1}`, contentId: body.variables.contentId, optionId: null }; items.push(item); }
        return res(200, { data: { addProjectV2ItemById: { item: { id: item.id } } } });
      }
      if (/updateProjectV2ItemFieldValue/.test(q)) {
        const item = items.find(i => i.id === body.variables.itemId);
        item.optionId = body.variables.optionId;
        return res(200, { data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: item.id } } } });
      }
      return res(200, { errors: [{ message: 'unexpected query' }] });
    }
    if (method === 'GET' && u.pathname === '/repos/acme/app/issues') {
      const page = Number(u.searchParams.get('page') ?? 1);
      return res(200, page === 1 ? issues.map(view) : []);
    }
    if (method === 'POST' && u.pathname === '/repos/acme/app/labels') return res(201, {});
    if (method === 'POST' && u.pathname === '/repos/acme/app/issues') {
      const issue = { number: issues.length + 1, id: 9000 + issues.length + 1, node_id: `I_${issues.length + 1}`, title: body.title, body: body.body, state: 'open', labels: [...body.labels] };
      issues.push(issue);
      return res(201, view(issue));
    }
    if (method === 'PATCH') {
      const issue = issues.find(i => i.number === Number(u.pathname.split('/').pop()));
      Object.assign(issue, body.labels ? { ...body, labels: [...body.labels] } : body);
      return res(200, view(issue));
    }
    if (method === 'POST' && /sub_issues$/.test(u.pathname)) return res(201, {});
    return res(404, { message: `unexpected ${method} ${u.pathname}` });
  };
  const optionName = id => optionList.find(o => o.id === id)?.name ?? null;
  const stageOf = title => {
    const issue = issues.find(i => i.title === title);
    return optionName(items.find(i => i.contentId === issue?.node_id)?.optionId);
  };
  return { fetch, issues, items, graphql, stageOf };
}

const sync = (root, gh, extra = {}) => {
  const logs = [];
  return syncIssues({ root, fetch: gh.fetch, api: 'https://api.github.test', token: 't', projectToken: 'pat', repo: 'acme/app', sleep: async () => {}, log: m => logs.push(m), ...extra })
    .then(r => ({ ...r, logs }));
};
const mutations = gh => gh.graphql.filter(g => /mutation/.test(g.query));

test('project-process#AC-22: process.yml accepts a project URL for an organization or a user, and rejects anything else', () => {
  assert.deepEqual(parseProcessConfig('default: [lead]\nproject: https://github.com/orgs/acme/projects/7\n').config.project, { owner: 'acme', kind: 'organization', number: 7 });
  assert.deepEqual(parseProcessConfig('default: [lead]\nproject: https://github.com/users/lead/projects/2\n').config.project, { owner: 'lead', kind: 'user', number: 2 });
  assert.match(parseProcessConfig('default: [lead]\nproject: acme board\n').errors.join('\n'), /project/);
  assert.equal(parseProcessConfig('default: [lead]\n').config.project, null);
});

test('project-process#AC-22: each persona, epic, and story issue is added to the board with its Stage set', async () => {
  const root = project();
  const gh = fakeGitHub();
  const r = await sync(root, gh);
  assert.equal(r.created, 3);
  assert.equal(gh.items.length, 3);
  assert.equal(gh.stageOf('Persona: Animator'), 'Personas');
  assert.equal(gh.stageOf('Epic: Retargeting'), 'Epics');
  assert.equal(gh.stageOf('Story: Batch retarget'), 'Stories');
  assert.ok(gh.graphql.every(g => g.auth === 'Bearer pat'), 'GraphQL calls use the project token');
});

test('project-process#AC-22: an epic or story moves to the furthest stage its approved work has reached', async () => {
  const root = project();
  const gh = fakeGitHub();
  await sync(root, gh);
  write(root, 'docs/product/stories/retarget/batch.md', art('story-retarget-batch', 'approved', 'Batch retarget', ['epic-retarget', 'persona-animator']));
  write(root, 'docs/design/retarget.md', art('design-retarget', 'approved', 'Retarget dialog', ['story-retarget-batch']));
  await sync(root, gh);
  assert.equal(gh.stageOf('Story: Batch retarget'), 'Design');
  assert.equal(gh.stageOf('Epic: Retargeting'), 'Design');
  assert.equal(gh.stageOf('Persona: Animator'), 'Personas', 'personas stay in their own column');
});

test('project-process#AC-22: a second run with nothing changed makes no board changes', async () => {
  const root = project();
  const gh = fakeGitHub();
  await sync(root, gh);
  const before = mutations(gh).length;
  await sync(root, gh);
  assert.equal(mutations(gh).length, before);
});

test('project-process#AC-22: a user-owned project works the same way', async () => {
  const root = project('default: [lead]\nproject: https://github.com/users/lead/projects/2\n');
  const gh = fakeGitHub({ owner: 'user' });
  await sync(root, gh);
  assert.equal(gh.stageOf('Epic: Retargeting'), 'Epics');
  assert.ok(gh.graphql.some(g => /user\(login/.test(g.query)));
});

test('project-process#AC-22: a Stage option missing from the board is reported and that item is left alone', async () => {
  const root = project();
  const gh = fakeGitHub({ options: ['Personas', 'Stories'] });
  const r = await sync(root, gh);
  assert.equal(gh.stageOf('Epic: Retargeting'), null);
  assert.equal(gh.stageOf('Persona: Animator'), 'Personas');
  assert.match(r.logs.join('\n'), /Epics/);
  assert.equal(r.stopped, false);
});

test('project-process#AC-22: without a project token or a configured project, the board is skipped with a notice', async () => {
  const noToken = await sync(project(), fakeGitHub(), { projectToken: '' });
  assert.match(noToken.logs.join('\n'), /RFR_PROJECT_TOKEN/);
  const gh = fakeGitHub();
  const noProject = await sync(project('default: [lead]\n'), gh);
  assert.equal(gh.graphql.length, 0);
  assert.equal(noProject.created, 3);
});

test('project-process#AC-22: the reusable workflow passes RFR_PROJECT_TOKEN to the sync, and the caller inherits secrets', () => {
  const reusable = parse(fs.readFileSync('.github/workflows/rfr-process.yml', 'utf8'));
  assert.ok(reusable.on.workflow_call.secrets?.RFR_PROJECT_TOKEN, 'declared as an optional secret');
  const env = Object.values(reusable.jobs.sync.steps).map(s => s.env ?? {}).find(e => 'RFR_PROJECT_TOKEN' in e);
  assert.match(String(env?.RFR_PROJECT_TOKEN), /secrets\.RFR_PROJECT_TOKEN/);
  const caller = parse(fs.readFileSync('plugins/process/templates/workflows/rfr-process.yml', 'utf8'));
  assert.equal(Object.values(caller.jobs)[0].secrets, 'inherit');
});
