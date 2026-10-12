import test from 'node:test';
import assert from 'node:assert/strict';
import { clean } from '../src/clean.js';

test('clean is a function', () => {
  assert.equal(typeof clean, 'function');
});
