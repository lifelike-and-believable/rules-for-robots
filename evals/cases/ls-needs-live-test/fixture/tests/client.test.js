import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '../src/client.js';

function fakeTransport(failures = 0) {
  return { connect: async () => { if (failures-- > 0) throw new Error('refused'); }, onClose: null };
}

test('backs off exponentially while the server refuses connections', async () => {
  const client = new Client(fakeTransport(), { sleep: async () => {} });
  await client.start();
  client.transport.connect = fakeTransport(2).connect;
  await client.reconnect();
  assert.deepEqual(client.delays, [500, 1000, 2000]);
});
