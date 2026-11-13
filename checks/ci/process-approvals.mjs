#!/usr/bin/env node
// Approvals job (docs/specs/project-process.md, "Approval records"; rewrite plan 25e). The approver's
// review of an `approve` stage is GitHub's: branch protection requires a code owner's review on the
// gated folders (docs/specs/github-gate.md), so this job no longer checks it. What it still does,
// for the other gate types (process.yml gates:, or the working mode's defaults; process plan 23b):
//   - agent, on pull_request and pull_request_review events: an independent reviewer's recorded
//     review on the head commit, a pull request comment with <!-- rfr-agent-review head=<sha> -->
//     (review-pr posts it), stands in for the approver.
//   - agent, on push to the default branch: the merged pull request must have that review on its
//     head; if not, an issue labelled process-approval is opened.
//   - notify, on push to the default branch: one decision-queue issue (label needs-lead) tells the
//     person what merged, with "keep it" as the default, so an objection is an ordinary amendment.
// Without docs/product/process.yml nothing runs.
// Environment: GITHUB_EVENT_NAME, GITHUB_REPOSITORY, GITHUB_TOKEN, GITHUB_API_URL (optional);
// PR_NUMBER, BASE_SHA, HEAD_SHA for pull request events; GITHUB_SHA for pushes.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gatedStages, gateOf, hasId, readConfig, readWorkMode, stageOf } from '../lib/process.mjs';
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

// An issue for an agent-gated change merged without its recorded review.
async function openIssue({ call, repo, sha, pr, problem, runUrl }) {
  await call('POST', `/repos/${repo}/labels`, { name: 'process-approval', color: 'D93F0B', description: 'An agent-gated process change merged without its recorded review' });
  const body = [
    `The change in ${sha}${pr ? ` (#${pr})` : ''} touched agent-gated process stages without the independent review that stands in for the approver:`,
    '',
    `- ${problem}`,
    '',
    'Run /rfr-core:review-pr on the change and record the review, then close this issue, or revert it (docs/specs/project-process.md in rules-for-robots, AC-56).',
    ...(runUrl ? ['', `[Run](${runUrl})`] : []),
  ].join('\n');
  return call('POST', `/repos/${repo}/issues`, { title: `Agent-gated change merged without a recorded review: ${sha.slice(0, 12)}`, body, labels: ['process-approval'] });
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
  const workMode = readWorkMode(root);
  const byGate = (stages, type) => stages.filter(stage => gateOf(stage, config, workMode) === type);

  if (isPr) {
    const stages = changedStages(root, env.BASE_SHA, env.HEAD_SHA, config);
    if (!stages.length) { result.notes.push('no gated stage changed'); return result; }
    const approve = byGate(stages, 'approve');
    if (approve.length) result.notes.push(`${approve.join(', ')}: the approver's review in GitHub is the approval (branch protection)`);
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
    const notify = byGate(stages, 'notify');
    const agent = byGate(stages, 'agent');
    if (!notify.length && !agent.length) { result.notes.push('no agent- or notify-gated stage changed'); return result; }
    const subject = git(root, ['log', '-1', '--format=%s', sha]).out.trim();
    const pr = (await call('GET', `/repos/${repo}/commits/${sha}/pulls`)).data?.find?.(p => p.merged_at)?.number ?? subjectPull(subject);
    // An agent stage merged with no recorded review on its head: nothing required the check on the
    // pull request (it is not a required check, and the marker comment does not re-run it), so the
    // merge is checked too, and a missing review opens an issue.
    if (agent.length) {
      const head = pr ? (await call('GET', `/repos/${repo}/pulls/${pr}`)).data?.head?.sha ?? '' : '';
      const problem = !pr ? `${sha.slice(0, 12)} changed ${agent.join(', ')} without a pull request; an agent-gated change needs one, with a recorded review`
        : !head || !(await hasAgentReview({ call, repo, pr, head })) ? `${agent.join(', ')}: #${pr} merged with no independent review recorded on its head commit` : null;
      if (problem) {
        result.problems.push(problem);
        await openIssue({ call, repo, sha, pr, problem, runUrl: env.RUN_URL });
      }
    }
    if (notify.length) {
      const notifyFiles = files.filter(file => notify.includes(stageOf(file)));
      await notifyLead({ call, repo, sha, pr, stages: notify, files: notifyFiles });
      result.notes.push(`${notify.join(', ')}: notify gate; the lead was told in the decision queue`);
    }
  } else {
    result.notes.push(`nothing to check on ${event ?? 'this event'}`);
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
