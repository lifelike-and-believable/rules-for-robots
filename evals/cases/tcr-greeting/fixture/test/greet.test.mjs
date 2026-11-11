import { test } from 'node:test';
import assert from 'node:assert/strict';
import { farewell, greeting } from '../src/greet.mjs';

test('greet#AC-1: the greeting names the visitor', () => {
  assert.equal(greeting('Ada'), 'Hello, Ada!');
});

test('greet#AC-2: the farewell reads Goodbye with the name', () => {
  assert.equal(farewell('Ada'), 'Goodbye, Ada.');
});
