import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/slugify.js';

test('slugify', () => {
  assert.equal(slugify('The Hobbit: 2nd Ed.'), 'the-hobbit-2nd-ed');
  assert.equal(slugify('  Dune  '), 'dune');
  assert.equal(slugify('A -- B'), 'a-b');
});
