// The decision queue (docs/improvement-plan.md, slice 19c): questions for the project lead as issues
// labelled needs-lead, each with options, a default, and the date the default takes effect.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { ask, close, effectiveDate, findAnswer, formatBody, formatList, LABEL, list, MARKER, parseBody, stateOf } from '../plugins/core/scripts/decisions.mjs';

const options = [{ label: 'A', text: 'Keep the old URL and redirect' }, { label: 'B', text: 'Drop the old URL' }];
const today = new Date('2026-11-10T12:00:00Z');

test('a question round-trips through the issue body', () => {
  const body = formatBody({ question: 'Keep the old chapter URLs?', options, defaultLabel: 'A', effective: '2026-11-12', context: 'PR #40' });
  assert.ok(body.startsWith(MARKER));
  assert.deepEqual(parseBody(body), { question: 'Keep the old chapter URLs?', options, defaultLabel: 'A', effective: '2026-11-12', irreversible: false });
  assert.equal(parseBody('a plain issue'), null);
});

test('an irreversible question has no default, and a default must be an option', () => {
  const body = formatBody({ question: 'Delete the old bucket?', options, irreversible: true });
  assert.equal(parseBody(body).irreversible, true);
  assert.equal(parseBody(body).defaultLabel, null);
  assert.throws(() => formatBody({ question: 'q', options, irreversible: true, defaultLabel: 'A' }), /no default/);
  assert.throws(() => formatBody({ question: 'q', options, defaultLabel: 'C', effective: '2026-11-12' }), /not one of the options/);
  assert.throws(() => formatBody({ question: 'q', options: [] }), /at least one option/);
});

test('the answer is the latest comment naming an option or starting "Answer:"', () => {
  assert.equal(findAnswer([{ body: 'B', author: 'lead' }], options).label, 'B');
  assert.equal(findAnswer([{ body: 'option a, since links are shared', author: 'lead' }], options).label, 'A');
  assert.equal(findAnswer([{ body: 'B' }, { body: 'Actually A' }], options), null, 'the latest comment that answers counts; "Actually A" does not');
  assert.equal(findAnswer([{ body: 'A' }, { body: 'Answer: neither, use a 410' }], options).text, 'neither, use a 410');
  assert.equal(findAnswer([{ body: `${MARKER}\nApplied: A` }], options), null, "the queue's own comments are not answers");
  assert.equal(findAnswer([{ body: 'B', author: 'ci[bot]' }], options), null);
  assert.equal(findAnswer([{ body: 'Bananas' }], options), null);
});

test('state: answered, due once the date passes, and waiting otherwise; no default never falls due', () => {
  const issue = (body, comments = []) => ({ number: 7, title: 't', body, comments });
  const withDefault = formatBody({ question: 'q', options, defaultLabel: 'A', effective: '2026-11-10' });
  assert.equal(stateOf(issue(withDefault), today).state, 'due');
  assert.equal(stateOf(issue(withDefault), new Date('2026-11-09T12:00:00Z')).state, 'waiting');
  assert.equal(stateOf(issue(withDefault, [{ body: 'B' }]), today).state, 'answered');
  const noDefault = formatBody({ question: 'q', options, irreversible: true });
  assert.equal(stateOf(issue(noDefault), new Date('2027-01-01')).state, 'waiting');
  assert.equal(stateOf(issue('not a decision'), today), null);
});

test('ask, list, and close drive gh with the needs-lead label', () => {
  const calls = [];
  const listed = [{ number: 3, title: 'Decision needed: q', body: formatBody({ question: 'q', options, defaultLabel: 'A', effective: '2026-11-11' }), comments: [{ body: 'B', author: { login: 'lead' } }] },
    { number: 4, title: 'other', body: 'not a decision', comments: [] }];
  const run = (cmd, args) => {
    calls.push(args);
    if (args[0] === 'issue' && args[1] === 'create') return { status: 0, stdout: 'https://github.com/o/r/issues/3\n' };
    if (args[0] === 'issue' && args[1] === 'list') return { status: 0, stdout: JSON.stringify(listed) };
    if (args[0] === 'label') return { status: 1, stderr: 'already exists' };
    return { status: 0, stdout: '' };
  };
  assert.equal(ask({ question: 'q', options, defaultLabel: 'A', repo: 'o/r' }, { run, today }), 'https://github.com/o/r/issues/3');
  const create = calls.find(a => a[1] === 'create' && a[0] === 'issue');
  assert.ok(create.includes(LABEL) && create.includes('o/r'));
  assert.match(create[create.indexOf('--body') + 1], /takes effect 2026-11-12/);
  const items = list({ repo: 'o/r', run, today });
  assert.deepEqual(items.map(i => [i.number, i.state, i.answer.label, i.answer.author]), [[3, 'answered', 'B', 'lead']]);
  assert.match(formatList(items), /#3 \[answered\] q[\s\S]*A \(default\)[\s\S]*Answer from lead: B/);
  close(3, 'B: dropped the old URL', { repo: 'o/r', run });
  const closing = calls.at(-1);
  assert.deepEqual(closing.slice(0, 3), ['issue', 'close', '3']);
  assert.ok(closing[4].startsWith(MARKER));
  assert.equal(formatList([]), 'No open questions for the project lead.');
  assert.equal(effectiveDate(2, today), '2026-11-12');
});

test('the command line refuses a question with neither a default nor --irreversible', () => {
  const r = spawnSync(process.execPath, ['plugins/core/scripts/decisions.mjs', 'ask', '--question', 'q', '--option', 'A=x'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.equal(spawnSync(process.execPath, ['plugins/core/scripts/decisions.mjs', 'nope'], { encoding: 'utf8' }).status, 2);
});
