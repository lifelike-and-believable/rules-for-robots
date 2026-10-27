#!/usr/bin/env node
// Release checks (Phase 9): CHANGELOG.md has an Unreleased section, its releases are in
// descending order without duplicates, and the newest release matches the rfr-core
// plugin version.
// Usage: node checks/release.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const RELEASE = /^## \[(\d+)\.(\d+)\.(\d+)\]/gm;

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export function checkChangelog(text, pluginVersion) {
  const errors = [];
  if (!/^## \[Unreleased\]/m.test(text)) errors.push('CHANGELOG.md needs an "## [Unreleased]" section');
  const releases = [...text.matchAll(RELEASE)].map(m => [Number(m[1]), Number(m[2]), Number(m[3])]);
  const names = releases.map(r => r.join('.'));
  if (!releases.length) errors.push('CHANGELOG.md has no releases');
  for (let i = 1; i < releases.length; i++) {
    const order = compare(releases[i - 1], releases[i]);
    if (order === 0) errors.push(`duplicate release ${names[i]}`);
    else if (order < 0) errors.push(`releases out of order: ${names[i - 1]} is listed before ${names[i]}`);
  }
  if (releases.length && names[0] !== pluginVersion) {
    errors.push(`plugin version ${pluginVersion} has no changelog entry (newest release is ${names[0]})`);
  }
  return errors;
}

function main() {
  const plugin = JSON.parse(fs.readFileSync('plugins/core/.claude-plugin/plugin.json', 'utf8'));
  const errors = checkChangelog(fs.readFileSync('CHANGELOG.md', 'utf8'), plugin.version);
  for (const e of errors) console.error(e);
  if (errors.length) process.exit(1);
  console.log(`CHANGELOG.md matches rfr-core ${plugin.version}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
