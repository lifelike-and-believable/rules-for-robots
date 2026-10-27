#!/usr/bin/env node
// CI status comment: when a workflow finishes, post a new comment on the pull request that
// names the head commit, each job's result, and the run. An agent or person waiting on CI gets
// a notification instead of polling. Each run posts a new comment rather than editing one,
// because agents are woken by new comments (the Claude desktop app's pull request monitor
// relays them) and an edited comment may wake nobody. The comment names the full SHA
// because a "CI passed" comment about an older commit is how stale-green merges happen
// (rules-for-robots#30): readers still confirm the checks on the current head.
//
// Runs from the reusable rfr-ci-status.yml workflow. Never fails the workflow: problems
// (no token, no pull request, fork permissions) are logged and the script exits 0.
// Environment: GITHUB_TOKEN, GITHUB_REPOSITORY, RESULTS (toJSON(needs)), HEAD_SHA,
// PR_NUMBER (optional), WORKFLOW_NAME, RUN_URL, GITHUB_API_URL (optional).
import { fileURLToPath } from 'node:url';

export const marker = workflow => `<!-- rfr-ci-status:${workflow} -->`;

export function overallResult(needs) {
  const results = Object.values(needs ?? {}).map(job => job?.result);
  if (!results.length) return 'failed';
  if (results.includes('failure')) return 'failed';
  if (results.includes('cancelled')) return 'cancelled';
  return results.every(r => r === 'success' || r === 'skipped') ? 'passed' : 'failed';
}

const headlines = {
  passed: workflow => `✅ **${workflow} completed successfully!**`,
  failed: workflow => `❌ **${workflow} failed**`,
  cancelled: workflow => `⚪ **${workflow} was cancelled**`,
};

export function renderComment({ workflow, sha, needs, runUrl }) {
  const result = overallResult(needs);
  const entries = Object.entries(needs ?? {});
  const rows = entries.map(([job, value]) => `| ${job} | ${value?.result ?? 'unknown'} |`);
  const skipped = entries.filter(([, value]) => value?.result === 'skipped').map(([job]) => job);
  return [
    marker(workflow),
    `${headlines[result](workflow)} on \`${sha}\`.`,
    ...(result === 'passed' && skipped.length ? ['', `Skipped (counted as passed): ${skipped.join(', ')}.`] : []),
    '',
    '| Job | Result |',
    '|---|---|',
    ...rows,
    '',
    `[Run](${runUrl})`,
    '',
    'A later push makes this comment stale, so confirm the checks on the current head commit before merging.',
  ].join('\n');
}

export async function postStatus({ fetch = globalThis.fetch, api = 'https://api.github.com', token, repo, pr, workflow, sha, needs, runUrl, log = console.log }) {
  if (!token) return log('rfr-ci-status: no token; skipping the status comment');
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' };
  const call = async (method, path, body) => {
    const response = await fetch(`${api}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status}`);
    return response.json();
  };
  try {
    let numbers = pr ? [Number(pr)] : [];
    if (!numbers.length) {
      const pulls = await call('GET', `/repos/${repo}/commits/${sha}/pulls`);
      numbers = pulls.filter(p => p.state === 'open').map(p => p.number);
    }
    if (!numbers.length) return log(`rfr-ci-status: no open pull request contains ${sha}; nothing to comment on`);
    const body = renderComment({ workflow, sha, needs, runUrl });
    for (const number of numbers) {
      await call('POST', `/repos/${repo}/issues/${number}/comments`, { body });
      log(`rfr-ci-status: posted the ${workflow} status on #${number}`);
    }
  } catch (error) {
    log(`rfr-ci-status: could not post the status comment (${error.message}); pull requests from forks get a read-only token`);
  }
}

async function main() {
  let needs = {};
  try { needs = JSON.parse(process.env.RESULTS || '{}'); } catch {}
  await postStatus({
    api: process.env.GITHUB_API_URL || 'https://api.github.com',
    token: process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPOSITORY,
    pr: process.env.PR_NUMBER || null,
    workflow: process.env.WORKFLOW_NAME || 'CI',
    sha: process.env.HEAD_SHA,
    needs,
    runUrl: process.env.RUN_URL,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
