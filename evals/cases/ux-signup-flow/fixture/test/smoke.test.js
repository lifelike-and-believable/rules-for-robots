import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('the sign-up page has a form', () => {
  assert.match(fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8'), /<form id="signup">/);
});
