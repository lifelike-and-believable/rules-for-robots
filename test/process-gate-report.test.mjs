// Process gate report (docs/improvement-plan-process.md, slice 23a): gated pull requests, how long
// each waited for approval, and whether anything changed before the merge.
import assert from 'node:assert/strict';
import test from 'node:test';
import { agentWritten, fetchConfig, fetchPulls, formatReport, gateRows, summariseGates } from '../checks/process-gate-report.mjs';

const config = { mode: 'solo', default: ['lead'], stages: {} };
const pr = (number, files, extra = {}) => ({ number, createdAt: '2026-11-01T10:00:00Z', readyAt: null, mergedAt: '2026-11-01T12:00:00Z', mergedBy: 'lead', files, commitDates: ['2026-11-01T09:59:00Z'], reviews: [], comments: [], ...extra });

const pulls = [
  pr(1, ['docs/product/concept.md']),
  pr(2, ['docs/design/home.md', 'docs/user/home.md'], { commitDates: ['2026-11-01T09:00:00Z', '2026-11-01T11:00:00Z'] }),
  pr(3, ['docs/product/stories/a.md'], { comments: [{ at: '2026-11-01T10:30:00Z', author: 'lead', agent: false }] }),
  pr(4, ['docs/product/stories/b.md'], { comments: [{ at: '2026-11-01T11:00:00Z', author: 'lead', agent: true }, { at: '2026-11-01T11:00:00Z', author: 'github-actions', agent: false }] }),
  pr(5, ['src/app.ts', 'docs/specs/x.md']),
  pr(6, ['docs/design/x.md'], { readyAt: '2026-11-01T11:30:00Z', commitDates: ['2026-11-01T11:00:00Z'], reviews: [{ state: 'CHANGES_REQUESTED', submittedAt: '2026-11-01T10:10:00Z', author: 'lead' }] }),
];

test('only pull requests that change a gated stage are listed, with their stages', () => {
  const rows = gateRows(pulls, config);
  assert.deepEqual(rows.map(r => r.number), [1, 2, 3, 4, 6]);
  assert.deepEqual(rows.find(r => r.number === 2).stages, ['design', 'user-docs']);
});

test('specs are gated only when process.yml names spec approvers', () => {
  const rows = gateRows(pulls, { ...config, stages: { specs: ['lead'] } });
  assert.deepEqual(rows.find(r => r.number === 5).stages, ['specs']);
});

test('a change is a later commit, a request for changes, or a note from the approver', () => {
  const byNumber = Object.fromEntries(gateRows(pulls, config).map(r => [r.number, r]));
  assert.equal(byNumber[1].changed, false);
  assert.equal(byNumber[2].commitsAfter, 1);
  assert.equal(byNumber[2].changed, true);
  assert.equal(byNumber[3].approverNotes, 1);
  assert.equal(byNumber[4].changed, false, 'agent-written notes and bot comments do not count');
  assert.equal(byNumber[6].reviewsChanges, 1);
  assert.equal(byNumber[6].commitsAfter, 0, 'a commit before ready for review is not after the request');
  assert.equal(byNumber[6].hours, 0.5, 'the wait runs from ready for review');
});

test('agent-written comments are recognised by the forms agents use', () => {
  assert.equal(agentWritten('Merging at the project lead\'s instruction: "merge it".'), true);
  assert.equal(agentWritten('The approver said: "merge when green".'), true);
  assert.equal(agentWritten('**test** failed on one step'), true);
  assert.equal(agentWritten('Done in 01d9885.'), true);
  assert.equal(agentWritten('Chapter thumbnails should not be left out'), false);
});

test('the summary gives the unchanged share and waits per stage', () => {
  const s = summariseGates(gateRows(pulls, config), pulls.length);
  assert.equal(s.merged, 6);
  assert.equal(s.gated, 5);
  assert.equal(s.unchanged, 2);
  assert.equal(s.stages.stories.pulls, 2);
  assert.equal(s.stages.stories.unchangedShare, 0.5);
  assert.equal(s.stages.design.withChangesRequested, 1);
  assert.equal(s.stages.concept.medianHours, 2);
  assert.match(formatReport('pilot', s), /pilot: 5 of 6 merged pull requests changed a gated stage; 2 \(40%\)/);
});

test('fetching pages through gh, retrying a 502, and reading process.yml', () => {
  const calls = [];
  const node = n => ({ number: n, createdAt: 'c', mergedAt: 'm', mergedBy: { login: 'lead' }, files: { nodes: [{ path: 'docs/product/concept.md' }] }, commits: { nodes: [{ commit: { committedDate: 'd' } }] }, reviews: { nodes: [] }, comments: { nodes: [{ createdAt: 't', body: 'Merging now', author: { login: 'lead' } }] }, timelineItems: { nodes: [{ createdAt: 'r2' }, { createdAt: 'r1' }] } });
  const pages = [
    { status: 1, stderr: 'gh: HTTP 502' },
    { status: 0, stdout: JSON.stringify({ data: { repository: { pullRequests: { pageInfo: { hasNextPage: true, endCursor: 'C1' }, nodes: [node(1)] } } } }) },
    { status: 0, stdout: JSON.stringify({ data: { repository: { pullRequests: { pageInfo: { hasNextPage: false }, nodes: [node(2)] } } } }) },
  ];
  const run = (cmd, args) => { calls.push(args); return pages.shift(); };
  const got = fetchPulls('o/r', run);
  assert.deepEqual(got.map(p => p.number), [1, 2]);
  assert.equal(got[0].readyAt, 'r1');
  assert.equal(got[0].comments[0].agent, true);
  assert.ok(calls[2].includes('cursor=C1'));
  const yml = Buffer.from('mode: solo\ndefault: [lead]\nstages:\n  specs: [lead]\n').toString('base64');
  assert.deepEqual(fetchConfig('o/r', () => ({ status: 0, stdout: JSON.stringify({ content: yml }) })).stages.specs, ['lead']);
  assert.deepEqual(fetchConfig('o/r', () => ({ status: 1, stderr: 'HTTP 404' })), {});
});
