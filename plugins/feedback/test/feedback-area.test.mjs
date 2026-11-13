// feedback#AC-8: Area is an optional text field that links fill in (issue #133).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from 'yaml';
import { FIELDS } from '../scripts/feedback.mjs';
import { runIntake } from '../../../checks/ci/feedback-intake.mjs';

test('feedback#AC-8: the form\'s area is an optional text input that describes each area', () => {
  const form = parse(fs.readFileSync('.github/ISSUE_TEMPLATE/feedback.yml', 'utf8'));
  const area = form.body.find(b => b.id === 'area');
  assert.equal(area.type, 'input');
  assert.notEqual(area.validations?.required, true);
  for (const name of ['rfr-core', 'rfr-process', 'rfr-feedback', 'rules', 'evals']) assert.match(area.attributes.description, new RegExp(name));
  assert.notEqual(FIELDS.find(f => f.id === 'area').required, true);
});

test('feedback#AC-8: intake asks nothing for an issue without an area', async () => {
  const posts = [];
  const res = (status, body) => ({ ok: status < 300, status, headers: new Headers(), json: async () => body });
  const fetch = async (url, init = {}) => {
    if ((init.method ?? 'GET') !== 'GET') posts.push({ path: new URL(url).pathname, body: JSON.parse(init.body ?? '{}') });
    return res((init.method ?? 'GET') === 'GET' ? 200 : 201, []);
  };
  const body = FIELDS.map(f => `### ${f.label}\n\n${f.id === 'area' ? '_No response_' : `the ${f.id}`}`).join('\n\n');
  await runIntake({ issue: { number: 50, title: 'Feedback: something', body, labels: [{ name: 'feedback' }] }, repo: 'acme/rfr', fetch, api: 'https://api.github.test', token: 't' });
  const added = posts.filter(p => /\/issues\/50\/labels$/.test(p.path)).flatMap(p => p.body.labels);
  assert.deepEqual(added, ['triage:new']);
  assert.deepEqual(posts.filter(p => /\/comments$/.test(p.path)), []);
});
