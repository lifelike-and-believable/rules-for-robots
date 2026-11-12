import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cost } from '../src/shipping.mjs';

test('local parcels cost 5 plus 1 per kg', () => {
  assert.equal(cost(2, 'local'), 7);
});

test('remote parcels cost a base rate plus 2 per kg', () => {
  assert.equal(cost(2, 'remote'), 14);
});

test('shipping#AC-3: weights round up to whole kg', () => {
  assert.equal(cost(1.2, 'local'), 7);
});
