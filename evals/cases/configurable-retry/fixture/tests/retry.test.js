import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retry } from '../src/retry.js';

test('returns the first success', async () => {
  let calls = 0;
  assert.equal(await retry(async () => { calls++; if (calls < 2) throw new Error('x'); return 'ok'; }), 'ok');
  assert.equal(calls, 2);
});
