import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrame } from '../src/frame.js';

test('parses type and payload', () => {
  assert.deepEqual(parseFrame('pose:1.0,2.0,0.5\n'), { type: 'pose', payload: '1.0,2.0,0.5' });
});

test('rejects a line without a type', () => {
  assert.throws(() => parseFrame('no-separator'));
});
