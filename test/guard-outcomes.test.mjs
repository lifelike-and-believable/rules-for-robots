// Guard outcome logging and the report (docs/specs/guard-tiers.md, AC-6 and AC-7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { summarise, formatReport, reasonKey } from '../checks/guard-report.mjs';

const REPO = path.resolve('.');
const run = (script, input, data) => spawnSync(process.execPath, [`plugins/core/scripts/${script}`], {
  input: JSON.stringify(input),
  encoding: 'utf8',
  env: { ...process.env, CLAUDE_PLUGIN_DATA: data },
});
const lines = data => fs.readFileSync(path.join(data, 'guard-decisions.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));

test('guard-tiers#AC-6: an asked call that then runs, or fails while running, is logged as approved', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-outcome-'));
  for (const [id, event] of [['toolu_1', 'PostToolUse'], ['toolu_2', 'PostToolUseFailure']]) {
    const asked = run('guard-commands.mjs', { session_id: 's', tool_use_id: id, tool_name: 'Bash', cwd: REPO, tool_input: { command: 'git push --force origin main' } }, data);
    assert.match(asked.stdout, /"permissionDecision":"ask"/);
    const after = run('guard-outcome.mjs', { session_id: 's', hook_event_name: event, tool_use_id: id, tool_name: 'Bash', tool_input: { command: 'git push --force origin main' } }, data);
    assert.equal(after.status, 0);
    assert.equal(after.stdout, '');
  }
  const log = lines(data);
  assert.deepEqual(log.map(l => l.decision), ['ask', 'approved', 'ask', 'approved']);
  assert.equal(log[1].hook, 'guard-commands');
  assert.equal(log[1].reason, log[0].reason);
  assert.deepEqual(Object.keys(log[1]).sort(), ['decision', 'hook', 'reason', 'session', 'time', 'tool']);
  assert.doesNotMatch(JSON.stringify(log), /origin main/);
});

test('guard-tiers#AC-6: a call that was not asked about, or was asked and never ran, gets no approved line', () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-outcome-'));
  run('guard-commands.mjs', { session_id: 's', tool_use_id: 'toolu_9', tool_name: 'Bash', cwd: REPO, tool_input: { command: 'git push --force' } }, data);
  // A different call runs; the asked one (declined, or the session ended) never does.
  run('guard-outcome.mjs', { session_id: 's', hook_event_name: 'PostToolUse', tool_use_id: 'toolu_10', tool_name: 'Bash', tool_input: { command: 'ls' } }, data);
  assert.deepEqual(lines(data).map(l => l.decision), ['ask']);
  // With logging off, no pending record is left behind either.
  const off = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-outcome-'));
  spawnSync(process.execPath, ['plugins/core/scripts/guard-commands.mjs'], { input: JSON.stringify({ tool_use_id: 'toolu_x', tool_name: 'Bash', cwd: REPO, tool_input: { command: 'git push --force' } }), env: { ...process.env, CLAUDE_PLUGIN_DATA: off, RFR_GUARD_LOG: '0' } });
  assert.deepEqual(fs.readdirSync(off), []);
});

test('guard-tiers#AC-6: the outcome hook is registered for the tools the guards cover, after success and failure', () => {
  const hooks = JSON.parse(fs.readFileSync('plugins/core/hooks/hooks.json', 'utf8')).hooks;
  for (const event of ['PostToolUse', 'PostToolUseFailure']) {
    const entry = hooks[event]?.find(h => h.hooks.some(x => x.command.includes('guard-outcome.mjs')));
    assert.ok(entry, event);
    const matcher = new RegExp(`^(?:${entry.matcher})$`);
    for (const tool of ['Bash', 'PowerShell', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'mcp__Vercel__create_deployment']) assert.match(tool, matcher, `${event} ${tool}`);
  }
});

const entry = (hook, decision, reason, minute) => ({ time: new Date(Date.UTC(2026, 10, 8, 10, minute)).toISOString(), session: 's', hook, tool: 'Bash', decision, reason });

test('guard-tiers#AC-7: the report counts asks and refusals per guard and reason, the approved share, and candidates to move down', () => {
  const log = [];
  // 20 force-push asks, 19 approved: a candidate (95% of 20).
  for (let i = 0; i < 20; i++) {
    log.push(entry('guard-commands', 'ask', 'rfr-core (WA-003): force-push rewrites remote history. Approve only if intended.', i));
    if (i < 19) log.push(entry('guard-commands', 'approved', 'rfr-core (WA-003): force-push rewrites remote history. Approve only if intended.', i));
  }
  // 10 test-edit asks on different files, 2 approved: one reason once the paths are set aside.
  for (let i = 0; i < 10; i++) {
    const reason = `rfr-core (TEST-001): tests/f${i}.test.ts is an existing test, and this edit weakens it: expected-literal-changed (line ${i + 3})`;
    log.push(entry('guard-test-edits', 'ask', reason, 30 + i));
    if (i < 2) log.push(entry('guard-test-edits', 'approved', reason, 30 + i));
  }
  log.push(entry('guard-commands', 'deny', 'rfr-core (TEST-001): this command writes to an existing test file, so the change cannot be checked.', 50));
  const r = summarise(log);
  assert.equal(r.asks, 30);
  assert.equal(r.approved, 21);
  assert.equal(r.refusals, 1);
  assert.equal(r.hours, 50 / 60);
  const force = r.reasons.find(x => x.key.includes('force-push'));
  assert.deepEqual([force.hook, force.asks, force.approved, force.share], ['guard-commands', 20, 19, 0.95]);
  const tests = r.reasons.filter(x => x.hook === 'guard-test-edits');
  assert.equal(tests.length, 1, 'file names and line numbers do not split a reason');
  assert.deepEqual([tests[0].asks, tests[0].approved], [10, 2]);
  assert.deepEqual(r.candidates.map(c => c.key), [force.key]);
  const text = formatReport(r);
  assert.match(text, /30 asks, 21 approved \(70%\), 1 refusal/);
  assert.match(text, /Candidates to move down a tier/);
});

test('guard-tiers#AC-7: reason keys set aside paths, numbers, and quoted values; the CLI reads a log file', () => {
  assert.equal(reasonKey('rfr-core (TEST-001): tests/a.test.ts is an existing test, and this edit weakens it: expected-literal-changed (line 7): the value "2" was changed'),
    reasonKey('rfr-core (TEST-001): src/b.spec.js is an existing test, and this edit weakens it: expected-literal-changed (line 40): the value "x" was changed'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-report-'));
  const file = path.join(dir, 'guard-decisions.jsonl');
  fs.writeFileSync(file, [entry('guard-mcp', 'ask', 'rfr-core (NODE-002): mcp__Vercel__x can change or expose your Vercel account.', 0), entry('guard-mcp', 'approved', 'rfr-core (NODE-002): mcp__Vercel__x can change or expose your Vercel account.', 1)].map(l => JSON.stringify(l)).join('\n') + '\nnot json\n');
  const cli = spawnSync(process.execPath, ['checks/guard-report.mjs', file], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /1 asks?, 1 approved \(100%\)/);
  assert.match(cli.stdout, /1 line could not be read/);
  const json = JSON.parse(spawnSync(process.execPath, ['checks/guard-report.mjs', file, '--json'], { encoding: 'utf8' }).stdout);
  assert.equal(json.asks, 1);
  assert.equal(spawnSync(process.execPath, ['checks/guard-report.mjs', path.join(dir, 'missing.jsonl')], { encoding: 'utf8' }).status, 2);
});
