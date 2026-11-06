// Tests for the feedback intake (docs/specs/feedback.md). Each test title cites its criterion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from 'yaml';
import { FIELDS, issueBody, issueUrl, scanPrivate } from '../plugins/feedback/scripts/feedback.mjs';
import { runIntake } from '../checks/ci/feedback-intake.mjs';

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));

test('feedback#AC-1: rfr-feedback is in the marketplace, depends on nothing, and nothing depends on it', () => {
  const market = readJson('.claude-plugin/marketplace.json');
  const entry = market.plugins.find(p => p.name === 'rfr-feedback');
  assert.ok(entry, 'marketplace entry');
  assert.equal(entry.source, './plugins/feedback');
  const own = readJson('plugins/feedback/.claude-plugin/plugin.json');
  assert.equal(own.name, 'rfr-feedback');
  assert.ok(!own.dependencies || own.dependencies.length === 0);
  for (const p of ['plugins/core/.claude-plugin/plugin.json', 'plugins/process/.claude-plugin/plugin.json']) {
    assert.ok(!(readJson(p).dependencies ?? []).includes('rfr-feedback'), p);
  }
});

const DRAFT = {
  title: 'spec-lock skips a block-list tests-commit',
  area: 'rfr-process',
  versions: 'rfr-core 2.2.2, rfr-process 0.10.5',
  happened: 'The lock reported success but checked nothing.',
  evidence: 'spec-lock printed "0 spec(s) with a tests-commit checked".',
  suggestion: 'Read the block-list form, or fail.',
  source: 'a static site in solo mode',
};

test('feedback#AC-2: the issue body and the form link carry every field, encoded', () => {
  const body = issueBody(DRAFT);
  for (const f of FIELDS) if (DRAFT[f.id]) assert.ok(body.includes(DRAFT[f.id]), f.id);
  const url = new URL(issueUrl(DRAFT).url);
  assert.equal(url.origin + url.pathname, 'https://github.com/lifelike-and-believable/rules-for-robots/issues/new');
  assert.equal(url.searchParams.get('template'), 'feedback.yml');
  assert.equal(url.searchParams.get('title'), `Feedback: ${DRAFT.title}`);
  for (const f of FIELDS) assert.equal(url.searchParams.get(f.id), DRAFT[f.id] ?? null, f.id);
});

test('feedback#AC-2: a draft too long for a link is reported', () => {
  const r = issueUrl({ ...DRAFT, evidence: 'x'.repeat(9000) });
  assert.equal(r.tooLong, true);
  assert.equal(issueUrl(DRAFT).tooLong, false);
});

test('feedback#AC-3: emails, tokens, home paths, IP addresses, and other repositories are found with their line', () => {
  const text = [
    'Contact star@example.com about it.',
    'The token was ghp_abcdefghijklmnopqrstuvwxyz0123456789.',
    'It failed in /Users/alex/kettlebird/src/reader.ts.',
    'The preview at 10.1.2.3 timed out.',
    'See https://github.com/acme/private-site/pull/131.',
  ].join('\n');
  const kinds = scanPrivate(text).map(f => `${f.kind}@${f.line}`);
  assert.deepEqual(kinds, ['email@1', 'token@2', 'home-path@3', 'ip-address@4', 'other-repository@5']);
});

test('feedback#AC-3: links to rules-for-robots and version numbers are not reported', () => {
  const text = 'Since https://github.com/lifelike-and-believable/rules-for-robots/pull/128 (rfr-process 0.10.5, rfr-core 2.2.2) it works.';
  assert.deepEqual(scanPrivate(text), []);
});

test('feedback#AC-4: the issue form labels feedback and its field IDs match the script', () => {
  const form = parse(fs.readFileSync('.github/ISSUE_TEMPLATE/feedback.yml', 'utf8'));
  assert.ok(form.labels.includes('feedback'));
  const ids = form.body.filter(b => b.id).map(b => b.id).sort();
  assert.deepEqual(ids, FIELDS.map(f => f.id).sort());
});

// ---- AC-5: intake ------------------------------------------------------------------------------

function fakeGitHub({ open = [] } = {}) {
  const calls = [];
  const res = (status, body) => ({ ok: status < 300, status, headers: new Headers(), json: async () => body });
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method, path: u.pathname, body });
    if (method === 'GET' && u.pathname === '/repos/acme/rfr/issues') return res(200, open);
    if (method === 'GET' && /\/comments$/.test(u.pathname)) return res(200, []);
    return res(201, {});
  };
  return { fetch, calls };
}
const formBody = fields => FIELDS.map(f => `### ${f.label}\n\n${fields[f.id] ?? '_No response_'}`).join('\n\n');
const issue = (fields, extra = {}) => ({ number: 40, title: `Feedback: ${fields.title ?? DRAFT.title}`, body: formBody(fields), labels: [{ name: 'feedback' }], ...extra });
const intake = (iss, gh) => runIntake({ issue: iss, repo: 'acme/rfr', fetch: gh.fetch, api: 'https://api.github.test', token: 't' });
const labelsAdded = gh => gh.calls.filter(c => c.method === 'POST' && /\/labels$/.test(c.path) && c.path.includes('/issues/')).flatMap(c => c.body.labels);
const comments = gh => gh.calls.filter(c => c.method === 'POST' && /\/comments$/.test(c.path)).map(c => c.body.body);

test('feedback#AC-5: a complete feedback issue is labelled triage:new and gets no comment', async () => {
  const gh = fakeGitHub();
  await intake(issue(DRAFT), gh);
  assert.deepEqual(labelsAdded(gh), ['triage:new']);
  assert.deepEqual(comments(gh), []);
});

test('feedback#AC-5: missing versions or area asks once, with needs-info', async () => {
  const gh = fakeGitHub();
  await intake(issue({ ...DRAFT, versions: undefined }), gh);
  assert.ok(labelsAdded(gh).includes('needs-info'));
  assert.equal(comments(gh).length, 1);
  assert.match(comments(gh)[0], /versions/i);
});

test('feedback#AC-5: open feedback issues with closely matching titles are listed', async () => {
  const gh = fakeGitHub({ open: [
    { number: 12, title: 'Feedback: spec-lock skips block-list tests-commit entries', labels: [{ name: 'feedback' }] },
    { number: 13, title: 'Feedback: tutorial runner clicks hidden controls', labels: [{ name: 'feedback' }] },
  ] });
  await intake(issue(DRAFT), gh);
  const c = comments(gh).join('\n');
  assert.match(c, /#12/);
  assert.doesNotMatch(c, /#13/);
});

test('feedback#AC-5: possible private details get check-privacy without being quoted', async () => {
  const gh = fakeGitHub();
  await intake(issue({ ...DRAFT, evidence: 'Ask star@example.com.' }), gh);
  assert.ok(labelsAdded(gh).includes('check-privacy'));
  assert.doesNotMatch(comments(gh).join('\n'), /star@example\.com/);
  assert.match(comments(gh).join('\n'), /email/);
});

test('feedback#AC-5: an issue that is not feedback is left alone', async () => {
  const gh = fakeGitHub();
  await intake({ number: 41, title: 'Bug in build', body: 'x', labels: [] }, gh);
  assert.deepEqual(gh.calls.filter(c => c.method === 'POST'), []);
});
