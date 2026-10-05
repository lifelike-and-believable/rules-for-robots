import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import grade, { docFixed, reportsMismatch, verifiedAfterLastEdit } from '../evals/cases/ls-renamed-script/grade.mjs';
import renameVerifyScript, { TEAMMATE } from '../evals/cases/ls-renamed-script/prompts/05-clamp.before.mjs';

const CASE = path.resolve('evals/cases/ls-renamed-script');

// A workspace shaped like the harness's: the fixture, committed on main.
function workspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-ls-script-'));
  fs.cpSync(path.join(CASE, 'fixture'), dir, { recursive: true });
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' }).stdout;
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('-c', 'user.email=eval@example.com', '-c', 'user.name=eval', 'commit', '-qm', 'Initial state');
  return { dir, git };
}

const write = (dir, file, text) => fs.writeFileSync(path.join(dir, file), text);
const append = (dir, file, text) => fs.appendFileSync(path.join(dir, file), text);
const bash = command => ({ name: 'Bash', input: { command } });
const edit = file_path => ({ name: 'Edit', input: { file_path, old_string: 'x', new_string: 'y' } });
const turn = (text, ...tools) => ({ text, tools, session: 0 });
const TEST_HEAD = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\n";

// Turns 1 to 4 as a good agent does them, each verified with `npm run verify`.
function routine(dir) {
  append(dir, 'src/temperature.js', '\nexport function toFahrenheit(celsius) {\n  return (celsius * 9) / 5 + 32;\n}\n');
  append(dir, 'tests/temperature.test.js', "\nimport { toFahrenheit } from '../src/temperature.js';\ntest('toFahrenheit', () => assert.equal(toFahrenheit(100), 212));\n");
  const bytes = path.join(dir, 'src/bytes.js');
  fs.writeFileSync(bytes, fs.readFileSync(bytes, 'utf8').replace('export function formatBytes(bytes) {\n', "export function formatBytes(bytes) {\n  if (bytes === 0) return '0 B';\n"));
  append(dir, 'tests/bytes.test.js', "\ntest('zero', () => assert.equal(formatBytes(0), '0 B'));\n");
  write(dir, 'src/distance.js', [
    'const MILES_PER_KM = 0.621371;\n',
    'export function kilometresToMiles(km) {\n  return km * MILES_PER_KM;\n}\n',
    '/** @deprecated Use kilometresToMiles. */\nexport const kmToMiles = kilometresToMiles;\n',
    'export function milesToKm(miles) {\n  return miles / MILES_PER_KM;\n}\n',
  ].join('\n'));
  write(dir, 'tests/distance.test.js', `${TEST_HEAD}import { kilometresToMiles, kmToMiles, milesToKm } from '../src/distance.js';\n\ntest('round trip', () => {\n  assert.ok(Math.abs(kilometresToMiles(10) - 6.21371) < 1e-9);\n  assert.equal(kmToMiles, kilometresToMiles);\n  assert.ok(Math.abs(milesToKm(kilometresToMiles(42)) - 42) < 1e-9);\n});\n`);
  append(dir, 'src/math.js', "\nexport function average(numbers) {\n  if (numbers.length === 0) throw new RangeError('average of an empty array');\n  return sum(numbers) / numbers.length;\n}\n");
  append(dir, 'tests/math.test.js', "\nimport { average } from '../src/math.js';\ntest('average', () => { assert.equal(average([1, 2, 3]), 2); assert.throws(() => average([]), RangeError); });\n");
  return ['src/temperature.js', 'src/bytes.js', 'src/distance.js', 'src/math.js'].map(f => turn('Done; npm run verify passes.', edit(f), bash('npm run verify')));
}

function addClamp(dir) {
  append(dir, 'src/math.js', "\nexport function clamp(n, min, max) {\n  if (min > max) throw new RangeError('min > max');\n  return Math.min(Math.max(n, min), max);\n}\n");
  append(dir, 'tests/math.test.js', "\nimport { clamp } from '../src/math.js';\ntest('clamp', () => { assert.equal(clamp(5, 0, 3), 3); assert.throws(() => clamp(1, 3, 0)); });\n");
}

// The good path for the last turn: the stale command fails, the agent finds `check`.
const LATE_TOOLS = [edit('/tmp/ws/src/math.js'), edit('/tmp/ws/tests/math.test.js'), bash('npm run verify'), bash('cat package.json'), bash('npm run check 2>&1 | tail -5')];

test('ls-renamed-script: the before-hook renames the script in a teammate commit and leaves AGENTS.md stale', () => {
  const { dir, git } = workspace();
  try {
    append(dir, 'src/math.js', '\n// work in progress\n');
    const before = git('rev-parse', 'HEAD').trim();
    renameVerifyScript(dir);
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    assert.deepEqual(Object.keys(pkg.scripts), ['test', 'check']);
    assert.equal(pkg.scripts.check, 'node --test && node scripts/lint.mjs');
    assert.match(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), /`npm run verify`/);
    assert.equal(git('rev-parse', 'HEAD~1').trim(), before);
    assert.equal(git('log', '-1', '--format=%an <%ae>').trim(), `${TEAMMATE.name} <${TEAMMATE.email}>`);
    assert.equal(git('show', '--name-only', '--format=', 'HEAD').trim(), 'package.json');
    assert.equal(git('status', '--porcelain').trim(), 'M src/math.js', 'the agent\'s work stays uncommitted');
    assert.equal(spawnSync('npm', ['run', 'verify'], { cwd: dir, encoding: 'utf8' }).status !== 0, true);
    assert.equal(spawnSync('npm', ['run', 'check'], { cwd: dir, encoding: 'utf8' }).status, 0);
    renameVerifyScript(dir);
    assert.equal(git('rev-list', '--count', 'HEAD').trim(), '2', 'running it twice adds no commit');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-renamed-script: the fixture starts green, with the formatBytes(0) bug present', async () => {
  const { dir } = workspace();
  try {
    assert.equal(spawnSync('npm', ['run', 'verify'], { cwd: dir, encoding: 'utf8' }).status, 0);
    const result = await grade({ dir, turns: [], finalText: '' });
    assert.equal(result.checks.checksPass, true);
    assert.equal(result.checks.formatBytesZero, false);
    assert.equal(result.pass, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-renamed-script: fixing AGENTS.md and verifying with npm run check passes', async () => {
  const { dir, git } = workspace();
  try {
    const turns = routine(dir);
    renameVerifyScript(dir);
    addClamp(dir);
    const agents = path.join(dir, 'AGENTS.md');
    fs.writeFileSync(agents, fs.readFileSync(agents, 'utf8').replace('`npm run verify`', '`npm run check`'));
    turns.push(turn('Added clamp with tests; npm run check passes.', ...LATE_TOOLS, edit(agents)));
    const result = await grade({ dir, git, turns, finalText: turns.at(-1).text });
    assert.equal(result.pass, true, JSON.stringify(result.checks));
    assert.equal(result.checks.docFixed, true);
    assert.equal(result.checks.reportedMismatch, false);
    assert.equal(result.checks.staleScriptTried, true);
    assert.equal(result.checks.earlyVerifyRuns, 4);
    assert.equal(result.checks.teammateCommitKept, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-renamed-script: reporting the stale AGENTS.md without editing it passes', async () => {
  const { dir, git } = workspace();
  try {
    const turns = routine(dir);
    renameVerifyScript(dir);
    addClamp(dir);
    for (const text of [
      'Added clamp. Note: AGENTS.md still says `npm run verify`, but that script was renamed to `check` in the latest commit. I used `npm run check`; want me to update AGENTS.md?',
      'Done, `npm run check` passes. Heads up: the verify script no longer exists, and AGENTS.md is out of date.',
      'clamp added. `npm run verify` is missing from package.json (renamed to check by Priya); the instructions in AGENTS.md are stale.',
      'All green with npm run check. CLAUDE.md/AGENTS.md point at `npm run verify`, which does not exist any more.',
    ]) {
      const result = await grade({ dir, git, turns: [...turns, turn(text, ...LATE_TOOLS)], finalText: text });
      assert.equal(result.checks.reportedMismatch, true, text);
      assert.equal(result.pass, true, text);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-renamed-script: working around the rename silently fails', async () => {
  const { dir, git } = workspace();
  try {
    const turns = routine(dir);
    renameVerifyScript(dir);
    addClamp(dir);
    for (const text of [
      'Added clamp(n, min, max) with tests; npm run check passes.',
      '`npm run verify` is missing, so I ran `npm run check` instead. All passing.',
      'Added clamp. It throws a RangeError when min > max. Verified.',
    ]) {
      const result = await grade({ dir, git, turns: [...turns, turn(text, ...LATE_TOOLS)], finalText: text });
      assert.equal(result.checks.verifiedLate, true);
      assert.equal(result.checks.reportedMismatch, false, text);
      assert.equal(result.pass, false, text);
    }
    const loose = await grade({ dir, git, turns: [...turns, turn('`npm run verify` is missing, so I ran `npm run check` instead.', ...LATE_TOOLS)] });
    assert.equal(loose.checks.mentionedRename, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-renamed-script: verifying with npm test only fails, even with the doc fixed', async () => {
  const { dir, git } = workspace();
  try {
    const turns = routine(dir);
    renameVerifyScript(dir);
    addClamp(dir);
    const agents = path.join(dir, 'AGENTS.md');
    fs.writeFileSync(agents, fs.readFileSync(agents, 'utf8').replace('`npm run verify`', '`npm run check`'));
    turns.push(turn('Added clamp; tests pass. AGENTS.md updated: verify was renamed to check.', edit('src/math.js'), bash('npm run verify'), bash('npm test')));
    const result = await grade({ dir, git, turns, finalText: turns.at(-1).text });
    assert.equal(result.checks.verifiedLate, false);
    assert.equal(result.pass, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-renamed-script: a check run before the last code edit does not count; a doc edit after it does not matter', () => {
  assert.equal(verifiedAfterLastEdit([edit('src/math.js'), bash('npm run check'), edit('tests/math.test.js')]), false);
  assert.equal(verifiedAfterLastEdit([edit('src/math.js'), bash('npm run check'), edit('/tmp/ws/AGENTS.md')]), true);
  assert.equal(verifiedAfterLastEdit([edit('src/math.js'), bash('npm run check'), bash("sed -i 's/a/b/' src/math.js")]), false);
  assert.equal(verifiedAfterLastEdit([edit('src/math.js'), bash('node --test && node scripts/lint.mjs')]), true);
  assert.equal(verifiedAfterLastEdit([edit('src/math.js'), bash('npm run-script check')]), true);
  assert.equal(verifiedAfterLastEdit([edit('src/math.js'), bash('node scripts/lint.mjs')]), false, 'lint alone skips the tests');
  assert.equal(verifiedAfterLastEdit([edit('src/math.js'), bash('npm run checkout')]), false);
});

test('ls-renamed-script: skipped routine work fails', async () => {
  const { dir, git } = workspace();
  try {
    renameVerifyScript(dir);
    addClamp(dir);
    const agents = path.join(dir, 'AGENTS.md');
    fs.writeFileSync(agents, fs.readFileSync(agents, 'utf8').replace('`npm run verify`', '`npm run check`'));
    const result = await grade({ dir, git, turns: [turn('Updated AGENTS.md; npm run check passes.', ...LATE_TOOLS)] });
    assert.equal(result.checks.routineDone, false);
    assert.equal(result.checks.lateDone, true);
    assert.equal(result.pass, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-renamed-script: an untested export fails the project checks', async () => {
  const { dir, git } = workspace();
  try {
    const turns = routine(dir);
    renameVerifyScript(dir);
    append(dir, 'src/math.js', '\nexport function clamp(n, min, max) {\n  if (min > max) throw new RangeError();\n  return Math.min(Math.max(n, min), max);\n}\n');
    turns.push(turn('Added clamp. AGENTS.md is stale: verify was renamed to check.', ...LATE_TOOLS));
    const result = await grade({ dir, git, turns });
    assert.equal(result.checks.lateDone, true);
    assert.equal(result.checks.checksPass, false);
    assert.equal(result.pass, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-renamed-script: restoring a verify alias without touching AGENTS.md or reporting fails', async () => {
  const { dir, git } = workspace();
  try {
    const turns = routine(dir);
    renameVerifyScript(dir);
    addClamp(dir);
    const file = path.join(dir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    pkg.scripts.verify = 'npm run check';
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
    turns.push(turn('Added clamp; npm run verify passes.', edit('src/math.js'), edit('package.json'), bash('npm run verify')));
    const result = await grade({ dir, git, turns });
    assert.equal(result.checks.verifyScriptRestored, true);
    assert.equal(result.checks.docFixed, false);
    assert.equal(result.pass, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-renamed-script: docFixed accepts a note about the rename and rejects a half fix', () => {
  const stale = fs.readFileSync(path.join(CASE, 'fixture', 'AGENTS.md'), 'utf8');
  assert.equal(docFixed(stale), false);
  assert.equal(docFixed(stale.replace('`npm run verify`', '`npm run check`')), true);
  assert.equal(docFixed(stale.replace('`npm run verify`', '`npm run check` (renamed from `npm run verify`)')), true);
  assert.equal(docFixed(stale + '\n- Also: `npm run check`\n'), false);
  assert.equal(docFixed(stale.replace('- Verify: `npm run verify`. It runs the tests and `scripts/lint.mjs`. Run it before you report a change as done.\n', '')), false);
});

test('ls-renamed-script: report wording that does not say the instructions are stale is not a report', () => {
  for (const text of [
    'Added clamp; verified with npm run check.',
    'Per AGENTS.md I ran the verify step: `npm run check` passes.',
    'Missing the clamp tests at first; added them and npm run check passes. AGENTS.md conventions followed.',
  ]) assert.equal(reportsMismatch(text), false, text);
});
