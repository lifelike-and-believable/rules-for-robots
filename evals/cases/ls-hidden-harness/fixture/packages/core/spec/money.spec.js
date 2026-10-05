import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice, parsePrice } from '../src/money.js';

describe('formatPrice', () => {
  it('formats cents as dollars', () => {
    assert.equal(formatPrice(450), '$4.50');
    assert.equal(formatPrice(0), '$0.00');
  });
});

describe('parsePrice', () => {
  it('reads dollars with or without the sign', () => {
    assert.equal(parsePrice('$4.50'), 450);
    assert.equal(parsePrice('12'), 1200);
  });
});
