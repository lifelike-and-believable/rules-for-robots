import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkChangelog } from '../checks/release.mjs';

const changelog = (...versions) => [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  ...versions.flatMap(v => [`## [${v}] - 2026-10-05`, '', '- Something.', '']),
].join('\n');

test('accepts a changelog whose newest release matches the plugin version', () => {
  assert.deepEqual(checkChangelog(changelog('0.11.0', '0.10.0'), '0.11.0'), []);
});

test('rejects a plugin version with no changelog entry', () => {
  const errors = checkChangelog(changelog('0.10.0'), '0.11.0');
  assert.ok(errors.some(e => e.includes('0.11.0')), errors.join('; '));
});

test('rejects releases out of order', () => {
  const errors = checkChangelog(changelog('0.10.0', '0.11.0'), '0.10.0');
  assert.ok(errors.some(e => e.includes('order')), errors.join('; '));
});

test('rejects a duplicate release heading', () => {
  const errors = checkChangelog(changelog('0.11.0', '0.11.0'), '0.11.0');
  assert.ok(errors.some(e => e.includes('duplicate')), errors.join('; '));
});

test('requires an Unreleased section', () => {
  const errors = checkChangelog(changelog('0.11.0').replace('## [Unreleased]\n', ''), '0.11.0');
  assert.ok(errors.some(e => e.includes('Unreleased')), errors.join('; '));
});

test('the repository changelog matches the rfr-core plugin version', () => {
  const plugin = JSON.parse(fs.readFileSync('plugins/core/.claude-plugin/plugin.json', 'utf8'));
  assert.deepEqual(checkChangelog(fs.readFileSync('CHANGELOG.md', 'utf8'), plugin.version), []);
});
