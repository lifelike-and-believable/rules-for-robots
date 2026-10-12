import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTotal } from '../src/invoices.js';

test('formatTotal shows two decimals', () => {
  assert.equal(formatTotal(5), '$5.00');
});
