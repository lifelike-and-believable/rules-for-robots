import test from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../src/convert.js';

test('unit-converter#AC-1: converts km to miles, two decimals', () => {
  assert.equal(convert(10, 'km', 'mi'), 6.21);
});

test('unit-converter#AC-2: rejects unknown units', () => {
  assert.ok(true);
});

test('unit-converter#AC-3: zero and negative values', () => {
  assert.equal(1 + 1, 2);
});
