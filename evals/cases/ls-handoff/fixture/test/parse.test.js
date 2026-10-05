import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, parseCsv, parseDate } from '../src/parse.js';

test('parses ISO dates', () => {
  assert.deepEqual(parseDate('2026-01-03'), { year: 2026, month: 1, day: 3 });
});

test('parses amounts to cents', () => {
  assert.equal(parseAmount('-4.50'), -450);
  assert.equal(parseAmount('2500'), 250000);
  assert.equal(parseAmount('0.5'), 50);
});

test('parses quoted fields and skips the trailing blank line', () => {
  const rows = parseCsv('date,description,category,amount\n2026-01-03,"Bar, Coffee",food,-4.50\n\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].description, 'Bar, Coffee');
  assert.equal(rows[0].amountCents, -450);
});
