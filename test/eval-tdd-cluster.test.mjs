// Unit tests for the tdd-cluster eval case and for tool output in transcriptTools. The grader reads
// real node --test output, so these tests produce it: a missing module, wrong-valued stubs, and a
// working implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import grade from '../evals/cases/tdd-cluster/grade.mjs';
import { transcriptTools } from '../evals/run.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'evals', 'cases', 'tdd-cluster', 'fixture');

const TESTS = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, formatAmount, splitAmount } from '../src/money.js';
test('parses', () => { assert.equal(parseAmount('12.50'), 1250); assert.throws(() => parseAmount(''), TypeError); });
test('formats', () => { assert.equal(formatAmount(123456), '1,234.56'); });
test('splits', () => { assert.deepEqual(splitAmount(100, 3), [34, 33, 33]); });
`;
const STUBS = `export function parseAmount() { return -1; }
export function formatAmount() { return 'stub'; }
export function splitAmount() { return [-1]; }
`;
const IMPL = `export function parseAmount(text) {
  const m = /^(-?)(\\d+)(?:\\.(\\d{1,2}))?$/.exec(text);
  if (!m) throw new TypeError('bad amount');
  const cents = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'));
  return m[1] ? -cents : cents;
}
export function formatAmount(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = String(Math.floor(abs / 100)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
  return sign + whole + '.' + String(abs % 100).padStart(2, '0');
}
export function splitAmount(cents, parts) {
  if (!Number.isInteger(parts) || parts < 1) throw new RangeError('parts');
  const base = Math.floor(cents / parts);
  const extra = cents - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}
`;

function workspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-tdd-cluster-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}
const write = (dir, rel, text) => fs.writeFileSync(path.join(dir, rel), text);
function testRun(dir) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync('node', ['--test'], { cwd: dir, encoding: 'utf8', env });
  return { name: 'Bash', input: { command: 'npm test' }, output: r.stdout + r.stderr };
}
const writeCall = rel => ({ name: 'Write', input: { file_path: rel } });

test('tdd-cluster: stubs first, so the last red run fails on assertions, passes', async () => {
  const dir = workspace();
  const tools = [writeCall('src/money.js')];
  write(dir, 'src/money.js', STUBS);
  tools.push(writeCall('tests/money.test.js'));
  write(dir, 'tests/money.test.js', TESTS);
  tools.push(testRun(dir));
  tools.push({ name: 'Edit', input: { file_path: 'src/money.js' } });
  write(dir, 'src/money.js', IMPL);
  tools.push(testRun(dir));
  const r = await grade({ dir, tools });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
  assert.equal(r.checks.failingInLastRed, 3);
});

test('tdd-cluster: red only because the module is missing fails on rightReason', async () => {
  const dir = workspace();
  const tools = [writeCall('tests/money.test.js')];
  write(dir, 'tests/money.test.js', TESTS);
  tools.push(testRun(dir));
  tools.push(writeCall('src/money.js'));
  write(dir, 'src/money.js', IMPL);
  tools.push(testRun(dir));
  const r = await grade({ dir, tools });
  assert.equal(r.checks.redRunBeforeGreen, true);
  assert.equal(r.checks.works, true);
  assert.equal(r.checks.rightReason, false);
  assert.equal(r.pass, false);
});

test('tdd-cluster: a missing export after a right-reason run still fails, since the last red run counts', async () => {
  const dir = workspace();
  write(dir, 'src/money.js', STUBS);
  const tools = [writeCall('src/money.js'), writeCall('tests/money.test.js')];
  write(dir, 'tests/money.test.js', TESTS);
  tools.push(testRun(dir));
  write(dir, 'src/money.js', 'export function parseAmount() { return 0; }\n');
  tools.push({ name: 'Edit', input: { file_path: 'src/money.js' } }, testRun(dir));
  write(dir, 'src/money.js', IMPL);
  tools.push({ name: 'Edit', input: { file_path: 'src/money.js' } }, testRun(dir));
  const r = await grade({ dir, tools });
  assert.equal(r.checks.rightReason, false);
  assert.equal(r.checks.redRuns, 2);
});

test('tdd-cluster: no red run (implementation and tests together) fails', async () => {
  const dir = workspace();
  write(dir, 'src/money.js', IMPL);
  write(dir, 'tests/money.test.js', TESTS);
  const tools = [writeCall('src/money.js'), writeCall('tests/money.test.js'), testRun(dir)];
  const r = await grade({ dir, tools });
  assert.equal(r.checks.redRunBeforeGreen, false);
  assert.equal(r.pass, false);
});

test('tdd-cluster: a wrong implementation fails on works', async () => {
  const dir = workspace();
  write(dir, 'src/money.js', IMPL.replace("'.' + String", "'.' + 'x' + String"));
  const r = await grade({ dir, tools: [] });
  assert.equal(r.checks.works, false);
});

test('transcriptTools attaches each tool result to its call, as text', () => {
  const events = [
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'a', name: 'Bash', input: { command: 'npm test' } }, { type: 'tool_use', id: 'b', name: 'Read', input: {} }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'a', content: '# fail 2' }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'b', content: [{ type: 'text', text: 'one' }, { type: 'text', text: 'two' }] }] } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'c', name: 'Edit', input: {} }] } },
  ];
  const tools = transcriptTools(events);
  assert.deepEqual(tools.map(t => [t.name, t.output]), [['Bash', '# fail 2'], ['Read', 'one\ntwo'], ['Edit', '']]);
});
