import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import grade, { parseMonthly, writesFile } from '../evals/cases/ls-handoff/grade.mjs';
import { loadCase, splitSessions } from '../evals/run.mjs';

const CASE = 'evals/cases/ls-handoff';

function workspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-ls-handoff-'));
  fs.cpSync(`${CASE}/fixture`, dir, { recursive: true });
  const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' }).stdout;
  g('init', '-q'); g('add', '-A'); g('-c', 'user.email=e@x', '-c', 'user.name=e', 'commit', '-qm', 'init');
  return dir;
}

const write = (dir, file, text) => fs.writeFileSync(path.join(dir, file), text);
const edit = (dir, file, from, to) => {
  const p = path.join(dir, file);
  const src = fs.readFileSync(p, 'utf8');
  assert.ok(src.includes(from), `${file} contains ${from}`);
  fs.writeFileSync(p, src.replace(from, to));
};

// Session 1: DD/MM/YYYY dates, groupByMonth, empty amounts skipped.
function sessionOne(dir, { mapGroups = false } = {}) {
  edit(dir, 'src/parse.js', "  const m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(text.trim());\n  if (!m) throw",
    "  const dmy = /^(\\d{2})\\/(\\d{2})\\/(\\d{4})$/.exec(text.trim());\n  if (dmy) return { year: Number(dmy[3]), month: Number(dmy[2]), day: Number(dmy[1]) };\n  const m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(text.trim());\n  if (!m) throw");
  edit(dir, 'src/parse.js', '  return rows.map(line => {', '  return rows.filter(line => splitLine(line)[names.indexOf(\'amount\')]?.trim()).map(line => {');
  write(dir, 'src/monthly.js', mapGroups
    ? `export function groupByMonth(txns) {
  const groups = new Map();
  for (const t of txns) {
    const key = \`\${t.date.year}-\${String(t.date.month).padStart(2, '0')}\`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  return groups;
}
`
    : `export function groupByMonth(txns) {
  const groups = {};
  for (const t of txns) {
    const key = \`\${t.date.year}-\${String(t.date.month).padStart(2, '0')}\`;
    (groups[key] ??= []).push(t);
  }
  return groups;
}
`);
  write(dir, 'test/monthly.test.js', `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByMonth } from '../src/monthly.js';
import { parseDate } from '../src/parse.js';
test('groups by month', () => {
  const t = d => ({ date: parseDate(d), category: 'food', amountCents: -1 });
  const groups = groupByMonth([t('2026-01-02'), t('03/02/2026'), t('2026-02-09')]);
  const sizes = Object.fromEntries([...(groups instanceof Map ? groups : Object.entries(groups))].map(([k, v]) => [k, v.length]));
  assert.deepEqual(sizes, { '2026-01': 1, '2026-02': 2 });
});
`);
}

// Session 2: totals, formatter, and the --monthly flag.
function sessionTwo(dir, { countTransfers = false, header = '', mapGroups = false } = {}) {
  fs.appendFileSync(path.join(dir, 'src/monthly.js'), `
import { formatCents } from './summary.js';
export function monthlyTotals(groups) {
  const totals = {};
  for (const [key, txns] of ${mapGroups ? 'groups' : 'Object.entries(groups)'}) {
    totals[key] = txns.filter(t => ${countTransfers ? 'true' : "t.category !== 'transfer'"}).reduce((s, t) => s + t.amountCents, 0);
  }
  return totals;
}
export function formatMonthly(totals) {
  return ${JSON.stringify(header)} + Object.keys(totals).sort().map(k => k + '   ' + formatCents(totals[k])).join('\\n');
}
`);
  write(dir, 'src/cli.js', `#!/usr/bin/env node
import fs from 'node:fs';
import { parseCsv } from './parse.js';
import { summarize, formatSummary } from './summary.js';
import { groupByMonth, monthlyTotals, formatMonthly } from './monthly.js';

const args = process.argv.slice(2);
const monthly = args.includes('--monthly');
const file = args.find(a => !a.startsWith('--'));
if (!file) {
  console.error('usage: ledger [--monthly] <export.csv>');
  process.exit(2);
}
const txns = parseCsv(fs.readFileSync(file, 'utf8'));
console.log(monthly ? formatMonthly(monthlyTotals(groupByMonth(txns))) : formatSummary(summarize(txns)));
`);
}

const turnsWith = (sessionOneTools = []) => [
  { text: 'Parts 1 and 2 done.', tools: [], session: 0 },
  { text: 'Skipping empty amounts.', tools: [], session: 0 },
  { text: 'Committed.', tools: [], session: 0 },
  { text: 'Stopping.', tools: sessionOneTools, session: 0 },
  { text: 'Parts 3 and 4 done.', tools: [{ name: 'Read', input: { file_path: 'docs/handoff.md' } }], session: 1 },
];

test('ls-handoff: the case has five prompts in two sessions', () => {
  const testCase = loadCase(CASE);
  assert.equal(testCase.prompts.length, 5);
  assert.deepEqual(splitSessions(testCase.prompts, testCase.meta.newSessionAt), [[0, 1, 2, 3], [4]]);
  assert.deepEqual(testCase.meta.candidates, ['WA-012-handoff']);
  assert.ok(fs.existsSync(`evals/candidates/${testCase.meta.candidates[0]}.md`));
});

test('ls-handoff: the fixture tests pass and the untouched fixture fails the grader', async () => {
  const dir = workspace();
  try {
    assert.equal(spawnSync('npm', ['test'], { cwd: dir }).status, 0);
    const result = await grade({ dir, turns: [] });
    assert.equal(result.pass, false);
    assert.equal(result.checks.datesWork, false);
    assert.equal(result.checks.remainingDone, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-handoff: a good two-session run passes and records the handoff update', async () => {
  const dir = workspace();
  try {
    sessionOne(dir);
    sessionTwo(dir);
    fs.appendFileSync(path.join(dir, 'docs/handoff.md'), '\n- Monthly totals leave out category `transfer`.\n');
    const result = await grade({ dir, turns: turnsWith([{ name: 'Edit', input: { file_path: `${dir}/docs/handoff.md`, old_string: 'a', new_string: 'b' } }]) });
    assert.equal(result.pass, true, JSON.stringify(result.checks));
    assert.equal(result.checks.handoffUpdatedInSessionOne, true);
    assert.equal(result.checks.handoffMentionsTransfers, true);
    assert.equal(result.checks.sessionTwoReadHandoff, true);
    assert.equal(result.checks.transfersCounted, false);
    assert.equal(result.checks.sessions, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-handoff: session 2 counting transfers (the lost decision) fails', async () => {
  const dir = workspace();
  try {
    sessionOne(dir);
    sessionTwo(dir, { countTransfers: true });
    const result = await grade({ dir, turns: turnsWith() });
    assert.equal(result.pass, false);
    assert.equal(result.checks.remainingDone, true);
    assert.equal(result.checks.transfersExcluded, false);
    assert.equal(result.checks.transfersCounted, true);
    assert.equal(result.checks.handoffUpdatedInSessionOne, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-handoff: session 2 that builds nothing fails, though session 1 work holds', async () => {
  const dir = workspace();
  try {
    sessionOne(dir);
    const result = await grade({ dir, turns: turnsWith() });
    assert.equal(result.pass, false);
    assert.equal(result.checks.sessionOneWorkIntact, true, JSON.stringify(result.checks));
    assert.equal(result.checks.remainingDone, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-handoff: breaking a done part (DD/MM dates) fails even with parts 3 and 4 working', async () => {
  const dir = workspace();
  try {
    sessionOne(dir);
    sessionTwo(dir);
    // Session 2 "redoes" parseDate and reads DD/MM/YYYY as MM/DD/YYYY.
    edit(dir, 'src/parse.js', 'month: Number(dmy[2]), day: Number(dmy[1])', 'month: Number(dmy[1]), day: Number(dmy[2])');
    const result = await grade({ dir, turns: turnsWith() });
    assert.equal(result.pass, false);
    assert.equal(result.checks.datesWork, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-handoff: a Map from groupByMonth, a header line, and the file-first argument order still pass', async () => {
  const dir = workspace();
  try {
    sessionOne(dir, { mapGroups: true });
    sessionTwo(dir, { mapGroups: true, header: 'Month     Total\n' });
    edit(dir, 'src/cli.js', "const monthly = args.includes('--monthly');", "const monthly = args[1] === '--monthly';");
    const result = await grade({ dir, turns: turnsWith() });
    assert.equal(result.pass, true, JSON.stringify(result.checks));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-handoff: monthly lines are read with commas, dollar signs, parentheses, and totals', () => {
  assert.deepEqual(parseMonthly('Month   Total\n2026-01   2495.50\n2026-02   -143.45\nTotal   2352.05\n'), { '2026-01': 249550, '2026-02': -14345 });
  assert.deepEqual(parseMonthly('2026-01: $2,495.50\n2026-02: -$143.45\n2026-03: $-1,000.00'), { '2026-01': 249550, '2026-02': -14345, '2026-03': -100000 });
  assert.deepEqual(parseMonthly('2026-02  (143.45)\n  2026-03 | 3 txns | 2500.00'), { '2026-02': -14345, '2026-03': 250000 });
});

test('ls-handoff: handoff writes are told apart from reads', () => {
  const bash = command => ({ name: 'Bash', input: { command } });
  assert.equal(writesFile({ name: 'Write', input: { file_path: '/w/docs/handoff.md' } }, 'docs/handoff.md'), true);
  assert.equal(writesFile({ name: 'Edit', input: { file_path: 'docs/handoff.md' } }, 'docs/handoff.md'), true);
  assert.equal(writesFile(bash("cat >> docs/handoff.md <<'EOF'\n- open: part 3\nEOF"), 'docs/handoff.md'), true);
  assert.equal(writesFile(bash("sed -i 's/None./Parts 3 and 4./' docs/handoff.md"), 'docs/handoff.md'), true);
  assert.equal(writesFile(bash('cat docs/handoff.md'), 'docs/handoff.md'), false);
  assert.equal(writesFile(bash('grep -n Open docs/handoff.md'), 'docs/handoff.md'), false);
  assert.equal(writesFile({ name: 'Read', input: { file_path: 'docs/handoff.md' } }, 'docs/handoff.md'), false);
});

test('ls-handoff: a good run with a red test suite fails', async () => {
  const dir = workspace();
  try {
    sessionOne(dir);
    sessionTwo(dir);
    write(dir, 'test/broken.test.js', "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\ntest('red', () => assert.equal(1, 2));\n");
    const result = await grade({ dir, turns: turnsWith() });
    assert.equal(result.pass, false);
    assert.equal(result.checks.testsGreen, false);
    assert.equal(result.checks.transfersExcluded, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
