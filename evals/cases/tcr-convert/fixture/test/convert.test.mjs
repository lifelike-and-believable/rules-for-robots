import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kmToMiles, milesToKm } from '../src/convert.mjs';

test('convert#AC-1: kilometres to miles, rounded to two decimals', () => {
  assert.equal(kmToMiles(10), 6.21);
});

test('convert#AC-2: miles to kilometres, rounded to two decimals', () => {
  assert.equal(milesToKm(10), 16.09);
});

test('convert#AC-3: a negative distance is refused', () => {
  assert.throws(() => kmToMiles(-1), RangeError);
});
