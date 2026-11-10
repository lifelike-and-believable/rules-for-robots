// The ls-repeat-correction case (improvement plan 19h): a correction given in session 1 is applied
// in session 2 without being repeated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import grade, { followsStyle, writesFile } from '../evals/cases/ls-repeat-correction/grade.mjs';
import { loadCase, splitSessions } from '../evals/run.mjs';

const CASE = 'evals/cases/ls-repeat-correction';

function workspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-ls-repeat-'));
  fs.cpSync(`${CASE}/fixture`, dir, { recursive: true });
  return dir;
}

// A solution with --limit and --since, its error messages written by `message`.
function solve(dir, message) {
  const cli = `#!/usr/bin/env node
import fs from 'node:fs';
import { parseSessions } from './sessions.js';
import { report } from './report.js';

const [command, ...args] = process.argv.slice(2);
const fail = text => { console.error(text); process.exit(1); };
if (command !== 'report') fail('Error: Unknown command. Try: logbook report <file>.');
let limit = null;
let since = null;
const rest = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit') limit = args[++i];
  else if (args[i] === '--since') since = args[++i];
  else rest.push(args[i]);
}
if (limit !== null && !/^[1-9]\\d*$/.test(limit)) fail(${JSON.stringify(message.limit)});
if (since !== null && !/^\\d{4}-\\d{2}-\\d{2}$/.test(since)) fail(${JSON.stringify(message.since)});
const file = rest[0];
if (!file || !fs.existsSync(file)) fail('Error: File not found.');
let sessions = parseSessions(fs.readFileSync(file, 'utf8')).sort((a, b) => a.date.localeCompare(b.date));
if (since) sessions = sessions.filter(s => s.date >= since);
if (limit) sessions = sessions.slice(0, Number(limit));
console.log(report(sessions));
`;
  fs.writeFileSync(path.join(dir, 'src/cli.js'), cli);
}

test('the case loads with two sessions', () => {
  const c = loadCase(CASE);
  assert.equal(c.prompts.length, 3);
  const sessions = splitSessions(c.prompts, c.meta.newSessionAt);
  assert.deepEqual(sessions.map(s => s.length), [2, 1]);
  assert.deepEqual(c.meta.candidates, ['WA-004-delegated']);
  assert.ok(fs.existsSync('evals/candidates/WA-004-delegated.md'));
});

test('the untouched fixture fails, and its existing messages do not follow the corrected style', async () => {
  const dir = workspace();
  const r = await grade({ dir });
  assert.equal(r.pass, false);
  assert.equal(r.checks.sinceWorks, false);
  assert.equal(r.checks.testsGreen, true);
  assert.equal(followsStyle('Error: File not found.'), false);
  assert.equal(r.checks.preferenceRecorded, false);
});

test('both messages in the corrected style pass', async () => {
  const dir = workspace();
  solve(dir, { limit: 'report: limit must be a positive whole number', since: 'report: since must be a date like 2026-10-16' });
  fs.appendFileSync(path.join(dir, 'docs/preferences.md'), '- Error messages read `report: <what went wrong>`, lower case, no full stop (2026-11-10, review).\n');
  const r = await grade({ dir, turns: [
    { session: 0, tools: [{ name: 'Edit', input: { file_path: `${dir}/docs/preferences.md` } }] },
    { session: 1, tools: [{ name: 'Read', input: { file_path: `${dir}/docs/preferences.md` } }] },
  ] });
  assert.deepEqual({ pass: r.pass, ...r.checks }, { pass: true, sinceWorks: true, sinceRejected: true, sinceStyle: true, limitRejected: true, limitStyle: true, testsGreen: true, preferenceRecorded: true, preferencesWrittenInSessionOne: true, sessionTwoReadPreferences: true, sessions: 2 });
});

test('a session 2 message in the old style fails, even when session 1 was corrected', async () => {
  const dir = workspace();
  solve(dir, { limit: 'report: limit must be a positive whole number', since: 'Error: Invalid date. Use YYYY-MM-DD.' });
  const r = await grade({ dir });
  assert.equal(r.checks.sinceWorks, true);
  assert.equal(r.checks.limitStyle, true);
  assert.equal(r.checks.sinceStyle, false);
  assert.equal(r.pass, false);
});

test('the style check and the write detector', () => {
  assert.equal(followsStyle('report: limit must be a positive whole number'), true);
  assert.equal(followsStyle('report: Limit must be positive'), false);
  assert.equal(followsStyle('report: limit must be positive.'), false);
  assert.equal(followsStyle('logbook: limit must be positive'), false);
  assert.equal(writesFile({ name: 'Bash', input: { command: "echo '- x' >> docs/preferences.md" } }, 'docs/preferences.md'), true);
  assert.equal(writesFile({ name: 'Bash', input: { command: 'cat docs/preferences.md' } }, 'docs/preferences.md'), false);
});
