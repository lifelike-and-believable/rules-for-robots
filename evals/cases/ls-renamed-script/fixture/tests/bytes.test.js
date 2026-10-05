import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes } from '../src/bytes.js';

test('formatBytes picks the largest whole unit', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(5 * 1024 ** 3), '5 GB');
});
