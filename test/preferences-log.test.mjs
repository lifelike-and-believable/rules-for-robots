// The preferences log (docs/improvement-plan.md, slice 19h): the lead's corrections, kept in
// docs/preferences.md so each is given once.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parseRuleFile } from '../checks/lib/rules.mjs';

const PROFILES = ['web-app', 'static-site', 'unreal-plugin'];
const LINE = 'Read `docs/preferences.md` before design, interface, or documentation work, and add to it when the project lead corrects something.';

test('every template repo carries docs/preferences.md and the AGENTS.md line', () => {
  const template = fs.readFileSync('templates/repo-files/common/docs/preferences.md', 'utf8');
  for (const area of ['Interface', 'Wording', 'Code', 'Tooling']) assert.match(template, new RegExp(`^## ${area}$`, 'm'));
  for (const p of PROFILES) {
    assert.equal(fs.readFileSync(`template-repos/${p}/docs/preferences.md`, 'utf8'), template, p);
    assert.ok(fs.readFileSync(`template-repos/${p}/AGENTS.md`, 'utf8').includes(LINE), p);
  }
});

test('install-rules offers the file from its payload, with the same line', () => {
  assert.equal(fs.readFileSync('plugins/core/skills/install-rules/payload/preferences.md', 'utf8'), fs.readFileSync('templates/repo-files/common/docs/preferences.md', 'utf8'));
  assert.ok(fs.readFileSync('plugins/core/skills/install-rules/SKILL.md', 'utf8').includes(LINE));
});

test('the delegated agreement records corrections, and the reviewers check against the log', () => {
  assert.match(parseRuleFile('evals/candidates/WA-004-delegated.md').body, /When the user corrects your work, apply the correction, add or update the preference in `docs\/preferences\.md`/);
  for (const file of ['plugins/core/agents/ux-reviewer.md', 'plugins/process/agents/persona-walkthrough.md', 'plugins/core/skills/review-pr/SKILL.md']) {
    assert.match(fs.readFileSync(file, 'utf8'), /docs\/preferences\.md/, file);
  }
});
