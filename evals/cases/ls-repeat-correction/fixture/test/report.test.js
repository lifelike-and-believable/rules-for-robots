import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSessions } from '../src/sessions.js';
import { report } from '../src/report.js';

const CSV = 'date,wall,setter,routes\n2026-10-09,slab,Ben,4\n2026-10-02,cave,Ana,6\n';

test('sessions are listed oldest first with a total', () => {
  const out = report(parseSessions(CSV)).split('\n');
  assert.match(out[0], /^2026-10-02/);
  assert.match(out[1], /^2026-10-09/);
  assert.match(out[2], /^total\s+10$/);
});
