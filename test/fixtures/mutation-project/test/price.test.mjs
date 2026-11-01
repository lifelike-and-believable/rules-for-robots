import { test } from 'node:test';
import assert from 'node:assert/strict';
import { total } from '../src/price.mjs';

test('sums price times quantity', () => {
  assert.equal(total([{ price: 10, quantity: 2 }, { price: 5, quantity: 1 }]), 25);
});

test('applies the discount to large orders', () => {
  assert.equal(total([{ price: 200, quantity: 1 }], 0.1), 180);
});
