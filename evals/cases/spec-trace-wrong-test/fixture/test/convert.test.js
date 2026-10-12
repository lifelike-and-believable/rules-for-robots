import test from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../src/convert.js';

test('unit-converter#AC-1: converts km to miles', () => {
  assert.equal(convert(10, 'km', 'mi'), 6.2137);
});

test('unit-converter#AC-2: rejects unknown units', () => {
  assert.throws(() => convert(1, 'km', 'parsec'), error => error instanceof RangeError && /parsec/.test(error.message));
});

test('unit-converter#AC-3: zero and negative values', () => {
  assert.equal(convert(0, 'km', 'mi'), 0);
  assert.equal(convert(-10, 'km', 'mi'), -6.21);
});
