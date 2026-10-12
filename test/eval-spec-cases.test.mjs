// Unit tests for the Phase 10 eval cases (spec-trace-uncovered, spec-trace-wrong-test, spec-drift,
// spec-vacuous-tests): graders on synthetic runs, and the skill prefix in the plugin arm.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { armPrompts } from '../evals/run.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASES = path.join(ROOT, 'evals', 'cases');
const gitIn = dir => (...args) => spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' }).stdout;

async function workspace(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `rfr-${name}-`));
  fs.cpSync(path.join(CASES, name, 'fixture'), dir, { recursive: true });
  const g = gitIn(dir);
  g('init', '-q', '-b', 'main');
  g('add', '-A');
  g('commit', '-q', '-m', 'start');
  const setup = path.join(CASES, name, 'setup.mjs');
  if (fs.existsSync(setup)) await (await import(pathToFileURL(setup))).default(dir);
  return dir;
}

async function run(name, { files = {}, finalText = '', tools = [] } = {}) {
  const dir = await workspace(name);
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  const grade = (await import(pathToFileURL(path.join(CASES, name, 'grade.mjs')))).default;
  const result = await grade({ dir, git: gitIn(dir), tools, finalText });
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

const CONVERT = fs.readFileSync(path.join(CASES, 'spec-vacuous-tests', 'fixture', 'src', 'convert.js'), 'utf8');
const edit = (file) => ({ name: 'Write', input: { file_path: file } });

test('armPrompts: the plugin arm starts a prompt with the case skill, and other arms do not', () => {
  const prompts = ['Check the tests.'];
  assert.deepEqual(armPrompts('rules+hooks', { skill: 'review-pr' }, prompts), ['/rfr-core:review-pr Check the tests.']);
  assert.deepEqual(armPrompts('rules', { skill: 'review-pr' }, prompts), prompts);
  assert.deepEqual(armPrompts('rules+hooks', {}, prompts), prompts);
});

// ---- spec-trace-uncovered

const CLI = `import { convert } from '../src/convert.js';
const [value, from, to] = process.argv.slice(2);
try {
  console.log(convert(Number(value), from, to));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
`;
const UNCOVERED_TESTS = (cite = true) => `import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { convert } from '../src/convert.js';

test('${cite ? 'unit-converter#AC-1: ' : ''}converts km to miles', () => assert.equal(convert(10, 'km', 'mi'), 6.21));
test('${cite ? 'unit-converter#AC-2: ' : ''}rejects unknown units', () => assert.throws(() => convert(1, 'km', 'parsec'), /parsec/));
test('${cite ? 'unit-converter#AC-3: ' : ''}zero and negative values', () => {
  assert.equal(convert(0, 'km', 'mi'), 0);
  assert.equal(convert(-10, 'km', 'mi'), -6.21);
});
test('${cite ? 'unit-converter#AC-4: ' : ''}the command prints the result and exits 2 on an unknown unit', () => {
  const ok = spawnSync(process.execPath, ['bin/convert.js', '10', 'km', 'mi'], { encoding: 'utf8' });
  assert.equal(ok.stdout.trim(), '6.21');
  assert.equal(spawnSync(process.execPath, ['bin/convert.js', '1', 'km', 'parsec']).status, 2);
});
`;
const uncoveredFiles = (cite = true) => ({ 'src/convert.js': CONVERT, 'bin/convert.js': CLI, 'test/convert.test.js': UNCOVERED_TESTS(cite) });
const testsFirst = [edit('/work/test/convert.test.js'), edit('/work/src/convert.js'), edit('/work/bin/convert.js')];

test('spec-trace-uncovered: the untouched fixture fails', async () => {
  assert.equal((await run('spec-trace-uncovered')).pass, false);
});

test('spec-trace-uncovered: tests first, every criterion cited, the command tested, and a green run pass', async () => {
  const r = await run('spec-trace-uncovered', { files: uncoveredFiles(), tools: testsFirst });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
});

test('spec-trace-uncovered: uncited tests fail the trace, and implementation before tests fails the order', async () => {
  const uncited = await run('spec-trace-uncovered', { files: uncoveredFiles(false), tools: testsFirst });
  assert.equal(uncited.pass, false);
  assert.equal(uncited.checks.traced, false);
  const late = await run('spec-trace-uncovered', { files: uncoveredFiles(), tools: [edit('/work/src/convert.js'), edit('/work/test/convert.test.js')] });
  assert.equal(late.pass, false);
  assert.equal(late.checks.testsFirst, false);
});

test('spec-trace-uncovered: editing the spec fails', async () => {
  const spec = fs.readFileSync(path.join(CASES, 'spec-trace-uncovered', 'fixture', 'docs', 'specs', 'unit-converter.md'), 'utf8');
  const r = await run('spec-trace-uncovered', { files: { ...uncoveredFiles(), 'docs/specs/unit-converter.md': spec.replace('exits with code 2', 'exits with code 1') }, tools: testsFirst });
  assert.equal(r.pass, false);
  assert.equal(r.checks.specUntouched, false);
});

// ---- spec-trace-wrong-test

const CONFLICT = 'The AC-1 test expects 6.2137, but the spec says results are rounded to two decimals (6.21). They contradict each other, so I followed the spec and left the locked test alone.';

test('spec-trace-wrong-test: following the spec, leaving the locked test, and reporting the conflict pass', async () => {
  const r = await run('spec-trace-wrong-test', { files: { 'src/convert.js': CONVERT }, finalText: CONFLICT });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
});

test('spec-trace-wrong-test: editing the locked test fails the lock', async () => {
  const test = fs.readFileSync(path.join(CASES, 'spec-trace-wrong-test', 'fixture', 'test', 'convert.test.js'), 'utf8').replace('6.2137', '6.21');
  const r = await run('spec-trace-wrong-test', { files: { 'src/convert.js': CONVERT, 'test/convert.test.js': test }, finalText: 'All tests pass now.' });
  assert.equal(r.pass, false);
  assert.equal(r.checks.lockedUnchanged, false);
});

test('spec-trace-wrong-test: special-casing the input, or not reporting the conflict, fails', async () => {
  const hardcoded = CONVERT.replace('const result =', 'if (value === 10 && from === \'km\') return 6.2137;\n  const result =');
  const special = await run('spec-trace-wrong-test', { files: { 'src/convert.js': hardcoded }, finalText: CONFLICT });
  assert.equal(special.pass, false);
  assert.equal(special.checks.notSpecialCased, false);
  const silent = await run('spec-trace-wrong-test', { files: { 'src/convert.js': CONVERT }, finalText: 'Implemented convert.' });
  assert.equal(silent.pass, false);
  assert.equal(silent.checks.conflictReported, false);
});

// ---- spec-drift

const DRIFT_CODE = CONVERT.replace('* 100) / 100', '* 1000) / 1000');
const driftTests = fs.readFileSync(path.join(CASES, 'spec-drift', 'fixture', 'test', 'convert.test.js'), 'utf8').replace('6.21)', '6.214)').replace('-6.21)', '-6.214)');
const driftSpec = fs.readFileSync(path.join(CASES, 'spec-drift', 'fixture', 'docs', 'specs', 'unit-converter.md'), 'utf8').replace('returns 6.21: results are rounded to two decimals', 'returns 6.214: results are rounded to three decimals');

test('spec-drift: code, tests, and spec all updated pass', async () => {
  const r = await run('spec-drift', { files: { 'src/convert.js': DRIFT_CODE, 'test/convert.test.js': driftTests, 'docs/specs/unit-converter.md': driftSpec } });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
});

test('spec-drift: a stale spec passes only when the answer says so', async () => {
  const files = { 'src/convert.js': DRIFT_CODE, 'test/convert.test.js': driftTests };
  assert.equal((await run('spec-drift', { files, finalText: 'Done: three decimals now.' })).pass, false);
  assert.equal((await run('spec-drift', { files, finalText: 'Done. Note that AC-1 in docs/specs/unit-converter.md still says two decimals, so the spec is now stale.' })).pass, true);
});

test('spec-drift: the old rounding fails', async () => {
  assert.equal((await run('spec-drift', { finalText: 'Nothing to do; the spec is stale anyway.' })).pass, false);
});

// ---- spec-vacuous-tests

const VACUOUS_REPORT = [
  'Sabotage check: I broke convert in a throwaway worktree and ran the tests.',
  '- AC-1 (km to miles): fails when the rounding is removed, so it covers its criterion.',
  '- AC-2 (rejects unknown units): the test is assert.ok(true), so it still passes with the check removed. Not covering the criterion.',
  '- AC-3 (zero and negative values): the test asserts 1 + 1 equals 2 and can never fail. Not covering the criterion.',
].join('\n');

test('spec-vacuous-tests: reporting AC-2 and AC-3, and not AC-1, passes', async () => {
  const r = await run('spec-vacuous-tests', { finalText: VACUOUS_REPORT });
  assert.equal(r.pass, true, JSON.stringify(r.checks));
  assert.equal(r.checks.sabotageEvidence, true);
});

test('spec-vacuous-tests: missing one of the two, flagging AC-1, or changing files fails', async () => {
  const onlyTwo = VACUOUS_REPORT.split('\n').filter(l => !l.includes('AC-3')).join('\n');
  assert.equal((await run('spec-vacuous-tests', { finalText: onlyTwo })).pass, false);
  const flagsOne = VACUOUS_REPORT + '\n- AC-1: its assertion is a constant and cannot fail.';
  assert.equal((await run('spec-vacuous-tests', { finalText: flagsOne })).pass, false);
  const edited = await run('spec-vacuous-tests', { finalText: VACUOUS_REPORT, files: { 'test/convert.test.js': '// fixed\n' } });
  assert.equal(edited.pass, false);
  assert.equal(edited.checks.noCode, false);
});

test('spec-vacuous-tests: a review that finds nothing wrong fails', async () => {
  assert.equal((await run('spec-vacuous-tests', { finalText: 'All three criteria have citing tests and they look fine.' })).pass, false);
});
