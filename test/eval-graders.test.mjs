import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import gradeTdd from '../evals/cases/tdd-feature/grade.mjs';

const IMPL = `export function parseDuration(text) {
  const m = typeof text === 'string' && text !== '' && /^(?:(\\d+)h)?(?:(\\d+)m)?(?:(\\d+)s)?$/.exec(text);
  if (!m) throw new TypeError('bad duration');
  return (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0));
}
`;

function workspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-grade-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'duration.js'), IMPL);
  return dir;
}

const bash = command => ({ name: 'Bash', input: { command } });
const TEST_WRITE = bash(`cat > tests/duration.test.js <<'EOF'
import { formatDuration, parseDuration } from '../src/duration.js';
test('parses', () => assert.equal(parseDuration('1h30m'), 5400));
EOF`);
const RED_RUN = bash('npm test 2>&1 | grep -i "does not provide" | head -3');
const IMPL_WRITE = bash(`cat >> src/duration.js <<'EOF'
export function parseDuration(text) {}
EOF`);

test('tdd-feature: a test that imports the module is a test write, not an implementation write', async () => {
  const dir = workspace();
  const result = await gradeTdd({ dir, tools: [bash('cat src/*.js 2>/dev/null'), TEST_WRITE, RED_RUN, IMPL_WRITE] });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(result.checks, { testFirst: true, redRunBeforeImplementation: true, works: true });
  assert.equal(result.pass, true);
});

test('tdd-feature: claiming red without running the tests fails', async () => {
  const dir = workspace();
  const result = await gradeTdd({ dir, tools: [TEST_WRITE, IMPL_WRITE, bash('npm run verify')] });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(result.checks.testFirst, true);
  assert.equal(result.checks.redRunBeforeImplementation, false);
  assert.equal(result.pass, false);
});

test('tdd-feature: implementation before test fails', async () => {
  const dir = workspace();
  const result = await gradeTdd({ dir, tools: [IMPL_WRITE, TEST_WRITE, RED_RUN] });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(result.checks.testFirst, false);
  assert.equal(result.pass, false);
});

test('tdd-feature: Edit tools are classified by file path', async () => {
  const dir = workspace();
  const result = await gradeTdd({
    dir,
    tools: [
      { name: 'Edit', input: { file_path: `${dir}/tests/duration.test.js`, old_string: 'x', new_string: "import { parseDuration } from '../src/duration.js';" } },
      bash('node --test'),
      { name: 'Edit', input: { file_path: `${dir}/src/duration.js`, old_string: 'x', new_string: 'export function parseDuration() {}' } },
    ],
  });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(result.pass, true, JSON.stringify(result.checks));
});

test('tdd-feature: a test run in the same command as the test write counts as the red run', async () => {
  const dir = workspace();
  const writeAndRun = bash(`python3 - <<'E'
p='tests/duration.test.js'
s=open(p).read()
s=s.replace("import { formatDuration }","import { formatDuration, parseDuration }")
open(p,'w').write(s)
E
npm run verify 2>&1 | tail -25`);
  const result = await gradeTdd({ dir, tools: [writeAndRun, IMPL_WRITE] });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(result.checks, { testFirst: true, redRunBeforeImplementation: true, works: true });
});

test('tdd-feature: heredoc bodies and arrow functions are not redirect targets', async () => {
  const { writtenPaths } = await import('../evals/cases/tdd-feature/grade.mjs');
  const cmd = [
    "cat >> tests/duration.test.js <<'END'",
    "test('x', () => { assert.equal(parseDuration('1h') > 0, true); });",
    'END',
    'npm test 2>&1 > /dev/null',
  ].join('\n');
  assert.deepEqual(writtenPaths({ name: 'Bash', input: { command: cmd } }), ['tests/duration.test.js']);
});

test('eval harness: shared node_modules is a real directory inside the workspace', async () => {
  // Turbopack rejects a node_modules symlink that points outside the project root.
  const { prepareWorkspace } = await import('../evals/run.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-case-'));
  fs.mkdirSync(path.join(root, 'fixture'));
  fs.writeFileSync(path.join(root, 'fixture', 'README.md'), 'fixture\n');
  fs.mkdirSync(path.join(root, 'deps', 'node_modules', 'next'), { recursive: true });
  fs.writeFileSync(path.join(root, 'deps', 'node_modules', 'next', 'package.json'), '{}');
  const dir = await prepareWorkspace({ name: 'synthetic', dir: root, meta: { nodeModulesFrom: path.join(root, 'deps') } }, 'none');
  try {
    const stat = fs.lstatSync(path.join(dir, 'node_modules'));
    assert.equal(stat.isSymbolicLink(), false);
    assert.ok(stat.isDirectory());
    assert.ok(fs.existsSync(path.join(dir, 'node_modules', 'next', 'package.json')));
    assert.equal(spawnSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }).stdout, '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});
