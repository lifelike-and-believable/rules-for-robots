import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from '../src/page.js';

test('the page lists note bodies', () => {
  assert.match(renderPage([{ body: 'hello' }]), /<li>hello<\/li>/);
});
