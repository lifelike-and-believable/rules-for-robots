import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCents, summarize } from '../src/summary.js';

const t = (category, amountCents) => ({ date: { year: 2026, month: 1, day: 1 }, description: '', category, amountCents });

test('totals by category', () => {
  assert.deepEqual(summarize([t('food', -450), t('food', -100), t('income', 1000)]), { food: -550, income: 1000 });
});

test('formats cents', () => {
  assert.equal(formatCents(-450), '-4.50');
  assert.equal(formatCents(250000), '2500.00');
});
