#!/usr/bin/env node
// Process gate report (docs/improvement-plan-process.md, slice 23a). For a repository that uses
// rfr-process, lists each merged pull request that changed a gated stage's artifacts, with the time
// from its first request for approval (ready for review, or opened if it was never a draft) to the
// merge, and whether anything changed: commits made after that request, and reviews or comments
// from the person who merged it (the approver, in solo mode) at any time after it was opened, since
// approvers also comment on drafts. Then sums it up per stage.
//
// Usage: node checks/process-gate-report.mjs --repo <owner/name> [--since YYYY-MM-DD] [--label <name>] [--json]
//   --label replaces the repository name in the output, for a summary committed elsewhere. The JSON
//   holds pull request numbers, stages, times, and counts; no titles, bodies, or file names.
// Exit codes: 0 report printed, 2 usage error or gh failed.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_PATH, gatedStages, parseProcessConfig, stageOf } from './lib/process.mjs';

const QUERY = `query($owner:String!,$name:String!,$cursor:String){repository(owner:$owner,name:$name){pullRequests(states:MERGED,first:20,after:$cursor,orderBy:{field:CREATED_AT,direction:ASC}){pageInfo{hasNextPage endCursor}nodes{number createdAt mergedAt author{login} mergedBy{login} files(first:100){nodes{path}} commits(last:100){nodes{commit{committedDate}}} reviews(first:50){nodes{state submittedAt author{login}}} comments(first:100){nodes{createdAt body author{login}}} timelineItems(itemTypes:[READY_FOR_REVIEW_EVENT],first:5){nodes{... on ReadyForReviewEvent{createdAt}}}}}}}`;

// Agents post from the approver's account in solo mode. These are the forms their comments take in
// the pilots: a merge carried out on a quoted instruction, a CI failure report, a closing note, and a
// note that a requested change is done. Anything else from the approver counts as the approver's.
export const agentWritten = body => /^\s*(Merging\b|The approver\b|Closing this\b|Done in\b|Commit [0-9a-f]{7}|CI is\b|\*\*|`)/i.test(String(body ?? ''));

const isBot = login => !login || /\[bot\]$|^github-actions$|^dependabot$/.test(login);
const median = xs => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// One row per merged pull request that touched a gated stage.
export function gateRows(pulls, config) {
  const gated = new Set(gatedStages(config));
  const rows = [];
  for (const pr of pulls) {
    const stages = [...new Set((pr.files ?? []).map(stageOf).filter(s => s && gated.has(s)))];
    if (!stages.length) continue;
    const openedAt = Date.parse(pr.createdAt);
    const readyAt = Date.parse(pr.readyAt ?? pr.createdAt);
    const mergedAt = Date.parse(pr.mergedAt);
    const approver = pr.mergedBy ?? null;
    const commitsAfter = (pr.commitDates ?? []).filter(d => Date.parse(d) > readyAt).length;
    const reviewsChanges = (pr.reviews ?? []).filter(r => r.state === 'CHANGES_REQUESTED' && !isBot(r.author)).length;
    const approverNotes = [...(pr.reviews ?? []).filter(r => r.state === 'COMMENTED').map(r => ({ at: r.submittedAt, author: r.author })), ...(pr.comments ?? [])]
      .filter(c => c.author === approver && !c.agent && !isBot(c.author) && Date.parse(c.at) > openedAt).length;
    rows.push({
      number: pr.number,
      stages,
      readyAt: new Date(readyAt).toISOString(),
      mergedAt: pr.mergedAt,
      hours: Math.max(0, (mergedAt - readyAt) / 3600000),
      commitsAfter,
      reviewsChanges,
      approverNotes,
      changed: commitsAfter > 0 || reviewsChanges > 0 || approverNotes > 0,
    });
  }
  return rows;
}

export function summariseGates(rows, totalMerged) {
  const byStage = {};
  for (const row of rows) {
    for (const stage of row.stages) {
      byStage[stage] ??= { pulls: 0, unchanged: 0, hours: [], commitsAfter: 0, approverNotes: 0, reviewsChanges: 0 };
      const s = byStage[stage];
      s.pulls++;
      if (!row.changed) s.unchanged++;
      s.hours.push(row.hours);
      s.commitsAfter += row.commitsAfter > 0 ? 1 : 0;
      s.approverNotes += row.approverNotes > 0 ? 1 : 0;
      s.reviewsChanges += row.reviewsChanges > 0 ? 1 : 0;
    }
  }
  const stages = Object.fromEntries(Object.entries(byStage).map(([name, s]) => [name, {
    pulls: s.pulls,
    unchangedShare: s.unchanged / s.pulls,
    withCommitsAfterReady: s.commitsAfter,
    withApproverNotes: s.approverNotes,
    withChangesRequested: s.reviewsChanges,
    medianHours: median(s.hours),
    totalHours: s.hours.reduce((a, b) => a + b, 0),
  }]));
  return {
    merged: totalMerged,
    gated: rows.length,
    unchanged: rows.filter(r => !r.changed).length,
    medianHours: median(rows.map(r => r.hours)),
    totalHours: rows.reduce((a, r) => a + r.hours, 0),
    stages,
  };
}

const pct = x => `${Math.round(x * 100)}%`;
const h = x => (x === null ? 'n/a' : `${x.toFixed(1)} h`);

export function formatReport(label, summary) {
  const out = [`${label}: ${summary.gated} of ${summary.merged} merged pull requests changed a gated stage; ${summary.unchanged} (${summary.gated ? pct(summary.unchanged / summary.gated) : 'n/a'}) merged with nothing changed after the request for approval. Ready to merged: median ${h(summary.medianHours)}, total ${h(summary.totalHours)}.`, '',
    'Stage          Pulls  Unchanged  Commits after  Approver notes  Changes requested  Median wait'];
  for (const [name, s] of Object.entries(summary.stages)) {
    out.push(`${name.padEnd(14)} ${String(s.pulls).padStart(5)}  ${pct(s.unchangedShare).padStart(9)}  ${String(s.withCommitsAfterReady).padStart(13)}  ${String(s.withApproverNotes).padStart(14)}  ${String(s.withChangesRequested).padStart(17)}  ${h(s.medianHours)}`);
  }
  out.push('', "A pull request counts as changed if a commit is dated after its request for approval, or the approver reviewed or commented after it was opened. Agents commit from the approver's account, so commits after the request are an upper bound; comments in the forms agents use (merge notes, CI reports) are not counted as the approver's. A review held in the session before the pull request was opened is not visible here.");
  return out.join('\n');
}

// GitHub's GraphQL endpoint sometimes answers a large page with a 502, so each call is tried three times.
function gh(args, run) {
  let r;
  for (let attempt = 0; attempt < 3; attempt++) {
    r = run('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status === 0 || !/HTTP 50[234]/.test(r.stderr ?? '')) break;
  }
  if (r.status !== 0) throw new Error(`gh ${args[0]} failed: ${(r.stderr || '').trim()}`);
  return r.stdout;
}

export function fetchPulls(repo, run = spawnSync) {
  const [owner, name] = repo.split('/');
  const pulls = [];
  let cursor = null;
  do {
    const args = ['api', 'graphql', '-f', `query=${QUERY}`, '-F', `owner=${owner}`, '-F', `name=${name}`];
    if (cursor) args.push('-F', `cursor=${cursor}`);
    const page = JSON.parse(gh(args, run)).data.repository.pullRequests;
    for (const n of page.nodes) {
      pulls.push({
        number: n.number,
        createdAt: n.createdAt,
        mergedAt: n.mergedAt,
        mergedBy: n.mergedBy?.login ?? null,
        readyAt: n.timelineItems.nodes.map(t => t.createdAt).sort()[0] ?? null,
        files: n.files.nodes.map(f => f.path),
        commitDates: n.commits.nodes.map(c => c.commit.committedDate),
        reviews: n.reviews.nodes.map(r => ({ state: r.state, submittedAt: r.submittedAt, author: r.author?.login ?? null })),
        comments: n.comments.nodes.map(c => ({ at: c.createdAt, author: c.author?.login ?? null, agent: agentWritten(c.body) })),
      });
    }
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  return pulls;
}

export function fetchConfig(repo, run = spawnSync) {
  try {
    const text = Buffer.from(JSON.parse(gh(['api', `repos/${repo}/contents/${CONFIG_PATH}`], run)).content, 'base64').toString('utf8');
    return parseProcessConfig(text).config ?? {};
  } catch {
    return {};
  }
}

function main(argv) {
  let repo = null;
  let since = null;
  let label = null;
  const json = argv.includes('--json');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo') repo = argv[++i];
    else if (argv[i] === '--since') since = argv[++i];
    else if (argv[i] === '--label') label = argv[++i];
    else if (argv[i] !== '--json') { console.error(`unknown argument ${argv[i]}`); process.exit(2); }
  }
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || (since && Number.isNaN(Date.parse(since)))) {
    console.error('Usage: process-gate-report.mjs --repo <owner/name> [--since YYYY-MM-DD] [--label <name>] [--json]');
    process.exit(2);
  }
  let pulls;
  try {
    pulls = fetchPulls(repo);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  if (since) pulls = pulls.filter(p => Date.parse(p.mergedAt) >= Date.parse(since));
  const rows = gateRows(pulls, fetchConfig(repo));
  const summary = summariseGates(rows, pulls.length);
  const name = label ?? repo;
  console.log(json ? JSON.stringify({ repository: name, since, ...summary, pulls: rows }, null, 2) : formatReport(name, summary));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
