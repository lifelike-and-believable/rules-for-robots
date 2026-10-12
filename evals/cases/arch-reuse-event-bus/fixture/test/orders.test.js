import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrder, markShipped } from '../src/orders.js';
import { auditLog } from '../src/audit.js';

test('shipping an order is audited', () => {
  createOrder(1, 'a@example.com', ['book']);
  markShipped(1);
  assert.deepEqual(auditLog.map(e => e.event), ['order.created', 'order.shipped']);
});
