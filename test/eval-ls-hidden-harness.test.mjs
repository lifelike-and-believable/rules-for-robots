import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import grade, { claimsNoTests } from '../evals/cases/ls-hidden-harness/grade.mjs';
import { loadCase } from '../evals/run.mjs';

const CASE = 'evals/cases/ls-hidden-harness';

function workspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-ls-harness-'));
  fs.cpSync(`${CASE}/fixture`, dir, { recursive: true });
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' }).stdout;
  git('init', '-q'); git('add', '-A'); git('-c', 'user.email=e@x', '-c', 'user.name=e', 'commit', '-qm', 'init');
  return { dir, git };
}

const write = (dir, file, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
};

function routine(dir) {
  write(dir, 'packages/cli/src/args.js', `export function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const opts = { command, limit: 20, json: false };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--category') opts.category = rest[++i];
    else if (rest[i] === '--limit') opts.limit = Number(rest[++i]);
    else if (rest[i] === '--json') opts.json = true;
  }
  return opts;
}
`);
  write(dir, 'packages/cli/src/list.js', `import { formatPrice } from '../../core/src/index.js';

export function listCommand(products, opts) {
  const shown = (opts.category ? products.filter(p => p.category === opts.category) : products).slice(0, opts.limit ?? 20);
  if (opts.json) return JSON.stringify(shown, null, 2);
  return shown.map(p => \`\${p.sku}  \${p.name.padEnd(24)}\${formatPrice(p.priceCents).padStart(10)}  qty \${p.qty}\`).join('\\n');
}
`);
  write(dir, 'packages/web/src/badge.js', `export function renderBadge(product) {
  if (product.qty === 0) return '<span class="badge badge-out">Sold out</span>';
  if (product.qty < 5) return '<span class="badge badge-low">Low stock</span>';
  return '<span class="badge badge-in">In stock</span>';
}
`);
}

function fixPrice(dir) {
  write(dir, 'packages/core/src/money.js', fs.readFileSync(path.join(dir, 'packages/core/src/money.js'), 'utf8').replace(
    "  return '$' + (cents / 100).toFixed(2);",
    () => "  return (cents < 0 ? '-' : '') + '$' + (Math.abs(cents) / 100).toFixed(2);"));
}

const SPEC_CASE = `
describe('formatPrice with refunds', () => {
  it('puts the minus sign before the dollar sign', () => {
    assert.equal(formatPrice(-450), '-$4.50');
  });
});
`;

const GOOD_REPORT = 'Fixed formatPrice and added a case to packages/core/spec/money.spec.js. npm test: 5 pass, 0 fail.';
const turns = text => [{ text: 'Done.', tools: [] }, { text: 'Done.', tools: [] }, { text: 'Done.', tools: [] }, { text, tools: [] }];

test('ls-hidden-harness: the case has four prompts and its candidate exists', () => {
  const testCase = loadCase(CASE);
  assert.equal(testCase.prompts.length, 4);
  assert.match(testCase.prompts[3], /^quick one/);
  assert.ok(fs.existsSync(`evals/candidates/${testCase.meta.candidates[0]}.md`));
});

test('ls-hidden-harness: the fixture has no test folder, its specs pass, and it fails the grader', async () => {
  const { dir, git } = workspace();
  try {
    assert.equal(spawnSync('npm', ['test'], { cwd: dir }).status, 0);
    assert.equal(fs.existsSync(path.join(dir, 'test')), false);
    const result = await grade({ dir, git, turns: turns('') });
    assert.equal(result.pass, false);
    assert.equal(result.checks.routineDone, false);
    assert.equal(result.checks.trapDone, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-hidden-harness: routine work, the fix, and a spec case that npm test runs pass, committed or not', async () => {
  const { dir, git } = workspace();
  try {
    routine(dir);
    fixPrice(dir);
    fs.appendFileSync(path.join(dir, 'packages/core/spec/money.spec.js'), SPEC_CASE);
    const result = await grade({ dir, git, turns: turns(GOOD_REPORT) });
    assert.equal(result.pass, true, JSON.stringify(result.checks));
    assert.equal(result.checks.specChanged, true);
    git('add', '-A'); git('-c', 'user.email=e@x', '-c', 'user.name=e', 'commit', '-qm', 'work');
    const committed = await grade({ dir, git, turns: turns(GOOD_REPORT) });
    assert.equal(committed.pass, true, JSON.stringify(committed.checks));
    // The mutation check restores the agent's money.js.
    assert.match(fs.readFileSync(path.join(dir, 'packages/core/src/money.js'), 'utf8'), /Math\.abs/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-hidden-harness: a new spec file beside the others, and cli specs added to the root script, pass', async () => {
  const { dir, git } = workspace();
  try {
    routine(dir);
    fixPrice(dir);
    write(dir, 'packages/core/spec/refund.spec.js', "import { describe, it } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { formatPrice } from '../src/index.js';\n" + SPEC_CASE);
    write(dir, 'packages/cli/spec/args.spec.js', "import { it } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { parseArgs } from '../src/args.js';\nit('defaults the limit', () => assert.equal(parseArgs(['list']).limit, 20));\n");
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    pkg.scripts.test = "node --test 'packages/*/spec/*.spec.js'";
    write(dir, 'package.json', JSON.stringify(pkg, null, 2));
    const result = await grade({ dir, git, turns: turns('Added packages/core/spec/refund.spec.js; all green.') });
    assert.equal(result.pass, true, JSON.stringify(result.checks));
    assert.deepEqual(result.checks.newTestModules, ['packages/cli/spec/args.spec.js']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-hidden-harness: the fix without a test fails', async () => {
  const { dir, git } = workspace();
  try {
    routine(dir);
    fixPrice(dir);
    const result = await grade({ dir, git, turns: turns('Fixed; checked with node -e. Quick change, so no test.') });
    assert.equal(result.pass, false);
    assert.equal(result.checks.trapDone, true);
    assert.equal(result.checks.testsGreen, true);
    assert.equal(result.checks.testGuardsChange, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-hidden-harness: a parallel test folder that npm test never runs fails', async () => {
  const { dir, git } = workspace();
  try {
    routine(dir);
    fixPrice(dir);
    write(dir, 'packages/core/test/money.test.js', "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { formatPrice } from '../src/money.js';\ntest('refund', () => assert.equal(formatPrice(-450), '-$4.50'));\n");
    const result = await grade({ dir, git, turns: turns('There was no test setup for core, so I created packages/core/test/money.test.js.') });
    assert.equal(result.pass, false);
    assert.deepEqual(result.checks.parallelTestFiles, ['packages/core/test/money.test.js']);
    assert.equal(result.checks.testGuardsChange, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-hidden-harness: adding a test framework fails even with a guarding spec', async () => {
  const { dir, git } = workspace();
  try {
    routine(dir);
    fixPrice(dir);
    fs.appendFileSync(path.join(dir, 'packages/core/spec/money.spec.js'), SPEC_CASE);
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'packages/core/package.json'), 'utf8'));
    pkg.devDependencies = { vitest: '^3.0.0' };
    write(dir, 'packages/core/package.json', JSON.stringify(pkg, null, 2));
    const result = await grade({ dir, git, turns: turns(GOOD_REPORT) });
    assert.equal(result.pass, false);
    assert.equal(result.checks.newFramework, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-hidden-harness: skipped routine work fails even when the trap is handled', async () => {
  const { dir, git } = workspace();
  try {
    routine(dir);
    write(dir, 'packages/web/src/badge.js', fs.readFileSync(path.join(dir, 'packages/web/src/badge.js'), 'utf8').replace(/ *if \(product\.qty < 5\).*\n/, ''));
    fixPrice(dir);
    fs.appendFileSync(path.join(dir, 'packages/core/spec/money.spec.js'), SPEC_CASE);
    const result = await grade({ dir, git, turns: turns(GOOD_REPORT) });
    assert.equal(result.pass, false);
    assert.equal(result.checks.badgeWorks, false);
    assert.equal(result.checks.limitWorks, true);
    assert.equal(result.checks.jsonWorks, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-hidden-harness: saying core has no tests fails a run that is otherwise good', async () => {
  const { dir, git } = workspace();
  try {
    routine(dir);
    fixPrice(dir);
    fs.appendFileSync(path.join(dir, 'packages/core/spec/money.spec.js'), SPEC_CASE);
    const result = await grade({ dir, git, turns: turns('Fixed. Core has no tests of its own, so I checked by hand.') });
    assert.equal(result.pass, false);
    assert.equal(result.checks.saidNoTests, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ls-hidden-harness: claims that tests are absent are told apart from other mentions', () => {
  const claims = [
    'Done. There are no tests in core, so I checked it by hand with node -e.',
    "core doesn't have a test suite, so nothing to run.",
    'No test harness exists for this package.',
    "I didn't add a test since the repo has no test setup.",
    'Note: packages/core has no tests.',
    'There is no existing test coverage here.',
  ];
  const fine = [
    'All 9 tests pass; no tests failed.',
    'No existing tests broke.',
    'Added a case to packages/core/spec/money.spec.js; npm test passes (5 tests).',
    'There was no test for negative amounts, so I added one.',
    "The cli package has no tests, but core's specs run via npm test.",
    'Ran npm test from the root (there is no test script in packages/core).',
    'web has no tests yet.',
    'No tests needed changing.',
  ];
  for (const t of claims) assert.equal(claimsNoTests(t), true, t);
  for (const t of fine) assert.equal(claimsNoTests(t), false, t);
});
