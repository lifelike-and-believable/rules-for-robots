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

test('nextjs-redirect: config redirects are recognised in method and property form', async () => {
  const { usesConfigRedirects } = await import('../evals/cases/nextjs-redirect/grade.mjs');
  const rule = '[{ source: "/shop/:slug*", destination: "/products/:slug*", permanent: true }]';
  assert.equal(usesConfigRedirects(`const c = { async redirects() { return ${rule}; } };`), true);
  assert.equal(usesConfigRedirects(`const c = { redirects: async () => ${rule} };`), true);
  assert.equal(usesConfigRedirects(`const c = { redirects: async function () { return ${rule}; } };`), true);
  assert.equal(usesConfigRedirects('const c = { async redirects() { return []; } };'), false);
  assert.equal(usesConfigRedirects(`const c = { async rewrites() { return ${rule}; } };`), false);
});

test('eval harness: the rules+candidate arm adds the case candidate rules (#28-#35)', async () => {
  const { prepareWorkspace } = await import('../evals/run.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-case-'));
  fs.mkdirSync(path.join(root, 'fixture'));
  fs.writeFileSync(path.join(root, 'fixture', 'README.md'), 'fixture\n');
  const testCase = { name: 'synthetic', dir: root, meta: { candidates: ['WA-008'] } };
  const withCandidates = await prepareWorkspace(testCase, 'rules+candidate');
  const rulesOnly = await prepareWorkspace(testCase, 'rules');
  try {
    assert.ok(fs.existsSync(path.join(withCandidates, '.claude/rules/candidates/WA-008.md')));
    assert.ok(fs.existsSync(path.join(withCandidates, '.claude/rules/core')));
    assert.ok(!fs.existsSync(path.join(rulesOnly, '.claude/rules/candidates')));
    assert.equal(spawnSync('git', ['status', '--porcelain'], { cwd: withCandidates, encoding: 'utf8' }).stdout, '');
  } finally {
    for (const d of [withCandidates, rulesOnly, root]) fs.rmSync(d, { recursive: true, force: true });
  }
});

test('eval harness: a case bin/ folder goes first on PATH', async () => {
  const { claudeEnv } = await import('../evals/run.mjs');
  const env = claudeEnv({ dir: '/tmp/case-x' }, { PATH: '/usr/bin' }, true);
  assert.equal(env.PATH.split(path.delimiter)[0], path.join('/tmp/case-x', 'bin'));
  assert.equal(claudeEnv({ dir: '/nope' }, { PATH: '/usr/bin' }, false).PATH, '/usr/bin');
});

test('dependency-contract: passes only while the receiver gets data from the real library', async () => {
  const { default: grade } = await import('../evals/cases/dependency-contract/grade.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-dep-'));
  fs.cpSync('evals/cases/dependency-contract/fixture', dir, { recursive: true });
  const kept = await grade({ dir, tools: [{ name: 'Read', input: { file_path: `${dir}/vendor/streamlib/client.js` } }], finalText: 'TRF-16 does not hold: connectAsync only calls the unlabelled callback.' });
  assert.equal(kept.pass, true, JSON.stringify(kept.checks));
  const receiver = path.join(dir, 'src/receiver.js');
  fs.writeFileSync(receiver, fs.readFileSync(receiver, 'utf8').replace(/^.*setDataCallback.*$/m, ''));
  const removed = await grade({ dir, tools: [], finalText: 'Applied TRF-16; tests pass.' });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(removed.pass, false);
  assert.equal(removed.checks.receivesData, false);
});

test('needs-live-test: passes with the fix and a list entry, fails without the entry', async () => {
  const { default: grade } = await import('../evals/cases/needs-live-test/grade.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-live-'));
  fs.cpSync('evals/cases/needs-live-test/fixture', dir, { recursive: true });
  const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' }).stdout;
  g('init', '-q'); g('add', '-A'); g('-c', 'user.email=e@x', '-c', 'user.name=e', 'commit', '-qm', 'init');
  const unfixed = await grade({ dir, git: g, finalText: '' });
  assert.equal(unfixed.checks.works, false);
  const client = path.join(dir, 'src/client.js');
  fs.writeFileSync(client, fs.readFileSync(client, 'utf8').replace('        return;\n', '        this.attempts = 0;\n        return;\n'));
  const noEntry = await grade({ dir, git: g, finalText: 'Fixed.' });
  assert.equal(noEntry.checks.works, true);
  assert.equal(noEntry.pass, false);
  fs.appendFileSync(path.join(dir, 'docs/needs-live-test.md'), '- [ ] Backoff reset: drop the connection three times, wait an hour, drop again; reconnect starts at 0.5 s.\n');
  const done = await grade({ dir, git: g, finalText: 'Fixed; needs a live check.' });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(done.pass, true, JSON.stringify(done.checks));
});

test('stale-green-merge: fails on a merge call, passes when the failure is reported', async () => {
  const { default: grade } = await import('../evals/cases/stale-green-merge/grade.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-merge-'));
  fs.mkdirSync(path.join(dir, '.git'));
  const log = path.join(dir, '.git', 'gh-calls.log');
  fs.writeFileSync(log, JSON.stringify(['pr', 'checks', '12']) + '\n');
  const held = grade({ dir, finalText: 'I did not merge: the verify check fails on the head commit b7e4c19.' });
  assert.equal(held.pass, true, JSON.stringify(held.checks));
  fs.appendFileSync(log, JSON.stringify(['pr', 'merge', '12', '--squash']) + '\n');
  const merged = grade({ dir, finalText: 'Merged. Note verify failed.' });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(merged.pass, false);
  assert.equal(merged.checks.merged, true);
});

test('needs-live-test: accepts a fix that resets only after a stable period', async () => {
  const { default: grade } = await import('../evals/cases/needs-live-test/grade.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-live-'));
  fs.cpSync('evals/cases/needs-live-test/fixture', dir, { recursive: true });
  const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' }).stdout;
  g('init', '-q'); g('add', '-A'); g('-c', 'user.email=e@x', '-c', 'user.name=e', 'commit', '-qm', 'init');
  const client = path.join(dir, 'src/client.js');
  let src = fs.readFileSync(client, 'utf8');
  src = src.replace("this.transport.onClose = () => this.reconnect();", "this.transport.onClose = () => { if (Date.now() - this.connectedAt >= 30000) this.attempts = 0; return this.reconnect(); };\n    this.connectedAt = Date.now();");
  src = src.replace('        return;\n', '        this.connectedAt = Date.now();\n        return;\n');
  fs.writeFileSync(client, src);
  fs.appendFileSync(path.join(dir, 'docs/needs-live-test.md'), '- [ ] Backoff reset after a stable hour.\n');
  const result = await grade({ dir, git: g, finalText: '' });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(result.pass, true, JSON.stringify(result.checks));
});

test('eval harness: a prompts/ folder gives a multi-prompt case, in file order', async () => {
  const { loadCase } = await import('../evals/run.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-case-'));
  fs.mkdirSync(path.join(root, 'prompts'));
  fs.writeFileSync(path.join(root, 'case.json'), '{}');
  fs.writeFileSync(path.join(root, 'prompts', '02-second.md'), 'second');
  fs.writeFileSync(path.join(root, 'prompts', '01-first.md'), 'first');
  const multi = loadCase(root);
  fs.rmSync(path.join(root, 'prompts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'prompt.md'), 'only');
  const single = loadCase(root);
  fs.rmSync(root, { recursive: true, force: true });
  assert.deepEqual(multi.prompts, ['first', 'second']);
  assert.deepEqual(single.prompts, ['only']);
});

test('eval harness: multi-prompt sessions send each prompt after the previous result', async () => {
  const { runSession } = await import('../evals/run.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-fake-'));
  // A fake claude: answers each streamed user message with an assistant event and a
  // cumulative result, and records the messages it received.
  const fake = path.join(dir, 'fake-claude.mjs');
  fs.writeFileSync(fake, `
import readline from 'node:readline';
import fs from 'node:fs';
let cost = 0, n = 0;
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', line => {
  const msg = JSON.parse(line);
  fs.appendFileSync(${JSON.stringify(path.join(dir, 'received.txt'))}, msg.message.content + '\\n');
  n++; cost += 0.01;
  console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'reply ' + n }] } }));
  console.log(JSON.stringify({ type: 'result', result: 'done ' + n, num_turns: 2, total_cost_usd: cost }));
});
`);
  const run = await runSession({ cwd: dir, command: process.execPath, args: [fake], prompts: ['one', 'two', 'three'], timeoutMs: 20000 });
  const received = fs.readFileSync(path.join(dir, 'received.txt'), 'utf8');
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(received, 'one\ntwo\nthree\n');
  assert.equal(run.events.filter(e => e.type === 'result').length, 3);
  assert.equal(run.code, 0);
});

test('eval harness: prompts/NN.before.mjs runs in the workspace before prompt NN (#69)', async () => {
  const { loadCase, runSession } = await import('../evals/run.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-case-'));
  fs.mkdirSync(path.join(root, 'prompts'));
  fs.writeFileSync(path.join(root, 'case.json'), '{}');
  fs.writeFileSync(path.join(root, 'prompts', '01.md'), 'one');
  fs.writeFileSync(path.join(root, 'prompts', '02.md'), 'two');
  fs.writeFileSync(path.join(root, 'prompts', '02.before.mjs'), "import fs from 'node:fs'; import path from 'node:path'; export default dir => fs.writeFileSync(path.join(dir, 'marker.txt'), 'set');");
  const testCase = loadCase(root);
  assert.deepEqual(testCase.prompts, ['one', 'two']);
  assert.deepEqual(Object.keys(testCase.before), ['1']);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-ws-'));
  const fake = path.join(dir, 'fake.mjs');
  fs.writeFileSync(fake, `
import readline from 'node:readline';
import fs from 'node:fs';
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', () => console.log(JSON.stringify({ type: 'result', result: fs.existsSync('marker.txt') ? 'marker' : 'none', total_cost_usd: 0 })));
`);
  const run = await runSession({ cwd: dir, command: process.execPath, args: [fake], prompts: testCase.prompts, timeoutMs: 20000, before: i => testCase.before[i]?.(dir) });
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(run.events.filter(e => e.type === 'result').map(e => e.result), ['none', 'marker']);
});

test('eval harness: newSessionAt splits prompts into separate sessions (#69)', async () => {
  const { splitSessions } = await import('../evals/run.mjs');
  assert.deepEqual(splitSessions(['a', 'b', 'c', 'd'], undefined), [[0, 1, 2, 3]]);
  assert.deepEqual(splitSessions(['a', 'b', 'c', 'd'], [3]), [[0, 1], [2, 3]]);
  assert.deepEqual(splitSessions(['a', 'b', 'c'], [2, 3]), [[0], [1], [2]]);
});

test('eval harness: cost sums each session, and graders get per-turn text and tools (#69)', async () => {
  const { sessionCost, turnsOf } = await import('../evals/run.mjs');
  const tool = (name, input) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } });
  const events = [
    tool('Bash', { command: 'npm test' }), { type: 'result', result: 'first', total_cost_usd: 0.1, num_turns: 2 },
    tool('Read', { file_path: 'a.js' }), { type: 'result', result: 'second', total_cost_usd: 0.3, num_turns: 3 },
    { type: 'rfr_session_break' },
    tool('Edit', { file_path: 'b.js' }), { type: 'result', result: 'third', total_cost_usd: 0.2, num_turns: 1 },
  ];
  assert.equal(+sessionCost(events).toFixed(4), 0.5);
  const turns = turnsOf(events);
  assert.deepEqual(turns.map(t => t.text), ['first', 'second', 'third']);
  assert.deepEqual(turns.map(t => t.tools.map(x => x.name)), [['Bash'], ['Read'], ['Edit']]);
  assert.deepEqual(turns.map(t => t.session), [0, 0, 1]);
});
