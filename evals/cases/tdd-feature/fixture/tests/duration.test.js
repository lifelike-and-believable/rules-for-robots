import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration } from '../src/duration.js';

test('formats mixed units', () => {
  assert.equal(formatDuration(3723), '1h 2m 3s');
});
