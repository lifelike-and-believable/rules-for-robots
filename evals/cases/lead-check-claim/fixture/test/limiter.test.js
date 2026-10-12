import test from 'node:test';
import assert from 'node:assert/strict';
import { recordFailure, isLimited } from '../src/limiter.js';

test('five failures limit an IP', () => {
  for (let i = 0; i < 5; i++) recordFailure('1.2.3.4', 1000);
  assert.equal(isLimited('1.2.3.4', 1000), true);
  assert.equal(isLimited('5.6.7.8', 1000), false);
});
