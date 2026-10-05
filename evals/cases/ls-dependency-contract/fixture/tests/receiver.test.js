import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Receiver } from '../src/receiver.js';
import { FakeStreamClient } from './fakes/fakeStreamClient.js';

test('queues each delivered frame once', async () => {
  const receiver = new Receiver({});
  receiver.client = new FakeStreamClient();
  await receiver.start('wss://example.test');
  receiver.client.deliver('pose', new Uint8Array([1, 2]));
  assert.equal(receiver.frames.length, 1);
});
