#!/usr/bin/env node
// Approvals job (docs/specs/project-process.md, "Approval records"). Front matter and hooks cannot
// prove who approved a change, so this job reads GitHub:
//   - team mode, on pull_request and pull_request_review events: each gated stage whose files the
//     pull request changes needs an approving review, on the current head, from one of that
//     stage's approvers (a login, or a member of a listed team). A reviewer's latest review counts.
//   - solo mode, on push to the default branch: the pull request that produced the commit must
//     have been merged by an approver of every gated stage it touched. A failure, or a direct push
//     to a gated folder, opens an issue labelled `process-approval`.
// Other combinations pass without calling the API. Without docs/product/process.yml nothing runs.
// Environment: GITHUB_EVENT_NAME, GITHUB_REPOSITORY, GITHUB_TOKEN, GITHUB_API_URL (optional);
// PR_NUMBER, BASE_SHA, HEAD_SHA for pull request events; GITHUB_SHA for pushes.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { approversFor, gatedStages, hasId, isTeam, login, readConfig, stageOf } from '../lib/process.mjs';

function git(root, args) {
  const r = spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: root, encoding: 'utf8' });
  return { status: r.status, out: r.stdout ?? '' };
}

// Gated stages touched between two commits. A docs/specs file counts only if it is a process
// artifact (has an id) on either side.
export function changedStages(root, from, to, config) {
  const gated = new Set(gatedStages(config));
  const diff = git(root, ['diff', '--name-only', '--no-renames', from, to]);
  if (diff.status !== 0) throw new Error(`git diff ${from} ${to} failed (is the full history fetched?)`);
  const stages = new Set();
  for (const file of diff.out.split('\n').filter(Boolean)) {
    const stage = stageOf(file);
    if (!stage || !gated.has(stage)) continue;
    if (stage === 'specs') {
      const at = ref => { const r = git(root, ['show', `${ref}:${file}`]); return r.status === 0 ? r.out : ''; };
      if (!hasId(at(from)) && !hasId(at(to))) continue;
    }
    stages.add(stage);
  }
  return gatedStages(config).filter(s => stages.has(s));
}

function client({ fetch, api, token }) {
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' };
  return async (method, p, body) => {
    const response = await fetch(`${api}${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => null);
    return { status: response.status, ok: response.ok, data };
  };
}

async function paged(call, p) {
  const out = [];
  for (let page = 1; page < 50; page++) {
    const sep = p.includes('?') ? '&' : '?';
    const r = await call('GET', `${p}${sep}per_page=100&page=${page}`);
    if (!r.ok) throw new Error(`GET ${p}: HTTP ${r.status}`);
    out.push(...r.data);
    if (r.data.length < 100) break;
  }
  return out;
}

// Whether `user` is one of `approvers`: a login match, or active membership of a listed team.
async function isApprover(call, user, approvers, cache) {
  const name = user.toLowerCase();
  if (approvers.some(a => !isTeam(a) && login(a).toLowerCase() === name)) return true;
  for (const team of approvers.filter(isTeam)) {
    const [org, slug] = login(team).split('/');
    const key = `${org}/${slug}/${name}`;
    if (!cache.has(key)) {
      const r = await call('GET', `/orgs/${org}/teams/${slug}/memberships/${encodeURIComponent(user)}`);
      cache.set(key, r.ok && r.data?.state === 'active');
    }
    if (cache.get(key)) return true;
  }
  return false;
}

async function checkReviews({ call, repo, pr, head, required }) {
  const reviews = await paged(call, `/repos/${repo}/pulls/${pr}/reviews`);
  const latest = new Map();
  for (const r of reviews) {
    const user = r.user?.login;
    if (!user || r.state === 'COMMENTED' || r.state === 'PENDING') continue;
    const prev = latest.get(user.toLowerCase());
    if (!prev || (r.submitted_at ?? '') >= (prev.submitted_at ?? '')) latest.set(user.toLowerCase(), r);
  }
  const approvedOnHead = [...latest.values()].filter(r => r.state === 'APPROVED' && r.commit_id === head).map(r => r.user.login);
  const cache = new Map();
  const problems = [];
  for (const { stage, approvers } of required) {
    let ok = false;
    for (const user of approvedOnHead) if (await isApprover(call, user, approvers, cache)) { ok = true; break; }
    if (!ok) problems.push(`${stage}: needs an approving review on ${head.slice(0, 12)} from ${approvers.join(', ')}`);
  }
  return problems;
}

async function checkMerge({ call, repo, sha, required }) {
  const pulls = await call('GET', `/repos/${repo}/commits/${sha}/pulls`);
  if (!pulls.ok) throw new Error(`GET commits/${sha}/pulls: HTTP ${pulls.status}`);
  const pr = (pulls.data ?? []).find(p => p.merged_at && (!p.merge_commit_sha || p.merge_commit_sha === sha)) ?? null;
  if (!pr) return { pr: null, mergedBy: null, problems: [`${sha.slice(0, 12)} changed ${required.map(r => r.stage).join(', ')} without a pull request; a gated change needs one, merged by an approver`] };
  const detail = await call('GET', `/repos/${repo}/pulls/${pr.number}`);
  const mergedBy = detail.data?.merged_by?.login ?? null;
  const problems = [];
  const cache = new Map();
  for (const { stage, approvers } of required) {
    if (!mergedBy || !(await isApprover(call, mergedBy, approvers, cache))) {
      problems.push(`${stage}: #${pr.number} was merged by ${mergedBy ?? 'an unknown user'}, who is not an approver (${approvers.join(', ')})`);
    }
  }
  return { pr: pr.number, mergedBy, problems };
}

async function openIssue({ call, repo, sha, pr, mergedBy, problems, runUrl }) {
  await call('POST', `/repos/${repo}/labels`, { name: 'process-approval', color: 'D93F0B', description: 'A gated process change merged without its approver' });
  const body = [
    `The change in ${sha}${pr ? ` (#${pr}, merged by ${mergedBy ?? 'unknown'})` : ''} touched gated process stages without an approver's merge:`,
    '',
    ...problems.map(p => `- ${p}`),
    '',
    'In solo mode the approval is the approver merging the pull request (docs/specs/project-process.md in rules-for-robots). Have an approver review the change, then close this issue, or revert it.',
    ...(runUrl ? ['', `[Run](${runUrl})`] : []),
  ].join('\n');
  return call('POST', `/repos/${repo}/issues`, { title: `Process change merged without approval: ${sha.slice(0, 12)}`, body, labels: ['process-approval'] });
}

export async function runApprovals({ root = '.', env = process.env, fetch = globalThis.fetch, log = console.log } = {}) {
  const result = { ok: true, problems: [], notes: [] };
  const loaded = readConfig(root);
  if (!loaded) { result.notes.push('no docs/product/process.yml; nothing to check'); return result; }
  if (loaded.errors.length) { result.ok = false; result.problems.push(...loaded.errors); return result; }
  const config = loaded.config;
  const event = env.GITHUB_EVENT_NAME;
  const isPr = event === 'pull_request' || event === 'pull_request_review' || event === 'pull_request_target';
  const call = client({ fetch, api: env.GITHUB_API_URL || 'https://api.github.com', token: env.GITHUB_TOKEN });
  const repo = env.GITHUB_REPOSITORY;
  const required = stages => stages.map(stage => ({ stage, approvers: approversFor(stage, config) }));

  if (config.mode === 'team' && isPr) {
    const stages = changedStages(root, env.BASE_SHA, env.HEAD_SHA, config);
    if (!stages.length) { result.notes.push('no gated stage changed'); return result; }
    result.problems.push(...await checkReviews({ call, repo, pr: env.PR_NUMBER, head: env.HEAD_SHA, required: required(stages) }));
  } else if (config.mode === 'solo' && event === 'push') {
    const sha = env.GITHUB_SHA;
    const parent = git(root, ['rev-parse', `${sha}^1`]);
    if (parent.status !== 0) { result.notes.push('no parent commit; nothing to compare'); return result; }
    const stages = changedStages(root, parent.out.trim(), sha, config);
    if (!stages.length) { result.notes.push('no gated stage changed'); return result; }
    const merge = await checkMerge({ call, repo, sha, required: required(stages) });
    result.problems.push(...merge.problems);
    if (merge.problems.length) await openIssue({ call, repo, sha, ...merge, problems: merge.problems, runUrl: env.RUN_URL });
  } else if (config.mode === 'solo') {
    result.notes.push('solo mode: approval is the approver merging the pull request; checked after the merge');
  } else {
    result.notes.push(`team mode: nothing to check on ${event ?? 'this event'}`);
  }
  result.ok = result.problems.length === 0;
  for (const n of result.notes) log(n);
  return result;
}

async function main() {
  const r = await runApprovals({ root: path.resolve(process.argv[2] ?? '.') });
  for (const p of r.problems) console.error(p);
  if (!r.ok) process.exit(1);
  console.log('Process approvals: ok.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch(e => { console.error(e.message); process.exit(1); });
