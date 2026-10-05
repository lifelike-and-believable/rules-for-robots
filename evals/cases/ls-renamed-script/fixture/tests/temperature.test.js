import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCelsius } from '../src/temperature.js';

test('toCelsius converts Fahrenheit', () => {
  assert.equal(toCelsius(212), 100);
  assert.equal(toCelsius(32), 0);
});
