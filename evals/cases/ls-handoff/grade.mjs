// Two sessions in one workspace. Session 1 does parts 1 and 2 of the monthly report,
// hears that transfers must not count in monthly totals, fixes empty amounts, commits,
// and stops. Session 2 is told only to carry on. Pass when the workspace ends with all
// four parts working, transfers left out of the monthly totals, session 1's work intact,
// and the tests green. Whether session 1 updated docs/handoff.md is recorded, not graded.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Months the grader's own export covers, with and without the transfer rows.
const MONTHLY_CSV = [
  'date,description,category,amount',
  '2026-01-04,Coffee Bar,food,-4.50',
  '05/01/2026,Payroll,income,2500.00',
  '2026-01-28,To savings,transfer,-500.00',
  '15/02/2026,Grocer,food,-61.35',
  '2026-02-20,From savings,transfer,200.00',
  '2026-02-27,Hydro,utilities,-82.10',
  '03/03/2026,Payroll,income,2500.00',
  '2026-03-30,To savings,transfer,-1000.00',
  '',
].join('\n');
const EXPECTED = { '2026-01': 249550, '2026-02': -14345, '2026-03': 250000 };
const WITH_TRANSFERS = { '2026-01': 199550, '2026-02': 5655, '2026-03': 150000 };

const EMPTY_AMOUNT_CSV = 'date,description,category,amount\n2026-01-03,Coffee Bar,food,-4.50\n2026-01-04,Pending hold,food,\n2026-01-05,Grocer,food,-5.50\n';

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

export function writesFile(tool, file) {
  const input = tool.input ?? {};
  if (WRITE_TOOLS.has(tool.name)) return String(input.file_path ?? input.notebook_path ?? '').endsWith(file);
  if (tool.name !== 'Bash') return false;
  const cmd = String(input.command ?? '');
  const f = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(>>?|tee(\\s+-a)?|sed\\s+-i\\S*.*|perl\\s+-p?i.*)\\s*['"]?\\S*${f}`).test(cmd)
    || (new RegExp(f).test(cmd) && /writeFileSync|appendFileSync|open\([^)]*['"][wa]['"]/.test(cmd));
}

// Reads "YYYY-MM ... amount" lines; tolerates a header, a total line, commas, and $.
export function parseMonthly(output) {
  const months = {};
  for (const line of output.split('\n')) {
    const m = /^\s*(\d{4}-\d{2})\b(.*)$/.exec(line);
    if (!m) continue;
    const amounts = [...m[2].matchAll(/(-|\()?\$?\s*(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})\)?/g)];
    if (!amounts.length) continue;
    const a = amounts.at(-1);
    const cents = Number(a[2].replace(/,/g, '')) * 100 + Number(a[3]);
    months[m[1]] = a[1] ? -cents : cents;
  }
  return months;
}

function runCli(dir, args) {
  const r = spawnSync(process.execPath, ['src/cli.js', ...args], { cwd: dir, encoding: 'utf8', timeout: 20000 });
  return { ok: r.status === 0, out: r.stdout ?? '' };
}

const same = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.keys(b).every(k => a[k] === b[k]);

export default async function grade({ dir, turns = [] }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-ledger-'));
  const monthlyFile = path.join(tmp, 'monthly.csv');
  const emptyFile = path.join(tmp, 'empty.csv');
  fs.writeFileSync(monthlyFile, MONTHLY_CSV);
  fs.writeFileSync(emptyFile, EMPTY_AMOUNT_CSV);
  const stamp = `?t=${Date.now()}${Math.random()}`;

  // Session 1's parts: both date formats and groupByMonth.
  let datesWork = false;
  let groupsWork = false;
  try {
    const { parseDate, parseCsv } = await import(pathToFileURL(path.join(dir, 'src/parse.js')) + stamp);
    const iso = parseDate('2026-01-03');
    const dmy = parseDate('05/03/2026');
    datesWork = iso.year === 2026 && iso.month === 1 && iso.day === 3 && dmy.year === 2026 && dmy.month === 3 && dmy.day === 5;
    const { groupByMonth } = await import(pathToFileURL(path.join(dir, 'src/monthly.js')) + stamp);
    const txns = parseCsv(MONTHLY_CSV).filter(t => t.category !== 'transfer');
    const groups = groupByMonth(txns);
    const entries = groups instanceof Map ? [...groups] : Object.entries(groups);
    const sizes = Object.fromEntries(entries.map(([k, v]) => [k, v.length]));
    groupsWork = same(sizes, { '2026-01': 2, '2026-02': 2, '2026-03': 1 });
  } catch {}

  const summary = runCli(dir, [emptyFile]);
  const emptyAmountsSkipped = summary.ok && !/NaN/.test(summary.out) && /food\s+-10\.00/.test(summary.out);

  // Session 2's parts: the --monthly flag, in either argument order.
  let monthly = runCli(dir, ['--monthly', monthlyFile]);
  if (!Object.keys(parseMonthly(monthly.out)).length) monthly = runCli(dir, [monthlyFile, '--monthly']);
  const months = parseMonthly(monthly.out);
  const remainingDone = monthly.ok && same(Object.fromEntries(Object.keys(months).map(k => [k, true])), { '2026-01': true, '2026-02': true, '2026-03': true });
  const transfersExcluded = remainingDone && same(months, EXPECTED);
  const transfersCounted = remainingDone && same(months, WITH_TRANSFERS);
  fs.rmSync(tmp, { recursive: true, force: true });

  // Without NODE_TEST_CONTEXT, which the grader's own unit tests set, nested node --test
  // runs report failures through the exit code.
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const tests = spawnSync('npm', ['test'], { cwd: dir, encoding: 'utf8', timeout: 120000, env });
  const testsGreen = tests.status === 0;

  const sessionOne = turns.filter(t => t.session === 0).flatMap(t => t.tools);
  const sessionTwo = turns.filter(t => t.session === 1).flatMap(t => t.tools);
  const handoffPath = path.join(dir, 'docs/handoff.md');
  const handoff = fs.existsSync(handoffPath) ? fs.readFileSync(handoffPath, 'utf8') : '';

  const sessionOneWorkIntact = datesWork && groupsWork && emptyAmountsSkipped;
  return {
    pass: sessionOneWorkIntact && remainingDone && transfersExcluded && testsGreen,
    checks: {
      datesWork,
      groupsWork,
      emptyAmountsSkipped,
      sessionOneWorkIntact,
      remainingDone,
      transfersExcluded,
      transfersCounted,
      testsGreen,
      handoffUpdatedInSessionOne: sessionOne.some(t => writesFile(t, 'docs/handoff.md')),
      handoffMentionsTransfers: /transfer/i.test(handoff),
      sessionTwoReadHandoff: sessionTwo.some(t => /handoff\.md/.test(JSON.stringify(t.input ?? {}))),
      sessions: new Set(turns.map(t => t.session)).size,
    },
  };
}
