#!/usr/bin/env node
// Approvals job (docs/specs/project-process.md, "Approval records"). Front matter and hooks cannot
// prove who approved a change, so this job reads GitHub:
//   - team mode, on pull_request and pull_request_review events: each gated stage whose files the
//     pull request changes needs an approving review, on the current head, from one of that
//     stage's approvers (a login, or a member of a listed team). A reviewer's latest review counts.
//   - solo mode, on push to the default branch: the pull request that produced the commit must
//     have been merged by an approver of every gated stage it touched. A failure, or a direct push
//     to a gated folder, opens an issue labelled `process-approval`.
// Each stage has a gate type (process.yml gates:, or the working mode's defaults; process plan 23b):
//   - approve: the rules above.
//   - agent: an independent reviewer's recorded review on the head commit, a pull request comment
//     with <!-- rfr-agent-review head=<sha> --> (review-pr posts it), instead of the approver.
//   - notify: no approver; after the merge, one decision-queue issue (label needs-lead) tells the
//     person what merged, with "keep it" as the default, so an objection is an ordinary amendment.
// Other combinations pass without calling the API. Without docs/product/process.yml nothing runs.
// Environment: GITHUB_EVENT_NAME, GITHUB_REPOSITORY, GITHUB_TOKEN, GITHUB_API_URL (optional);
// PR_NUMBER, BASE_SHA, HEAD_SHA for pull request events; GITHUB_SHA for pushes.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { approversFor, gatedStages, gateOf, hasId, isTeam, login, readConfig, readWorkMode, stageOf } from '../lib/process.mjs';
import { effectiveDate, formatBody, LABEL as QUEUE_LABEL } from '../../plugins/core/scripts/decisions.mjs';

export const AGENT_REVIEW = /<!-- rfr-agent-review head=([0-9a-f]{7,40}) -->/;

function git(root, args) {
  const r = spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: root, encoding: 'utf8' });
  return { status: r.status, out: r.stdout ?? '' };
}

// Gated stages touched between two commits. A docs/specs file counts only if it is a process
// artifact (has an id) on either side.
export function changedStages(root, from, to, config, files = null) {
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
    files?.push(file);
  }
  return gatedStages(config).filter(s => stages.has(s));
}

// A server error (HTTP 500 to 504) is retried twice after a short wait (AC-48).
function client({ fetch, api, token, sleep }) {
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' };
  return async (method, p, body) => {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(`${api}${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const data = await response.json().catch(() => null);
      if (response.status >= 500 && response.status <= 504 && attempt < 2) { await sleep(2000 * (attempt + 1)); continue; }
      return { status: response.status, ok: response.ok, data };
    }
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

// Whether the pull request has an independent review recorded on this head commit (agent gates).
export async function hasAgentReview({ call, repo, pr, head }) {
  const comments = await paged(call, `/repos/${repo}/issues/${pr}/comments`);
  return comments.some(c => {
    const m = AGENT_REVIEW.exec(c.body ?? '');
    return m && head.startsWith(m[1]);
  });
}

// One decision-queue issue for the notify stages a merge changed (process plan 23b).
export async function notifyLead({ call, repo, sha, pr, stages, files, today = new Date() }) {
  await call('POST', `/repos/${repo}/labels`, { name: QUEUE_LABEL, color: 'D93F0B', description: 'A question for the project lead, with the default the agent proceeded on' });
  const list = files.length ? files.map(f => `\`${f}\``).join(', ') : stages.join(', ');
  const body = formatBody({
    question: `${pr ? `#${pr}` : sha.slice(0, 12)} merged changes to ${stages.join(', ')} without waiting for you (notify gate). Keep them?`,
    options: [{ label: 'A', text: 'Keep them as merged' }, { label: 'B', text: 'Object: say in a comment what should change, and an agent amends the artifacts' }],
    defaultLabel: 'A',
    effective: effectiveDate(2, today),
    context: `Changed: ${list}. Commit ${sha.slice(0, 12)}.`,
  });
  return call('POST', `/repos/${repo}/issues`, { title: `Decision needed: keep the ${stages.join(', ')} changes from ${pr ? `#${pr}` : sha.slice(0, 12)}?`, body, labels: [QUEUE_LABEL] });
}

// The pull request number in a merge or squash commit's subject, or null (AC-47).
export function subjectPull(subject) {
  const m = /^Merge pull request #(\d+)\b/.exec(subject) ?? /\(#(\d+)\)\s*$/.exec(subject);
  return m ? Number(m[1]) : null;
}

async function checkMerge({ call, repo, sha, required, subject = '' }) {
  const pulls = await call('GET', `/repos/${repo}/commits/${sha}/pulls`);
  if (!pulls.ok) throw new Error(`GET commits/${sha}/pulls: HTTP ${pulls.status}`);
  let pr = (pulls.data ?? []).find(p => p.merged_at && (!p.merge_commit_sha || p.merge_commit_sha === sha)) ?? null;
  // GitHub's commit-to-pull-request index can stay empty for a merge (seen during an outage). Take
  // the number from the commit subject, and accept it only if GitHub says that pull request was
  // merged as this very commit, so a direct push with a borrowed subject still fails.
  const number = pr ? null : subjectPull(subject);
  if (number) {
    const found = await call('GET', `/repos/${repo}/pulls/${number}`);
    if (found.ok && found.data?.merged_at && found.data.merge_commit_sha === sha) pr = found.data;
  }
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

export async function runApprovals({ root = '.', env = process.env, fetch = globalThis.fetch, log = console.log, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  const result = { ok: true, problems: [], notes: [] };
  const loaded = readConfig(root);
  if (!loaded) { result.notes.push('no docs/product/process.yml; nothing to check'); return result; }
  if (loaded.errors.length) { result.ok = false; result.problems.push(...loaded.errors); return result; }
  const config = loaded.config;
  const event = env.GITHUB_EVENT_NAME;
  const isPr = event === 'pull_request' || event === 'pull_request_review' || event === 'pull_request_target';
  const call = client({ fetch, api: env.GITHUB_API_URL || 'https://api.github.com', token: env.GITHUB_TOKEN, sleep });
  const repo = env.GITHUB_REPOSITORY;
  const required = stages => stages.map(stage => ({ stage, approvers: approversFor(stage, config) }));
  const workMode = readWorkMode(root);
  const byGate = (stages, type) => stages.filter(stage => gateOf(stage, config, workMode) === type);

  if (config.mode === 'team' && isPr) {
    const stages = changedStages(root, env.BASE_SHA, env.HEAD_SHA, config);
    if (!stages.length) { result.notes.push('no gated stage changed'); return result; }
    result.problems.push(...await checkReviews({ call, repo, pr: env.PR_NUMBER, head: env.HEAD_SHA, required: required(byGate(stages, 'approve')) }));
    const agent = byGate(stages, 'agent');
    if (agent.length && !(await hasAgentReview({ call, repo, pr: env.PR_NUMBER, head: env.HEAD_SHA }))) {
      result.problems.push(`${agent.join(', ')}: needs an independent review recorded on ${env.HEAD_SHA.slice(0, 12)} (run /rfr-core:review-pr, which records it)`);
    }
    if (byGate(stages, 'notify').length) result.notes.push(`${byGate(stages, 'notify').join(', ')}: notify gate; the lead is told after the merge`);
  } else if (event === 'push') {
    const sha = env.GITHUB_SHA;
    const parent = git(root, ['rev-parse', `${sha}^1`]);
    if (parent.status !== 0) { result.notes.push('no parent commit; nothing to compare'); return result; }
    const files = [];
    const stages = changedStages(root, parent.out.trim(), sha, config, files);
    if (!stages.length) { result.notes.push('no gated stage changed'); return result; }
    const subject = git(root, ['log', '-1', '--format=%s', sha]).out.trim();
    const approve = byGate(stages, 'approve');
    const agent = byGate(stages, 'agent');
    const notify = byGate(stages, 'notify');
    let pr = null;
    if (config.mode === 'solo' && (approve.length || agent.length)) {
      const merge = await checkMerge({ call, repo, sha, required: required(approve), subject });
      pr = merge.pr;
      const problems = [...merge.problems];
      if (!merge.pr && !approve.length) problems.push(`${sha.slice(0, 12)} changed ${agent.join(', ')} without a pull request; an agent-gated change needs one, with a recorded review`);
      if (merge.pr && agent.length) {
        const detail = await call('GET', `/repos/${repo}/pulls/${merge.pr}`);
        const head = detail.data?.head?.sha ?? '';
        if (!head || !(await hasAgentReview({ call, repo, pr: merge.pr, head }))) problems.push(`${agent.join(', ')}: #${merge.pr} merged with no independent review recorded on its head commit`);
      }
      result.problems.push(...problems);
      if (problems.length) await openIssue({ call, repo, sha, ...merge, problems, runUrl: env.RUN_URL });
    }
    if (notify.length) {
      if (pr === null) pr = (await call('GET', `/repos/${repo}/commits/${sha}/pulls`)).data?.find?.(p => p.merged_at)?.number ?? subjectPull(subject);
      const notifyFiles = files.filter(file => notify.includes(stageOf(file)));
      await notifyLead({ call, repo, sha, pr, stages: notify, files: notifyFiles });
      result.notes.push(`${notify.join(', ')}: notify gate; the lead was told in the decision queue`);
    }
    if (config.mode === 'team' && !notify.length) result.notes.push('team mode: approvals were checked on the pull request');
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
