import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartTotal } from '../src/cart.js';

test('sums price times quantity', () => {
  assert.equal(cartTotal([{ priceCents: 250, quantity: 2 }, { priceCents: 99, quantity: 1 }]), 599);
});
