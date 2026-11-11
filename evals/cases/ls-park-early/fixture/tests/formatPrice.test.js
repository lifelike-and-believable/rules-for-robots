import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice } from '../src/formatPrice.js';

test('formatPrice', () => {
  assert.equal(formatPrice(12), '$12.00');
  assert.equal(formatPrice(1234.5), '$1,234.50');
  assert.equal(formatPrice(0.5), '$0.05');
});
