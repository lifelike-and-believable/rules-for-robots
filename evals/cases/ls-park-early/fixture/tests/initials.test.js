import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initials } from '../src/initials.js';

test('initials', () => {
  assert.equal(initials('ursula k. le guin'), 'UKLG');
  assert.equal(initials('Ada Lovelace'), 'AL');
});
