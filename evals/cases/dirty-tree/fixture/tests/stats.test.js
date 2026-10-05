import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mean } from '../src/mean.js';
import { median } from '../src/median.js';

test('mean of values', () => {
  assert.equal(mean([2, 4, 6]), 4);
});

test('median of odd-length list', () => {
  assert.equal(median([3, 1, 2]), 2);
});

test('median of even-length list', () => {
  assert.equal(median([4, 1, 3, 2]), 2.5);
});
