#!/usr/bin/env node
// GitHub gate setup (docs/specs/github-gate.md). Sets a repository up so that approval and merging
// happen at GitHub: the workflow that opens an agent's pull request as a GitHub App, a CODEOWNERS
// block for the gated stage folders, "Allow auto-merge", and branch protection that requires the
// checks and a code owner's review. It reads the repository's current settings first and keeps what
// it does not need to change. Without --apply it only prints the plan.
// Usage: node checks/process-github-setup.mjs [project root] [--repo owner/name] [--app-id <id>]
//        [--checks a,b] [--apply]
// The token comes from GH_TOKEN or GITHUB_TOKEN, or from `gh auth token`.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { STAGES, approversFor, gateOf, gatedStages, readConfig, readWorkMode } from './lib/process.mjs';
import { BEGIN, END, applyBlock } from './process-codeowners.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(HERE, '..', 'plugins', 'process', 'templates', 'workflows', 'rfr-open-pr.yml');
const WORKFLOW = '.github/workflows/rfr-open-pr.yml';
const CODEOWNERS = '.github/CODEOWNERS';
const VARIABLE = 'RFR_APP_ID';
const SECRET = 'RFR_APP_PRIVATE_KEY';

export const MANUAL_STEPS = [
  'Create a GitHub App owned by the account or organisation, with the repository permissions Contents and Pull requests set to "Read and write", and no webhook.',
  `Install the App on this repository, and give its App ID to this script with --app-id (stored as the Actions variable ${VARIABLE}).`,
  `Generate a private key for the App and store the whole .pem file as the Actions secret ${SECRET}.`,
];

const owner = a => (a.startsWith('@') ? a : `@${a}`);

// The CODEOWNERS block for every stage a person approves, in any mode: the App is the pull
// request's author, so the approver can review it in a solo project too.
export function gateCodeowners(config, workMode = 'supervised') {
  const gated = new Set(gatedStages(config));
  const lines = [BEGIN];
  for (const stage of STAGES) {
    if (!gated.has(stage.name) || gateOf(stage.name, config, workMode) !== 'approve') continue;
    const approvers = approversFor(stage.name, config);
    if (!approvers?.length) continue;
    lines.push(`${stage.file ? `/${stage.file}` : `/${stage.dir}/`} ${approvers.map(owner).join(' ')}`);
  }
  lines.push(END, '');
  return lines.join('\n');
}

const enabled = v => Boolean(v && typeof v === 'object' ? v.enabled : v);

// The body for PUT .../protection: the current protection in the shape that request takes, with
// the gate's settings on top.
function protectionBody(current, checks) {
  const reviews = current?.required_pull_request_reviews ?? {};
  const status = current?.required_status_checks ?? {};
  const restrictions = current?.restrictions
    ? { users: (current.restrictions.users ?? []).map(u => u.login), teams: (current.restrictions.teams ?? []).map(t => t.slug), apps: (current.restrictions.apps ?? []).map(a => a.slug) }
    : null;
  const body = {
    required_status_checks: { strict: Boolean(status.strict), contexts: [...new Set([...(status.contexts ?? []), ...checks])] },
    enforce_admins: true,
    required_pull_request_reviews: {
      ...(reviews.dismiss_stale_reviews !== undefined ? { dismiss_stale_reviews: reviews.dismiss_stale_reviews } : {}),
      require_code_owner_reviews: true,
      required_approving_review_count: reviews.required_approving_review_count ?? 0,
      require_last_push_approval: false,
    },
    restrictions,
  };
  for (const key of ['required_linear_history', 'allow_force_pushes', 'allow_deletions', 'required_conversation_resolution']) {
    if (current?.[key] !== undefined) body[key] = enabled(current[key]);
  }
  return body;
}

function protectionIsSet(current, checks) {
  if (!current) return false;
  const reviews = current.required_pull_request_reviews;
  const contexts = current.required_status_checks?.contexts ?? [];
  return Boolean(reviews?.require_code_owner_reviews) && !reviews.require_last_push_approval
    && enabled(current.enforce_admins) && checks.every(c => contexts.includes(c));
}

// The settings to change, each { name, method, url, body }. One already as wanted is left out.
export function planSetup({ repo, protection, variable, appId, checks = [], fullName = '{repo}' }) {
  const base = `/repos/${fullName}`;
  const branch = repo.default_branch;
  const plan = [];
  if (!repo.allow_auto_merge) plan.push({ name: 'allow auto-merge', method: 'PATCH', url: base, body: { allow_auto_merge: true } });
  if (!protectionIsSet(protection, checks)) {
    plan.push({ name: `branch protection on ${branch}`, method: 'PUT', url: `${base}/branches/${branch}/protection`, body: protectionBody(protection, checks) });
  }
  if (appId && variable?.value !== String(appId)) {
    plan.push(variable
      ? { name: `variable ${VARIABLE}`, method: 'PATCH', url: `${base}/actions/variables/${VARIABLE}`, body: { name: VARIABLE, value: String(appId) } }
      : { name: `variable ${VARIABLE}`, method: 'POST', url: `${base}/actions/variables`, body: { name: VARIABLE, value: String(appId) } });
  }
  return plan;
}

const ok = status => status >= 200 && status < 300;

export async function runSetup(root, { repo: fullName, appId = null, checks = [], apply = false, request }) {
  const out = [];
  const loaded = readConfig(root);
  if (!loaded) return { ok: false, output: 'no docs/product/process.yml: set up the process first (/rfr-process:setup)' };
  if (loaded.errors.length) return { ok: false, output: loaded.errors.join('\n') };
  if (!fullName) return { ok: false, output: 'no repository: pass --repo owner/name, or add an origin remote on github.com' };

  const base = `/repos/${fullName}`;
  const repo = await request('GET', base);
  if (!ok(repo.status)) return { ok: false, output: `cannot read ${fullName} (${repo.status}): check the name and the token's access` };
  const branch = repo.data.default_branch;
  const protection = await request('GET', `${base}/branches/${branch}/protection`);
  const variable = await request('GET', `${base}/actions/variables/${VARIABLE}`);
  const secret = await request('GET', `${base}/actions/secrets/${SECRET}`);

  const plan = planSetup({
    repo: repo.data, protection: ok(protection.status) ? protection.data : null,
    variable: ok(variable.status) ? variable.data : null, appId, checks, fullName,
  });

  // Files: the workflow and the CODEOWNERS block.
  const block = gateCodeowners(loaded.config, readWorkMode(root));
  const ownersFile = path.join(root, CODEOWNERS);
  const ownersNow = fs.existsSync(ownersFile) ? fs.readFileSync(ownersFile, 'utf8') : '';
  const ownersNext = applyBlock(ownersNow, block);
  const workflowFile = path.join(root, WORKFLOW);
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const files = [];
  if (!fs.existsSync(workflowFile) || fs.readFileSync(workflowFile, 'utf8') !== template) files.push({ name: WORKFLOW, file: workflowFile, text: template });
  if (ownersNext !== ownersNow) files.push({ name: `${CODEOWNERS} (the rfr-process block)`, file: ownersFile, text: ownersNext });

  let failed = false;
  out.push(`GitHub gate for ${fullName} (default branch ${branch})`, '');
  if (!files.length && !plan.length) out.push('Files and settings are already as the gate needs them.');
  if (!apply) {
    if (files.length || plan.length) out.push('Would change:');
    for (const f of files) out.push(`  - write ${f.name}`);
    for (const c of plan) out.push(`  - ${c.name}`);
    if (files.length || plan.length) out.push('', 'Nothing has been changed. Run again with --apply to make these changes.');
  } else {
    for (const f of files) {
      fs.mkdirSync(path.dirname(f.file), { recursive: true });
      fs.writeFileSync(f.file, f.text);
      out.push(`  - ${f.name}: written (commit it through a pull request)`);
    }
    for (const c of plan) {
      const r = await request(c.method, c.url, c.body);
      if (ok(r.status)) { out.push(`  - ${c.name}: done`); continue; }
      failed = true;
      const limit = r.status === 403 && c.method === 'PUT';
      out.push(`  - ${c.name}: failed (${r.status})${limit ? ': required reviews are not available for this repository on its GitHub plan (a private repository on the free plan), so the gate cannot hold a pull request for review here' : r.data?.message ? `: ${r.data.message}` : ''}`);
    }
  }

  out.push('', 'Only a person can do these:');
  MANUAL_STEPS.forEach((step, i) => out.push(`  ${i + 1}. ${step}`));
  out.push('', ok(secret.status) ? `The secret ${SECRET} is set.` : `The secret ${SECRET} is not set yet (step 3).`);
  if (!appId && !ok(variable.status)) out.push(`The variable ${VARIABLE} is not set: pass --app-id once the App exists.`);
  return { ok: !failed, output: out.join('\n') };
}

function token() {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const r = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
}

function githubRequest(auth, api = process.env.GITHUB_API_URL || 'https://api.github.com') {
  return async (method, url, body) => {
    const response = await fetch(`${api}${url}`, {
      method,
      headers: { authorization: `Bearer ${auth}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await response.json(); } catch { /* no body */ }
    return { status: response.status, data };
  };
}

function originRepo(root) {
  const r = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' });
  return /github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\s*$/.exec(r.stdout ?? '')?.[1] ?? null;
}

async function main(argv) {
  const value = flag => { const i = argv.indexOf(flag); return i === -1 ? null : argv[i + 1]; };
  const flags = new Set(['--repo', '--app-id', '--checks']);
  const root = path.resolve(argv.find((a, i) => !a.startsWith('--') && !flags.has(argv[i - 1])) ?? '.');
  const auth = token();
  if (!auth) { console.error('no GitHub token: set GH_TOKEN, or sign in with `gh auth login`'); process.exit(1); }
  const r = await runSetup(root, {
    repo: value('--repo') ?? originRepo(root), appId: value('--app-id'),
    checks: (value('--checks') ?? '').split(',').map(s => s.trim()).filter(Boolean),
    apply: argv.includes('--apply'), request: githubRequest(auth),
  });
  (r.ok ? console.log : console.error)(r.output);
  if (!r.ok) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exit(1); });
