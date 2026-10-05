import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addStock } from '../src/index.js';

test('adds stock', () => {
  assert.equal(addStock('a', 2), 2);
  assert.equal(addStock('a', 3), 5);
});

test('rejects negative quantities', () => {
  assert.throws(() => addStock('b', -1), RangeError);
});
