// Pass when the tests for src/money.js were written before its logic, and the last red test run
// before the first green one failed on assertions (the right reason), not because the module or an
// export was missing; and the final module behaves as specified.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TEST_RUN = /(npm (run )?test|node --test|npm run verify)/;
// node --test prints these when a test file cannot load what it imports, or a stub is missing.
const LOAD_ERROR = /ERR_MODULE_NOT_FOUND|Cannot find module|does not provide an export named|is not a function|is not defined|SyntaxError/;
const ASSERTION = /AssertionError|ERR_ASSERTION|Missing expected exception/;

const failCount = out => {
  const m = out.match(/^[#ℹ]\s*fail (\d+)/m);
  return m ? Number(m[1]) : (/\bnot ok\b/.test(out) ? 1 : null);
};

export function testRuns(tools) {
  return tools
    .map((t, index) => ({ t, index }))
    .filter(({ t }) => t.name === 'Bash' && TEST_RUN.test(t.input?.command ?? '') && t.output)
    .map(({ t, index }) => ({ index, output: t.output, fails: failCount(t.output) }));
}

const writes = (t, re) => {
  if (['Edit', 'Write', 'MultiEdit'].includes(t.name)) return re.test(t.input?.file_path ?? '');
  return t.name === 'Bash' && re.test(t.input?.command ?? '') && /(>|tee|cat\s*<<|sed -i)/.test(t.input?.command ?? '');
};

export default async function grade({ dir, tools = [] }) {
  const testWrite = tools.findIndex(t => writes(t, /tests?\/money[\w.-]*\.(test|spec)\.m?js/));
  const runs = testRuns(tools).filter(r => testWrite >= 0 && r.index >= testWrite);
  const green = runs.find(r => r.fails === 0);
  const red = runs.filter(r => r.fails > 0 && (!green || r.index < green.index));
  const lastRed = red.at(-1);
  const checks = {
    testsWritten: testWrite >= 0,
    redRunBeforeGreen: Boolean(lastRed),
    rightReason: Boolean(lastRed) && ASSERTION.test(lastRed.output) && !LOAD_ERROR.test(lastRed.output),
    works: false,
  };
  try {
    const m = await import(pathToFileURL(path.join(dir, 'src/money.js')) + `?t=${Date.now()}`);
    const throwsType = (f, ...a) => { try { f(...a); return false; } catch (e) { return e instanceof TypeError; } };
    const throwsRange = (f, ...a) => { try { f(...a); return false; } catch (e) { return e instanceof RangeError; } };
    checks.works = m.parseAmount('12.50') === 1250 && m.parseAmount('0.05') === 5 && m.parseAmount('-3') === -300
      && throwsType(m.parseAmount, '') && throwsType(m.parseAmount, '1.234') && throwsType(m.parseAmount, 'abc')
      && m.formatAmount(123456) === '1,234.56' && m.formatAmount(-5) === '-0.05' && m.formatAmount(0) === '0.00'
      && JSON.stringify(m.splitAmount(100, 3)) === '[34,33,33]' && JSON.stringify(m.splitAmount(5, 2)) === '[3,2]'
      && throwsRange(m.splitAmount, 100, 0) && throwsRange(m.splitAmount, 100, 1.5);
  } catch {}
  // Not part of the pass: how many tests failed in that run (a cluster fails several at once).
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, failingInLastRed: lastRed?.fails ?? 0, redRuns: red.length } };
}
