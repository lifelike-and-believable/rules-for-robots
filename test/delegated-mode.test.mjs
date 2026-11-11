// Delegated mode (docs/improvement-plan.md, slice 19b): working-agreement files that replace WA-002,
// WA-003, and WA-004 when .claude/rfr.json says "mode": "delegated", and the decision log.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseRuleFile, validateTree } from '../checks/lib/rules.mjs';

const PAYLOAD = 'plugins/core/skills/install-rules/payload';
const MODE_DIR = path.join(PAYLOAD, 'modes', 'delegated');
const delegated = () => fs.readdirSync(MODE_DIR).filter(f => f.endsWith('.md')).sort();

test('the payload carries one delegated file for each of WA-002, WA-003, and WA-004, built from evals/candidates', () => {
  assert.deepEqual(delegated(), ['WA-002-delegated.md', 'WA-003-delegated.md', 'WA-004-delegated.md']);
  for (const name of delegated()) {
    assert.equal(fs.readFileSync(path.join(MODE_DIR, name), 'utf8'), fs.readFileSync(path.join('evals/candidates', name), 'utf8'), name);
    const { meta } = parseRuleFile(path.join(MODE_DIR, name));
    assert.equal(meta.replaces, meta.id, `${name} replaces the rule whose id it keeps`);
    assert.ok(fs.readdirSync(path.join(PAYLOAD, 'rules/core/working-agreement')).some(f => f.startsWith(`${meta.id}-`)), `${meta.id} exists in core`);
  }
});

// What install-rules does for "mode": "delegated": copy core, then swap each replaced file.
function installDelegated() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-delegated-'));
  const rules = path.join(root, '.claude', 'rules');
  fs.cpSync(path.join(PAYLOAD, 'rules', 'core'), path.join(rules, 'core'), { recursive: true });
  const wa = path.join(rules, 'core', 'working-agreement');
  for (const name of delegated()) {
    const { meta } = parseRuleFile(path.join(MODE_DIR, name));
    for (const f of fs.readdirSync(wa)) if (f.startsWith(`${meta.replaces}-`)) fs.rmSync(path.join(wa, f));
    fs.copyFileSync(path.join(MODE_DIR, name), path.join(wa, name));
  }
  return { root, rules, wa };
}

test('a delegated install lints like the supervised one, with no duplicate ids', () => {
  const { root, rules, wa } = installDelegated();
  const results = validateTree(rules, { adoptingRepo: true });
  assert.deepEqual(results.filter(r => r.errors.length).map(r => `${path.basename(r.file)}: ${r.errors.join('; ')}`), []);
  const names = fs.readdirSync(wa);
  for (const id of ['WA-002', 'WA-003', 'WA-004']) assert.deepEqual(names.filter(f => f.startsWith(`${id}-`)), [`${id}-delegated.md`]);
  fs.rmSync(root, { recursive: true, force: true });
});

test('the delegated wording keeps tests honest and keeps the irreversible stops', () => {
  const body = name => parseRuleFile(path.join(MODE_DIR, name)).body;
  assert.match(body('WA-002-delegated.md'), /do not change the test or the code to get it to pass/);
  assert.match(body('WA-002-delegated.md'), /## Decisions/);
  const wa3 = body('WA-003-delegated.md');
  for (const stop of ['force-push', 'rewriting published history', 'shared database', 'spending money', 'publishing']) assert.match(wa3, new RegExp(stop));
  assert.equal(parseRuleFile(path.join(MODE_DIR, 'WA-003-delegated.md')).meta.level, 'MUST');
});

test('install-rules reads the mode, and the guide documents it', () => {
  const skill = fs.readFileSync('plugins/core/skills/install-rules/SKILL.md', 'utf8');
  assert.match(skill, /"mode"/);
  assert.match(skill, /modes\/delegated/);
  assert.match(fs.readFileSync('practices/guards.md', 'utf8'), /`mode` is the project's working mode/);
});

test('the pull request template has a Decisions section, and review-pr reads it', () => {
  for (const file of ['templates/repo-files/common/.github/pull_request_template.md', ...['web-app', 'static-site', 'unreal-plugin'].map(p => `template-repos/${p}/.github/pull_request_template.md`)]) {
    assert.match(fs.readFileSync(file, 'utf8'), /^## Decisions$/m, file);
  }
  assert.match(fs.readFileSync('plugins/core/skills/review-pr/SKILL.md', 'utf8'), /## Decisions/);
});
