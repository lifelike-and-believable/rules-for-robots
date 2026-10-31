#!/usr/bin/env node
// Issue sync (docs/specs/project-process.md, "Issue sync"). After each push to the default branch,
// mirrors personas, epics, and stories to GitHub issues: one issue each, labelled `rfr-process` and
// `stage:<stage>`, with stories attached as sub-issues of their epic when created. The file always
// wins: title, body, stage label, and open state are rewritten from it, other labels are kept, and
// the issue of a deleted artifact is closed. Issues are matched by a marker comment in the body.
// Writes are capped per run, short rate limits are waited out, and a long one stops the run; the
// next run picks up where this one stopped, because it only writes what still differs.
// Environment: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_API_URL (optional), SYNC_MAX_WRITES (optional).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArtifacts, readConfig, workingTree } from '../lib/process.mjs';

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

export async function syncIssues({
  root = '.', fetch = globalThis.fetch, api = 'https://api.github.com', token, repo,
  maxWrites = 100, maxWaitSeconds = 60, sleep = ms => new Promise(r => setTimeout(r, ms)), log = console.log,
} = {}) {
  const result = { created: 0, updated: 0, closed: 0, stopped: false };
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' };
  const request = async (method, p, data) => {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(`${api}${p}`, { method, headers, body: data ? JSON.stringify(data) : undefined });
      const json = await response.json().catch(() => null);
      const limited = response.status === 429 || (response.status === 403 && /rate limit/i.test(json?.message ?? ''));
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

  try {
    for (const name of ['rfr-process', ...Object.keys(SYNCED).map(s => `stage:${s}`)]) {
      await request('POST', `/repos/${repo}/labels`, { name, color: name === 'rfr-process' ? '5319E7' : 'C5DEF5' });
    }
    const existing = new Map();
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
  return result;
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  if (!readConfig(root)) { console.log('No docs/product/process.yml; issue sync skipped.'); return; }
  const r = await syncIssues({
    root, token: process.env.GITHUB_TOKEN, repo: process.env.GITHUB_REPOSITORY,
    api: process.env.GITHUB_API_URL || 'https://api.github.com',
    maxWrites: Number(process.env.SYNC_MAX_WRITES || 100),
  });
  console.log(`Issue sync: ${r.created} created, ${r.updated} updated, ${r.closed} closed${r.stopped ? '; stopped early, the next run continues' : ''}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch(e => { console.error(e.message); process.exit(1); });
