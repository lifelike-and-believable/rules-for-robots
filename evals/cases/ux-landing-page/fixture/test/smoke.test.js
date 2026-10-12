import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('the landing page has a heading', () => {
  assert.match(fs.readFileSync(new URL('../site/index.html', import.meta.url), 'utf8'), /<h1>/);
});
