import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice, addTax } from '../src/price.js';

test('formats whole dollars', () => {
  assert.equal(formatPrice(5), '$5.00');
});

test('adds tax', () => {
  assert.equal(addTax(100, 0.13), 113);
});
