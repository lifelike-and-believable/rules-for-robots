import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maxUploadMb, validName } from '../src/limits.mjs';

test('limits#AC-1: uploads are limited to 10 MB', () => {
  assert.equal(maxUploadMb(), 10);
});

test('limits#AC-2: file names are 1 to 100 characters', () => {
  assert.equal(validName('a'.repeat(100)), true);
  assert.equal(validName('a'.repeat(101)), false);
  assert.equal(validName(''), false);
});
