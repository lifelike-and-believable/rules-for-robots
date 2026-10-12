import test from 'node:test';
import assert from 'node:assert/strict';
import { currentUser } from '../src/auth.js';
import { cache } from '../src/cache.js';

test('the session names the signed-in user', () => {
  assert.equal(currentUser({ userId: 7 }), 7);
});

test('the cache is a map', () => {
  assert.ok(cache instanceof Map);
});
