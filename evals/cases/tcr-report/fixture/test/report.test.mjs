import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLine, summarize } from '../src/report.mjs';

const rows = [
  { user: 'ana', minutes: 30 },
  { user: 'ben', minutes: 45 },
  { user: 'ana', minutes: 15 },
];

test('report#AC-1: counts the rows', () => {
  assert.equal(summarize(rows).count, 3);
});

test('report#AC-2: totals the minutes', () => {
  assert.equal(summarize(rows).totalMinutes, 90);
});

test('report#AC-3: groups minutes by user', () => {
  assert.deepEqual(summarize(rows).byUser, { ana: 45, ben: 45 });
});

test('report#AC-4: formats a line per user', () => {
  assert.equal(formatLine('ana', 45), 'ana: 45 min');
});
