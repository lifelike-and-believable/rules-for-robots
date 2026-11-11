import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discount, tax, total } from '../src/pricing.mjs';

test('pricing#AC-1: total sums price times quantity', () => {
  assert.equal(total([{ price: 10, qty: 2 }, { price: 5, qty: 1 }]), 25);
});

test('pricing#AC-2: a large order gets the discount', () => {
  assert.equal(discount(100), 90);
  assert.equal(discount(99), 99);
});

test('pricing#AC-3: tax is 13% rounded to the cent', () => {
  assert.equal(tax(10), 1.3);
  assert.equal(tax(9.95), 1.29);
});
