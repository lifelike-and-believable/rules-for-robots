// Tests for the GitHub gate (docs/specs/github-gate.md): the workflow that opens a pull request as
// a GitHub App, the CODEOWNERS block for approve-gated stages, and the setup script that plans and
// applies the repository settings. Each test title cites the criterion it covers (github-gate#AC-n).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';
import { parseProcessConfig } from '../checks/lib/process.mjs';
import { MANUAL_STEPS, gateCodeowners, planSetup, runSetup } from '../checks/process-github-setup.mjs';

const TEMPLATE = 'plugins/process/templates/workflows/rfr-open-pr.yml';
const config = text => parseProcessConfig(text).config;

test('github-gate#AC-1 the workflow opens a pull request as the App and turns on auto-merge', () => {
  const text = fs.readFileSync(TEMPLATE, 'utf8');
  const wf = parse(text);
  assert.deepEqual(wf.on.push.branches, ['claude/**', 'phase-*/**', 'feature/**']);
  assert.deepEqual(wf.permissions, { contents: 'read' });
  const steps = wf.jobs.open.steps;
  const token = steps.find(s => String(s.uses ?? '').startsWith('actions/create-github-app-token@'));
  assert.equal(token.with['app-id'], '${{ vars.RFR_APP_ID }}');
  assert.equal(token.with['private-key'], '${{ secrets.RFR_APP_PRIVATE_KEY }}');
  const run = steps.find(s => s.run);
  assert.equal(run.env.GH_TOKEN, `\${{ steps.${token.id}.outputs.token }}`);
  assert.equal(run.env.BRANCH, '${{ github.ref_name }}');
  assert.ok(!run.run.includes('${{'), 'no expression text inside the script');
  assert.match(run.run, /gh pr list --head "\$BRANCH" --state open/);
  assert.match(run.run, /git log -1 --format=%s/);
  assert.match(run.run, /gh pr create --head "\$BRANCH"/);
  assert.match(run.run, /gh pr merge "\$number" --auto --merge/);
});

test('github-gate#AC-2 the CODEOWNERS block covers approve-gated stages in solo and team mode', () => {
  const solo = gateCodeowners(config('mode: solo\ndefault: [lead]\n'));
  assert.match(solo, /^# rfr-process:begin/);
  assert.match(solo, /^\/docs\/design\/ @lead$/m);
  assert.match(solo, /^\/docs\/user\/ @lead$/m);
  assert.match(solo, /^\/docs\/tutorials\/ @lead$/m);
  assert.match(solo, /# rfr-process:end\n$/);

  const team = gateCodeowners(config('mode: team\ndefault: [lead]\nstages:\n  design: [ux-lead]\ngates:\n  stories: agent\n'));
  assert.match(team, /^\/docs\/design\/ @ux-lead$/m);
  assert.ok(!/\/docs\/product\/stories\//.test(team), 'a stage gated agent has no owner line');
});

const REPO = { default_branch: 'main', allow_auto_merge: false };
const names = plan => plan.map(c => c.name);

test('github-gate#AC-3 the plan for a repository with no protection', () => {
  const plan = planSetup({ repo: REPO, protection: null, variable: null, appId: '42', checks: ['verify'] });
  assert.deepEqual(names(plan), ['allow auto-merge', 'branch protection on main', 'variable RFR_APP_ID']);
  const body = plan[1].body;
  assert.deepEqual(body.required_status_checks.contexts, ['verify']);
  assert.equal(body.required_pull_request_reviews.require_code_owner_reviews, true);
  assert.equal(body.required_pull_request_reviews.required_approving_review_count, 0);
  assert.equal(body.required_pull_request_reviews.require_last_push_approval, false);
  assert.equal(body.enforce_admins, true);
  assert.equal(body.restrictions, null);
});

test('github-gate#AC-3 existing protection is kept and added to', () => {
  const protection = {
    required_status_checks: { strict: true, contexts: ['build'] },
    enforce_admins: { enabled: false },
    required_pull_request_reviews: { dismiss_stale_reviews: true, require_code_owner_reviews: false, required_approving_review_count: 1, require_last_push_approval: true },
    restrictions: { users: [{ login: 'lead' }], teams: [{ slug: 'core' }], apps: [] },
    required_linear_history: { enabled: true },
    allow_force_pushes: { enabled: false },
    allow_deletions: { enabled: false },
    required_conversation_resolution: { enabled: true },
  };
  const plan = planSetup({ repo: { ...REPO, allow_auto_merge: true }, protection, variable: { value: '42' }, appId: '42', checks: ['verify'] });
  assert.deepEqual(names(plan), ['branch protection on main']);
  const body = plan[0].body;
  assert.deepEqual(body.required_status_checks, { strict: true, contexts: ['build', 'verify'] });
  assert.equal(body.required_pull_request_reviews.required_approving_review_count, 1);
  assert.equal(body.required_pull_request_reviews.dismiss_stale_reviews, true);
  assert.equal(body.required_pull_request_reviews.require_code_owner_reviews, true);
  assert.equal(body.required_pull_request_reviews.require_last_push_approval, false);
  assert.equal(body.enforce_admins, true);
  assert.deepEqual(body.restrictions, { users: ['lead'], teams: ['core'], apps: [] });
  assert.equal(body.required_linear_history, true);
  assert.equal(body.required_conversation_resolution, true);
});

test('github-gate#AC-3 a repository already set up has an empty plan', () => {
  const protection = {
    required_status_checks: { strict: false, contexts: ['verify'] },
    enforce_admins: { enabled: true },
    required_pull_request_reviews: { require_code_owner_reviews: true, required_approving_review_count: 0, require_last_push_approval: false },
    restrictions: null,
  };
  const plan = planSetup({ repo: { ...REPO, allow_auto_merge: true }, protection, variable: { value: '42' }, appId: '42', checks: ['verify'] });
  assert.deepEqual(plan, []);
});

// A project folder with process.yml, and a stub for GitHub that records every request.
function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-gate-'));
  fs.mkdirSync(path.join(root, 'docs/product'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/product/process.yml'), 'mode: solo\ndefault: [lead]\n');
  return root;
}
function github({ fail = {}, secret = false, protection = 404 } = {}) {
  const calls = [];
  const request = async (method, url, body) => {
    calls.push({ method, url, body });
    const key = `${method} ${url}`;
    if (fail[key]) return { status: fail[key], data: { message: 'refused' } };
    if (key === 'GET /repos/acme/app') return { status: 200, data: REPO };
    if (key === 'GET /repos/acme/app/branches/main/protection') return protection === 404 ? { status: 404, data: {} } : { status: 200, data: protection };
    if (key === 'GET /repos/acme/app/actions/variables/RFR_APP_ID') return { status: 404, data: {} };
    if (key === 'GET /repos/acme/app/actions/secrets/RFR_APP_PRIVATE_KEY') return secret ? { status: 200, data: { name: 'RFR_APP_PRIVATE_KEY' } } : { status: 404, data: {} };
    return { status: 200, data: {} };
  };
  return { calls, request, writes: () => calls.filter(c => c.method !== 'GET') };
}
const OPTIONS = { repo: 'acme/app', appId: '42', checks: ['verify'] };

test('github-gate#AC-4 without --apply the script changes nothing', async () => {
  const root = project();
  const gh = github();
  const r = await runSetup(root, { ...OPTIONS, request: gh.request });
  assert.equal(r.ok, true);
  assert.deepEqual(gh.writes(), []);
  assert.ok(!fs.existsSync(path.join(root, '.github')), 'no file written');
  assert.match(r.output, /allow auto-merge/);
  assert.match(r.output, /branch protection on main/);
  assert.match(r.output, /--apply/);
});

test('github-gate#AC-4 with --apply it writes the files and sends each change', async () => {
  const root = project();
  const gh = github();
  const r = await runSetup(root, { ...OPTIONS, apply: true, request: gh.request });
  assert.equal(r.ok, true);
  assert.deepEqual(gh.writes().map(c => `${c.method} ${c.url}`), [
    'PATCH /repos/acme/app',
    'PUT /repos/acme/app/branches/main/protection',
    'POST /repos/acme/app/actions/variables',
  ]);
  assert.equal(fs.readFileSync(path.join(root, '.github/workflows/rfr-open-pr.yml'), 'utf8'), fs.readFileSync(TEMPLATE, 'utf8'));
  assert.match(fs.readFileSync(path.join(root, '.github/CODEOWNERS'), 'utf8'), /^\/docs\/user\/ @lead$/m);
});

test('github-gate#AC-4 a change that fails is reported and the others still run', async () => {
  const root = project();
  const gh = github({ fail: { 'PATCH /repos/acme/app': 500 } });
  const r = await runSetup(root, { ...OPTIONS, apply: true, request: gh.request });
  assert.equal(r.ok, false);
  assert.match(r.output, /allow auto-merge: failed \(500\)/);
  assert.equal(gh.writes().length, 3, 'the later changes were still sent');
});

test('github-gate#AC-5 the script lists the manual steps and says whether the secret exists', async () => {
  assert.equal(MANUAL_STEPS.length, 3);
  const missing = await runSetup(project(), { ...OPTIONS, request: github().request });
  for (const step of MANUAL_STEPS) assert.ok(missing.output.includes(step));
  assert.match(missing.output, /Contents and Pull requests/);
  assert.match(missing.output, /RFR_APP_PRIVATE_KEY is not set/);
  const present = await runSetup(project(), { ...OPTIONS, request: github({ secret: true }).request });
  assert.match(present.output, /RFR_APP_PRIVATE_KEY is set/);
});

test('github-gate#AC-5 a plan limit on branch protection is named', async () => {
  const gh = github({ fail: { 'PUT /repos/acme/app/branches/main/protection': 403 } });
  const r = await runSetup(project(), { ...OPTIONS, apply: true, request: gh.request });
  assert.equal(r.ok, false);
  assert.match(r.output, /required reviews are not available/);
});

test('github-gate#AC-6 the setup skill runs the script and states the agent rule', () => {
  const skill = fs.readFileSync('plugins/process/skills/setup/SKILL.md', 'utf8');
  assert.match(skill, /process-github-setup\.mjs/);
  assert.match(skill, /--apply/);
  assert.match(skill, /rfr-open-pr\.yml/);
  assert.match(skill, /RFR_APP_PRIVATE_KEY/);
  assert.match(skill, /push(es)? (a|their|the) branch/);
  assert.match(skill, /do not open, approve, or merge/);
});
