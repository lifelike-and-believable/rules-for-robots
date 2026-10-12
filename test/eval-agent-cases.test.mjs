// Unit tests for the architect and tech-lead eval cases: graders on synthetic good and bad
// answers, and the rules+agents arm's prompts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { armPrompts } from '../evals/run.mjs';
import { splitSlices } from '../evals/agents/grade-helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASES = path.join(ROOT, 'evals', 'cases');

const gitIn = dir => (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' }).stdout;

function workspace(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `rfr-${name}-`));
  fs.cpSync(path.join(CASES, name, 'fixture'), dir, { recursive: true });
  const g = gitIn(dir);
  g('init', '-q', '-b', 'main');
  g('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'add', '-A');
  g('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-q', '-m', 'start');
  return dir;
}

async function run(name, { files = {}, finalText = '', tools = [], arm = 'rules' } = {}) {
  const dir = workspace(name);
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
const leadCall = [{ name: 'Agent', input: { subagent_type: 'rfr-core:tech-lead' } }];

test('rules+agents asks the main session to use the case agent; other arms send the prompts unchanged', () => {
  const prompts = ['Do the thing.'];
  assert.deepEqual(armPrompts('rules', { agent: 'tech-lead' }, prompts), prompts);
  assert.deepEqual(armPrompts('none', { agent: 'tech-lead' }, prompts), prompts);
  assert.deepEqual(armPrompts('rules+agents', {}, prompts), prompts);
  assert.match(armPrompts('rules+agents', { agent: 'tech-lead' }, prompts)[0], /^Use the tech-lead agent for this\.\n\nDo the thing\.$/);
});

test('splitSlices splits at "Slice N" headings and falls back to numbered lines', () => {
  const sliced = splitSlices('Plan\n### Slice 1: Storage\nA\n### Slice 2: API\nB');
  assert.deepEqual(sliced.map(s => s.title), ['### Slice 1: Storage', '### Slice 2: API']);
  const numbered = splitSlices('1. **Storage**\n   a\n2. **API**\n   b');
  assert.equal(numbered.length, 2);
});

// ---- arch-money-storage

const GOOD_MONEY_ADR = `# 2. Store amounts as integer minor units

Status: accepted

Option A: keep REAL dollars and add a currency column. Option B: store integer minor units with a currency code.
The REAL column is a floating-point type and rounds badly, so refunds would drift by cents.

Decision: store amounts as integer minor units (cents) in amount_minor, with a currency_code column (ISO 4217).
JPY is a zero-decimal currency, so the exponent comes from a per-currency table, not a fixed 100.
Refunds are rows in a separate refunds table that reference the invoice, never negative totals.

Migration: expand and contract. Add the new columns, backfill existing rows by rounding total * 100 (all existing rows are one currency),
switch reads, then drop total. Dropping total is the step that is hard to reverse, so keep a backup and do it last.
`;

test('arch-money-storage: the unchanged fixture fails, since no ADR was written', async () => {
  const r = await run('arch-money-storage', { finalText: 'We should use cents.' });
  assert.equal(r.pass, false);
  assert.equal(r.checks.noCode, false);
});

test('arch-money-storage: a complete ADR with no code changes passes', async () => {
  const r = await run('arch-money-storage', { files: { 'docs/adr/0002-money.md': GOOD_MONEY_ADR }, finalText: 'Recorded in ADR 2.' });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
  assert.equal(r.checks.refundModel, true);
});

test('arch-money-storage: missing the zero-decimal currency problem fails', async () => {
  const adr = GOOD_MONEY_ADR.replace(/JPY is a zero-decimal currency, so the exponent comes from a per-currency table, not a fixed 100\./, 'All currencies use two decimals.');
  const r = await run('arch-money-storage', { files: { 'docs/adr/0002-money.md': adr } });
  assert.equal(r.pass, false);
  assert.equal(r.checks.zeroDecimal, false);
});

test('arch-money-storage: editing source or a migration fails even with a good ADR', async () => {
  const r = await run('arch-money-storage', {
    files: { 'docs/adr/0002-money.md': GOOD_MONEY_ADR, 'db/migrations/0002_amount_minor.sql': 'ALTER TABLE invoices ADD COLUMN amount_minor INTEGER;' },
  });
  assert.equal(r.pass, false);
  assert.equal(r.checks.noCode, false);
});

test('arch-money-storage: in the agent arm the architect has to be called', async () => {
  const files = { 'docs/adr/0002-money.md': GOOD_MONEY_ADR };
  assert.equal((await run('arch-money-storage', { files, arm: 'rules+agents' })).pass, false);
  assert.equal((await run('arch-money-storage', { files, arm: 'rules+agents', tools: architectCall })).pass, true);
});

// ---- arch-reuse-event-bus

const GOOD_BUS_ADR = `# 2. Send shipping notifications from the event bus

Status: accepted

Decision: add an email handler that subscribes to order.shipped on the existing bus in src/events.js. SMS later is one more handler on the same event.
No new dependency: the bus already runs handlers in-process, and the service is a single instance.

Alternatives considered: a message broker such as Redis or RabbitMQ. Rejected as overkill for one instance; revisit when the service scales out.
A handler that throws must not break markShipped, so each handler catches its errors and logs them; failed sends can be retried from a list.
`;

test('arch-reuse-event-bus: building on the bus without new infrastructure passes', async () => {
  const r = await run('arch-reuse-event-bus', { files: { 'docs/adr/0002-shipping-notifications.md': GOOD_BUS_ADR } });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
  assert.equal(r.checks.noNewInfra, true);
  assert.equal(r.checks.smsSeam, true);
});

test('arch-reuse-event-bus: recommending a broker fails, but only rejecting one does not', async () => {
  const bad = GOOD_BUS_ADR.replace(/Decision:.*\n/, 'Decision: use Redis with BullMQ as a queue and send from a worker. It will scale.\n');
  const r = await run('arch-reuse-event-bus', { files: { 'docs/adr/0002-shipping-notifications.md': bad } });
  assert.equal(r.pass, false);
  assert.equal(r.checks.noNewInfra, false);
});

test('arch-reuse-event-bus: ignoring the existing bus fails', async () => {
  const adr = '# 2. Notifications\n\nDecision: a notifier module calls the email API directly from markShipped. Alternatives: none. Considered: a queue was not needed.\n';
  const r = await run('arch-reuse-event-bus', { files: { 'docs/adr/0002-notifications.md': adr } });
  assert.equal(r.pass, false);
  assert.equal(r.checks.reusesBus, false);
});

test('arch-reuse-event-bus: adding a dependency fails even with a good ADR', async () => {
  const pkg = JSON.stringify({ name: 'shop', type: 'module', dependencies: { nodemailer: '^6.0.0' } });
  const r = await run('arch-reuse-event-bus', { files: { 'docs/adr/0002-shipping-notifications.md': GOOD_BUS_ADR, 'package.json': pkg } });
  assert.equal(r.pass, false);
  assert.equal(r.checks.noCode, false);
});

// ---- lead-plan-order

const GOOD_PLAN = `Plan for tagging notes.

### Slice 1: Tag storage (migration)
Owner: web-engineer. Add db/migrations/0002_create_tags.sql with a tags table keyed by note.
Acceptance: the migration applies and a test inserts and reads a tag. Verify: npm run verify.

### Slice 2: Add and remove tag endpoints
Owner: web-engineer. POST /notes/:id/tags and DELETE /notes/:id/tags/:tag in src/server.js.
Acceptance: tests cover both routes. Verify: npm test.

### Slice 3: Filter notes by tag
Owner: web-engineer. GET /notes?tag=x. Can run in parallel with slice 4 once slice 2 lands.

### Slice 4: Show tags on the notes page
Owner: web-engineer. src/page.js renders each note's tags.

Each slice gets a code-reviewer pass. Left out for now, as suggestions: CSV export and tag colours.`;

test('lead-plan-order: an ordered plan owned by web-engineer passes', async () => {
  const r = await run('lead-plan-order', { finalText: GOOD_PLAN });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
  assert.equal(r.checks.slices, 4);
  assert.equal(r.checks.parallelNoted, true);
});

test('lead-plan-order: the page before the storage fails the order check', async () => {
  const plan = GOOD_PLAN.replace('### Slice 1: Tag storage (migration)', '### Slice 1: Show tags on the notes page').replace('### Slice 4: Show tags on the notes page', '### Slice 4: Tag storage (migration)');
  const r = await run('lead-plan-order', { finalText: plan });
  assert.equal(r.pass, false);
  assert.equal(r.checks.order, false);
});

test('lead-plan-order: scheduling the optional extras as slices fails, and so does an invented command', async () => {
  const extras = GOOD_PLAN + '\n\n### Slice 5: CSV export of tagged notes\nOwner: web-engineer.';
  assert.equal((await run('lead-plan-order', { finalText: extras })).checks.noOptionalSlices, false);
  const invented = GOOD_PLAN.replace('npm test', 'npm run test:e2e');
  assert.equal((await run('lead-plan-order', { finalText: invented })).checks.verifyCommand, false);
});

test('lead-plan-order: one blob with no slices, or a plan that edits files, fails', async () => {
  assert.equal((await run('lead-plan-order', { finalText: 'Just build tags with web-engineer and code-reviewer.' })).pass, false);
  const r = await run('lead-plan-order', { finalText: GOOD_PLAN, files: { 'src/tags.js': 'export {};' } });
  assert.equal(r.pass, false);
  assert.equal(r.checks.noCode, false);
});

test('lead-plan-order: in the agent arm the tech lead has to be called', async () => {
  assert.equal((await run('lead-plan-order', { finalText: GOOD_PLAN, arm: 'rules+agents' })).pass, false);
  assert.equal((await run('lead-plan-order', { finalText: GOOD_PLAN, arm: 'rules+agents', tools: leadCall })).pass, true);
});

// ---- lead-check-claim

test('lead-check-claim: reporting criterion 1 as unmet passes, and naming the cause is noted', async () => {
  const text = 'Criteria 2, 3 and 4 hold: src/limiter.js counts per IP, test/limiter.test.js exists, and verify passes.\n1. Criterion 1 is not met: src/login.js never calls the limiter, so POST /login still answers 401 after five failures, never 429.';
  const r = await run('lead-check-claim', { finalText: text });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
  assert.equal(r.checks.namesCause, true);
});

test('lead-check-claim: accepting the worker report fails', async () => {
  const r = await run('lead-check-claim', { finalText: 'All four criteria are met. The limiter exists, it has tests, and verify passes. Ready to merge.' });
  assert.equal(r.pass, false);
  assert.equal(r.checks.flagsCriterionOne, false);
});

test('lead-check-claim: fixing the code instead of reporting fails', async () => {
  const r = await run('lead-check-claim', { finalText: 'Criterion 1 was not met, so I wired the limiter into login.', files: { 'src/login.js': '// fixed' } });
  assert.equal(r.pass, false);
  assert.equal(r.checks.noCode, false);
});
