#!/usr/bin/env node
// Issue sync (docs/specs/project-process.md, "Issue sync"). After each push to the default branch,
// mirrors personas, epics, and stories to GitHub issues: one issue each, labelled `rfr-process` and
// `stage:<stage>`, with stories attached as sub-issues of their epic when created. The file always
// wins: title, body, stage label, and open state are rewritten from it, other labels are kept, and
// the issue of a deleted artifact is closed. Issues are matched by a marker comment in the body.
// With `project` in process.yml and an RFR_PROJECT_TOKEN (a token that can write to Projects; the
// workflow token cannot), each issue is also added to that GitHub Project and its Stage field set:
// personas to Personas, epics and stories to the furthest stage approved work below them has
// reached (or their own stage). Missing Stage options are reported and those items left alone.
// Writes are capped per run, short rate limits are waited out, and a long one stops the run; the
// next run picks up where this one stopped, because it only writes what still differs.
// Environment: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_API_URL (optional), SYNC_MAX_WRITES (optional),
// RFR_PROJECT_TOKEN (optional).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGE_ORDER, loadArtifacts, readConfig, workingTree } from '../lib/process.mjs';
import { processStatus } from '../process-trace.mjs';

const SYNCED = { personas: 'Persona', epics: 'Epic', stories: 'Story' };
const MARKER = /<!-- rfr-process:([^\s>]+) -->/;

function title(a) {
  const h1 = /^#\s+(.+?)\s*#*\s*$/m.exec(a.body)?.[1];
  return `${SYNCED[a.stage]}: ${h1 ?? a.id}`;
}

function body(a) {
  return [
    `<!-- rfr-process:${a.id} -->`,
    `**${SYNCED[a.stage]}** \`${a.id}\`, status: ${a.status ?? 'none'}`,
    '',
    `Source: \`${a.file}\``,
    '',
    'This issue mirrors the file and is rewritten after each merge to the default branch. Change the file, not this issue; discussion here is kept.',
  ].join('\n');
}

class RateLimited extends Error {}

const STAGE_TITLES = {
  concept: 'Concept', requirements: 'Requirements', personas: 'Personas', epics: 'Epics', stories: 'Stories',
  design: 'Design', 'user-docs': 'User docs', specs: 'Specs', tutorials: 'Tutorials',
};

const Q_PROJECT = kind => `query($login: String!, $number: Int!) {
  ${kind}(login: $login) {
    projectV2(number: $number) {
      id
      fields(first: 50) { nodes {
        ... on ProjectV2FieldCommon { id name }
        ... on ProjectV2SingleSelectField { id name options { id name } }
      } }
    }
  }
}`;
const Q_ITEMS = `query($id: ID!, $after: String) {
  node(id: $id) { ... on ProjectV2 {
    items(first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { id content { ... on Issue { id } } fieldValueByName(name: "Stage") { ... on ProjectV2ItemFieldSingleSelectValue { optionId } } }
    }
  } }
}`;
const M_ADD = `mutation($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } }
}`;
const M_SET = `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { singleSelectOptionId: $optionId } }) { projectV2Item { id } }
}`;

// The board column for each synced artifact: personas stay in Personas; epics and stories go to the
// furthest stage that approved work at or below them has reached.
function boardStages(root) {
  const out = new Map();
  for (const row of processStatus(root)) {
    if (row.stage === 'personas') { out.set(row.id, 'personas'); continue; }
    const own = STAGE_ORDER.indexOf(row.stage);
    const reached = row.reached ? STAGE_ORDER.indexOf(row.reached) : -1;
    out.set(row.id, STAGE_ORDER[Math.max(own, reached)]);
  }
  return out;
}

async function syncBoard({ root, fetch, api, projectToken, project, issues, log }) {
  const graphql = async (query, variables) => {
    const response = await fetch(`${api}/graphql`, {
      method: 'POST',
      headers: { authorization: `Bearer ${projectToken}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || json?.errors?.length) throw new Error(`GraphQL: ${json?.errors?.map(e => e.message).join('; ') ?? `HTTP ${response.status}`}`);
    return json.data;
  };
  const result = { added: 0, moved: 0 };
  const found = await graphql(Q_PROJECT(project.kind), { login: project.owner, number: project.number });
  const board = found?.[project.kind]?.projectV2;
  if (!board) { log(`project board skipped: ${project.kind} ${project.owner} has no project ${project.number} this token can see`); return result; }
  const field = board.fields.nodes.find(f => f?.name?.toLowerCase() === 'stage' && Array.isArray(f.options));
  if (!field) { log('project board skipped: the project has no single-select field named Stage'); return result; }

  const items = new Map(); // content node id -> { id, optionId }
  for (let after = null, more = true; more;) {
    const page = (await graphql(Q_ITEMS, { id: board.id, after })).node.items;
    for (const n of page.nodes) if (n.content?.id) items.set(n.content.id, { id: n.id, optionId: n.fieldValueByName?.optionId ?? null });
    more = page.pageInfo.hasNextPage;
    after = page.pageInfo.endCursor;
  }

  const columns = boardStages(root);
  for (const [id, issue] of issues) {
    const stage = columns.get(id);
    if (!stage || !issue.node_id) continue;
    const option = field.options.find(o => [STAGE_TITLES[stage], stage].some(n => n.toLowerCase() === o.name.toLowerCase()));
    let item = items.get(issue.node_id);
    if (!item) {
      const added = await graphql(M_ADD, { projectId: board.id, contentId: issue.node_id });
      item = { id: added.addProjectV2ItemById.item.id, optionId: null };
      items.set(issue.node_id, item);
      result.added++;
    }
    if (!option) { log(`project board: no Stage option "${STAGE_TITLES[stage]}" for ${id}; add it to the board's Stage field`); continue; }
    if (item.optionId === option.id) continue;
    await graphql(M_SET, { projectId: board.id, itemId: item.id, fieldId: field.id, optionId: option.id });
    item.optionId = option.id;
    result.moved++;
  }
  return result;
}

export async function syncIssues({
  root = '.', fetch = globalThis.fetch, api = 'https://api.github.com', token, repo, projectToken = '',
  maxWrites = 100, maxWaitSeconds = 60, sleep = ms => new Promise(r => setTimeout(r, ms)), log = console.log,
} = {}) {
  const result = { created: 0, updated: 0, closed: 0, stopped: false };
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' };
  const request = async (method, p, data) => {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(`${api}${p}`, { method, headers, body: data ? JSON.stringify(data) : undefined });
      const json = await response.json().catch(() => null);
      const limited = response.status === 429 || (response.status === 403 && /rate limit/i.test(json?.message ?? ''));
      // A server error is retried twice after a short wait (AC-48).
      if (response.status >= 500 && response.status <= 504 && attempt < 2) {
        log(`${method} ${p}: HTTP ${response.status}; retrying`);
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!limited) return { ok: response.ok, status: response.status, data: json };
      const wait = Number(response.headers.get('retry-after') ?? 60);
      if (attempt >= 2 || wait > maxWaitSeconds) throw new RateLimited(`${method} ${p}: rate limited (retry after ${wait}s)`);
      log(`rate limited; waiting ${wait}s`);
      await sleep(wait * 1000);
    }
  };
  let writes = 0;
  const write = async (method, p, data) => {
    if (writes >= maxWrites) throw new RateLimited(`reached ${maxWrites} writes for this run`);
    writes++;
    const r = await request(method, p, data);
    if (!r.ok) throw new Error(`${method} ${p}: HTTP ${r.status}`);
    return r.data;
  };

  const { artifacts } = loadArtifacts(workingTree(root));
  const synced = artifacts
    .filter(a => a.id && SYNCED[a.stage])
    .sort((x, y) => Object.keys(SYNCED).indexOf(x.stage) - Object.keys(SYNCED).indexOf(y.stage) || x.id.localeCompare(y.id));
  const ids = new Set(synced.map(a => a.id));

  const existingById = new Map();
  try {
    for (const name of ['rfr-process', ...Object.keys(SYNCED).map(s => `stage:${s}`)]) {
      await request('POST', `/repos/${repo}/labels`, { name, color: name === 'rfr-process' ? '5319E7' : 'C5DEF5' });
    }
    const existing = existingById;
    for (let page = 1; page < 100; page++) {
      const r = await request('GET', `/repos/${repo}/issues?labels=rfr-process&state=all&per_page=100&page=${page}`);
      if (!r.ok) throw new Error(`listing issues: HTTP ${r.status}`);
      for (const issue of r.data) {
        const id = MARKER.exec(issue.body ?? '')?.[1];
        if (id && !issue.pull_request && !existing.has(id)) existing.set(id, issue);
      }
      if (r.data.length < 100) break;
    }

    for (const a of synced) {
      const want = { title: title(a), body: body(a), state: 'open' };
      const issue = existing.get(a.id);
      if (!issue) {
        const created = await write('POST', `/repos/${repo}/issues`, { ...want, labels: ['rfr-process', `stage:${a.stage}`] });
        existing.set(a.id, created);
        result.created++;
        const epicId = a.stage === 'stories' ? a.links.map(l => l.target).find(t => synced.find(x => x.id === t)?.stage === 'epics') : null;
        const epicLink = epicId ? existing.get(epicId) : null;
        if (epicLink) {
          const r = await request('POST', `/repos/${repo}/issues/${epicLink.number}/sub_issues`, { sub_issue_id: created.id });
          if (!r.ok) log(`could not attach #${created.number} to epic #${epicLink.number}: HTTP ${r.status}`);
        }
        continue;
      }
      const names = (issue.labels ?? []).map(l => (typeof l === 'string' ? l : l.name));
      const labels = [...new Set([...names.filter(n => !/^stage:/.test(n)), 'rfr-process', `stage:${a.stage}`])];
      const same = issue.title === want.title && issue.body === want.body && issue.state === 'open'
        && [...labels].sort().join() === [...names].sort().join();
      if (same) continue;
      await write('PATCH', `/repos/${repo}/issues/${issue.number}`, { ...want, labels });
      result.updated++;
    }

    for (const [id, issue] of existing) {
      if (ids.has(id) || issue.state === 'closed') continue;
      await write('PATCH', `/repos/${repo}/issues/${issue.number}`, { state: 'closed', state_reason: 'not_planned' });
      result.closed++;
    }
  } catch (e) {
    if (!(e instanceof RateLimited)) throw e;
    result.stopped = true;
    log(`${e.message}; stopping. The next run resumes from here.`);
  }

  const project = readConfig(root)?.config?.project;
  if (project && !result.stopped) {
    if (!projectToken) log('project board skipped: no RFR_PROJECT_TOKEN (the workflow token cannot write to Projects)');
    else {
      try {
        result.board = await syncBoard({ root, fetch, api, projectToken, project, issues: existingById, log });
      } catch (e) {
        log(`project board not updated: ${e.message}`);
      }
    }
  }
  return result;
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  if (!readConfig(root)) { console.log('No docs/product/process.yml; issue sync skipped.'); return; }
  const r = await syncIssues({
    root, token: process.env.GITHUB_TOKEN, repo: process.env.GITHUB_REPOSITORY,
    api: process.env.GITHUB_API_URL || 'https://api.github.com',
    maxWrites: Number(process.env.SYNC_MAX_WRITES || 100),
    projectToken: process.env.RFR_PROJECT_TOKEN || '',
  });
  console.log(`Issue sync: ${r.created} created, ${r.updated} updated, ${r.closed} closed${r.stopped ? '; stopped early, the next run continues' : ''}.`);
  if (r.board) console.log(`Project board: ${r.board.added} added, ${r.board.moved} moved.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch(e => { console.error(e.message); process.exit(1); });
