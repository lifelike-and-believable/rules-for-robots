import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listLines } from '../src/shelf.mjs';

test('list shows each book with its author and year', () => {
  assert.deepEqual(listLines([{ title: 'Kindred', author: 'Octavia E. Butler', year: 1979 }]), ['Kindred, by Octavia E. Butler (1979)']);
});
