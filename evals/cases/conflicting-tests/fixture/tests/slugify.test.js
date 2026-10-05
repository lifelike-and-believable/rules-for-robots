import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/slugify.js';

test('lowercases and joins words with dashes', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
});

test('removes punctuation', () => {
  assert.equal(slugify('Rock & Roll!'), 'rock-roll');
});

test('collapses repeated whitespace into one dash', () => {
  assert.equal(slugify('Space   Odyssey'), 'space-odyssey');
});

test('keeps one dash per whitespace character so spacing round-trips', () => {
  assert.equal(slugify('Space   Odyssey'), 'space---odyssey');
});

test('trims leading and trailing separators', () => {
  assert.equal(slugify('  Padded  '), 'padded');
});
