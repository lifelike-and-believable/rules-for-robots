// Tests for the CI verify plan (checks/ci/verify-ci.mjs): which tests and checks a pull request's
// changes run in this repository's CI (rewrite plan 25e, verify inventory slice f).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';
import { dependencies, isDocsOnly, plan, steps } from '../checks/ci/verify-ci.mjs';

const root = process.cwd();
const run = changed => plan(root, changed);
const PLUGINS_WITH_TESTS = ['android', 'feedback', 'unreal', 'web'];

test('a documents-only change runs no tests, and Markdown in rules, templates, or plugins is not documents-only', () => {
  assert.equal(isDocsOnly(['docs/handoff.md', 'README.md', 'docs/specs/feedback.md']), true);
  for (const f of ['rules/core/testing/TEST-001-keep-tests-honest.md', 'templates/agents-md/web-app.md', 'plugins/process/GUIDE.md', 'docs/a.json']) {
    assert.equal(isDocsOnly(['docs/handoff.md', f]), false, f);
  }
  assert.equal(isDocsOnly([]), false, 'no changes is not documents-only');
  const p = run(['docs/handoff.md']);
  assert.equal(p.docsOnly, true);
  const skipped = steps(p).filter(s => s.skip).map(s => s.name);
  assert.deepEqual(skipped, ['setup:vale', 'tests', 'check:unreal-sample']);
  assert.ok(steps(p).some(s => s.name === 'check:specs' && !s.skip), 'specs are still checked');
});

test('a plugin\'s tests run when the plugin, a file its tests import, or a path they name changes', () => {
  assert.deepEqual(run(['plugins/web/scripts/guard-mcp.mjs']).plugins, ['web']);
  assert.deepEqual(run(['plugins/web/README.md']).plugins, ['web']);
  assert.deepEqual(run(['checks/ci/feedback-intake.mjs']).plugins, ['feedback'], 'imported from outside the plugin');
  assert.deepEqual(run(['.github/ISSUE_TEMPLATE/feedback.yml']).plugins, ['feedback'], 'a path the test names');
  assert.deepEqual(run(['plugins/core/scripts/guard-commands.mjs']).plugins, ['unreal'], 'guard-unreal tests import the core guard');
  assert.deepEqual(run(['src/unrelated.mjs', 'test/plan.test.mjs']).plugins, []);
  assert.equal(run(['test/plan.test.mjs']).rootTests, true, 'the root tests always run');
});

test('the Unreal sample check runs only when rfr-unreal, checks/unreal, or the sample changes', () => {
  for (const f of ['plugins/unreal/scripts/guard-unreal.mjs', 'checks/unreal/tier1.mjs', 'examples/unreal/RfrSample/RfrSample.uplugin']) assert.equal(run([f]).unrealSample, true, f);
  assert.equal(run(['plugins/web/scripts/guard-mcp.mjs']).unrealSample, false);
});

test('no base, or a change to the test setup, runs everything', () => {
  for (const changed of [null, ['package.json'], ['package-lock.json'], ['.github/workflows/verify.yml'], ['checks/ci/verify-ci.mjs']]) {
    const p = run(changed);
    assert.deepEqual(p.plugins, PLUGINS_WITH_TESTS, JSON.stringify(changed));
    assert.equal(p.unrealSample, true);
    assert.equal(steps(p).filter(s => s.skip).length, 0);
  }
});

test('the plan follows imports through every file, and names only paths the test file itself quotes', () => {
  const d = dependencies(root, 'plugins/unreal/test/guard-unreal.test.mjs');
  assert.ok(d.files.includes('plugins/core/scripts/lib.mjs'), 'reached through guard-commands');
  assert.ok(!d.named.includes('docs/specs'), 'a path the guard names is not a dependency of the test');
});

test('the steps are the verify chain, in its order', () => {
  const chain = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts.verify.split('&&').map(s => s.trim().replace(/^npm (run )?/, ''));
  assert.deepEqual(steps(run(null)).map(s => s.name), chain.map(s => (s === 'test' ? 'tests' : s)));
});

test('CI runs the plan, and skips the Windows job for a documents-only pull request', () => {
  const wf = YAML.parse(fs.readFileSync('.github/workflows/verify.yml', 'utf8'));
  assert.match(wf.jobs.plan.steps.at(-1).run, /verify-ci\.mjs --plan --github-output/);
  for (const job of ['verify', 'verify-windows']) {
    assert.equal(wf.jobs[job].needs, 'plan', job);
    const last = wf.jobs[job].steps.at(-1);
    assert.match(last.run, /verify-ci\.mjs$/, job);
    assert.match(last.env.BASE_SHA, /pull_request\.base\.sha/, job);
  }
  assert.match(wf.jobs['verify-windows'].if, /docs-only != 'true'/);
  assert.equal(wf.jobs.verify.if, undefined, 'the required verify check always reports');
});
