// The guard decision report (docs/specs/guard-tiers.md, AC-7). Outcome logging (AC-6) was removed
// with the prompts it recorded (rewrite plan 25e).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { summarise, formatReport, reasonKey } from '../checks/guard-report.mjs';

test('plugin-split#AC-6: the report reads several plugins\' logs together', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-report-'));
  const core = path.join(dir, 'core.jsonl');
  const web = path.join(dir, 'web.jsonl');
  fs.writeFileSync(core, `${JSON.stringify(entry('guard-commands', 'ask', 'rfr-core (WA-003): force-push rewrites remote history.', 0))}\n`);
  fs.writeFileSync(web, [entry('guard-mcp', 'ask', 'rfr-core (NODE-002): mcp__Vercel__x can change or expose your Vercel account.', 5), entry('guard-mcp', 'approved', 'rfr-core (NODE-002): mcp__Vercel__x can change or expose your Vercel account.', 6)].map(l => JSON.stringify(l)).join('\n') + '\n');
  const cli = spawnSync(process.execPath, ['checks/guard-report.mjs', core, web, '--json'], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  const r = JSON.parse(cli.stdout);
  assert.deepEqual([r.asks, r.approved], [2, 1]);
  assert.deepEqual(r.reasons.map(x => x.hook).sort(), ['guard-commands', 'guard-mcp']);
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
