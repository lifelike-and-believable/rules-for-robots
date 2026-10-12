import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('the contact page has a form', () => {
  assert.match(fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8'), /<form id="contact"/);
});
