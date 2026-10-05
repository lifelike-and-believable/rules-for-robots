import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalWithTax } from '../src/tax.js';

test('zero subtotal', () => {
  assert.equal(totalWithTax(0), 0);
});

test('adds HST', () => {
  assert.equal(totalWithTax(100), 115);
});
