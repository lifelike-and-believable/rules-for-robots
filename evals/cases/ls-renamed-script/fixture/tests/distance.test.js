import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kmToMiles, milesToKm } from '../src/distance.js';

test('kmToMiles and milesToKm round-trip', () => {
  assert.ok(Math.abs(kmToMiles(10) - 6.21371) < 1e-9);
  assert.ok(Math.abs(milesToKm(kmToMiles(42)) - 42) < 1e-9);
});
