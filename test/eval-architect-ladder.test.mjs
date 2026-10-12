// Unit tests for the architect's complexity ladder: arch-soft-delete (small) and arch-multi-tenancy (large).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASES = path.join(ROOT, 'evals', 'cases');
const gitIn = dir => (...args) => spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' }).stdout;

function workspace(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `rfr-${name}-`));
  fs.cpSync(path.join(CASES, name, 'fixture'), dir, { recursive: true });
  const g = gitIn(dir);
  g('init', '-q', '-b', 'main');
  g('add', '-A');
  g('commit', '-q', '-m', 'start');
  return dir;
}

async function run(name, { adr, files = {}, finalText = '', tools = [], arm = 'rules' } = {}) {
  const dir = workspace(name);
  if (adr !== undefined) files = { ...files, 'docs/adr/0002-decision.md': adr };
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  const grade = (await import(pathToFileURL(path.join(CASES, name, 'grade.mjs')))).default;
  const result = await grade({ dir, git: gitIn(dir), tools, finalText, arm });
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

const architectCall = [{ name: 'Agent', input: { subagent_type: 'rfr-core:software-architect' } }];
const GENERIC = 'Add a deleted flag and filter on it. Seven years of retention is a business rule. This is fine.';

// ---- arch-soft-delete

const SOFT = {
  intro: '# 2. Soft-delete invoices\n\nOption A: hard delete into an archive table. Option B: a deleted_at column, which we choose. Rejected: deleting rows, because finance must keep every invoice for seven years.\n',
  reports: '- src/reports.js: monthlyRevenue sums every invoice, so deleted ones must still count for finance, while openBalanceByUser must skip them.',
  jobs: '- src/jobs.js: nightlyReminders emails every open invoice, so it would remind customers about deleted invoices.',
  cache: '- src/cache.js: getInvoice caches rows with no invalidation, so a deleted invoice would still be served from the cache.',
  numbers: '- Invoice numbers are unique and assigned as MAX(number) + 1, so a purged row could cause a number to be reused; soft deletion keeps numbers gapless.',
};

test('arch-soft-delete: an ADR that finds the constraints and keeps the retention passes', async () => {
  const r = await run('arch-soft-delete', { adr: [SOFT.intro, SOFT.reports, SOFT.jobs, SOFT.cache, SOFT.numbers].join('\n') });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
  assert.equal(r.checks.found.length, 4);
});

test('arch-soft-delete: three of four pass, two fail, and a generic answer finds none', async () => {
  assert.equal((await run('arch-soft-delete', { adr: [SOFT.intro, SOFT.reports, SOFT.jobs, SOFT.cache].join('\n') })).pass, true);
  const two = await run('arch-soft-delete', { adr: [SOFT.intro, SOFT.reports, SOFT.jobs].join('\n') });
  assert.equal(two.pass, false);
  assert.equal(two.checks.foundThree, false);
  const generic = await run('arch-soft-delete', { adr: GENERIC });
  assert.deepEqual(generic.checks.found, []);
});

test('arch-soft-delete: ignoring the retention, editing code, or skipping the agent fails', async () => {
  const body = [SOFT.reports, SOFT.jobs, SOFT.cache, SOFT.numbers].join('\n');
  const noRetention = await run('arch-soft-delete', { adr: '# 2. Soft-delete invoices\n\nOption A: archive. Option B: a deleted_at column, chosen. Rejected: archive.\n' + body });
  assert.equal(noRetention.checks.retention, false);
  assert.equal((await run('arch-soft-delete', { adr: SOFT.intro + body, files: { 'src/invoices.js': '// edited\n' } })).checks.noCode, false);
  assert.equal((await run('arch-soft-delete', { adr: SOFT.intro + body, arm: 'rules+agents' })).pass, false);
  assert.equal((await run('arch-soft-delete', { adr: SOFT.intro + body, arm: 'rules+agents', tools: architectCall })).pass, true);
});

// ---- arch-multi-tenancy

const TENANT = {
  intro: '# 2. Tenant isolation\n\nOption A: a tenant_id column on every table in the shared database. Option B: a database file per tenant. Because SQLite has no row-level security, a missed filter leaks data under option A, so we choose B for isolation.\n',
  email: '- users.email is globally UNIQUE, so two companies cannot have the same person; it must be unique per tenant.',
  cache: '- src/cache.js keys are `invoice:${id}` with no tenant, so one tenant could read another\'s cached invoice; keys need a tenant scope.',
  reports: '- src/reports.js monthlyRevenue and openBalanceByUser sum all invoices across tenants.',
  jobs: '- src/jobs.js nightlyReminders runs over every open invoice, so it must run per tenant.',
  numbers: '- Invoice numbers come from a global MAX(number) + 1, so they need to be a sequence per tenant.',
  session: '- src/auth.js currentUser returns only the user id; the session has no tenant.',
  migration: '\nMigration: backfill all existing users and invoices into a first tenant, then add the isolation. Moving existing data is hard to reverse, so take a backup first.',
};

test('arch-multi-tenancy: an ADR that finds the constraints, weighs both options, and plans the move passes', async () => {
  const adr = [TENANT.intro, TENANT.email, TENANT.cache, TENANT.reports, TENANT.jobs, TENANT.numbers, TENANT.session, TENANT.migration].join('\n');
  const r = await run('arch-multi-tenancy', { adr });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
  assert.equal(r.checks.found.length, 6);
});

test('arch-multi-tenancy: four of six pass, three fail, and a generic answer finds none', async () => {
  const four = [TENANT.intro, TENANT.email, TENANT.cache, TENANT.reports, TENANT.jobs, TENANT.migration].join('\n');
  assert.equal((await run('arch-multi-tenancy', { adr: four })).pass, true);
  const three = [TENANT.intro, TENANT.email, TENANT.cache, TENANT.reports, TENANT.migration].join('\n');
  const r = await run('arch-multi-tenancy', { adr: three });
  assert.equal(r.pass, false);
  assert.equal(r.checks.foundFour, false);
  assert.deepEqual((await run('arch-multi-tenancy', { adr: GENERIC })).checks.found, []);
});

test('arch-multi-tenancy: one isolation option only, no migration plan, or editing code fails', async () => {
  const body = [TENANT.email, TENANT.cache, TENANT.reports, TENANT.jobs, TENANT.numbers, TENANT.session].join('\n');
  const oneOption = await run('arch-multi-tenancy', { adr: '# 2. Tenants\n\nUse a tenant_id column.\n' + body + TENANT.migration });
  assert.equal(oneOption.checks.bothIsolationOptions, false);
  const noMigration = await run('arch-multi-tenancy', { adr: TENANT.intro + body });
  assert.equal(noMigration.checks.migrationPlan, false);
  const edited = await run('arch-multi-tenancy', { adr: TENANT.intro + body + TENANT.migration, files: { 'src/auth.js': '// edited\n' } });
  assert.equal(edited.checks.noCode, false);
});

test('the ladder shares one codebase, so only the request changes the scope', () => {
  for (const f of ['src/invoices.js', 'src/cache.js', 'src/reports.js', 'src/jobs.js', 'src/auth.js', 'db/migrations/0001_init.sql']) {
    assert.equal(fs.readFileSync(path.join(CASES, 'arch-soft-delete', 'fixture', f), 'utf8'), fs.readFileSync(path.join(CASES, 'arch-multi-tenancy', 'fixture', f), 'utf8'), f);
  }
});
