import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('the library header exists', () => {
  assert.match(fs.readFileSync(new URL('../Source/ThumbnailTools/Public/ThumbnailLibrary.h', import.meta.url), 'utf8'), /UThumbnailLibrary/);
});
