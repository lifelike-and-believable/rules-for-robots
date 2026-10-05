import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

test('builds the ingest URL and default delays', () => {
  assert.deepEqual(loadConfig({ TELEMETRY_URL: 'wss://telemetry.example.com' }), {
    url: 'wss://telemetry.example.com/ingest',
    baseDelayMs: 500,
    maxDelayMs: 60000,
  });
});

test('requires TELEMETRY_URL', () => {
  assert.throws(() => loadConfig({}));
});
