// Default permission rules (WA-009, practices/security-for-agentic-projects.md#asking-once-for-a-batch).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadProfiles, mergePermissions, renderPayload, renderProfile } from '../build/build.mjs';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const shared = readJson('templates/repo-files/common/.claude/settings.json').permissions;

test('mergePermissions keeps the shared entries first and adds only new ones', () => {
  const merged = mergePermissions({ allow: ['A', 'B'], deny: ['D'] }, { allow: ['B', 'C'], ask: ['Q'] });
  assert.deepEqual(merged, { allow: ['A', 'B', 'C'], deny: ['D'], ask: ['Q'] });
  assert.deepEqual(mergePermissions(undefined, { allow: ['A'] }), { allow: ['A'] });
});

test('every rendered template allows the shared and profile rules and keeps the deny rules', () => {
  for (const [name, profile] of Object.entries(loadProfiles())) {
    const expected = mergePermissions(shared, profile.permissions);
    assert.deepEqual(readJson(`template-repos/${name}/.claude/settings.json`).permissions, expected, `template-repos/${name}`);
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), `rfr-perms-${name}-`));
    renderProfile(name, profile, { dest });
    assert.deepEqual(readJson(path.join(dest, '.claude', 'settings.json')).permissions, expected, `render ${name}`);
    assert.ok(expected.deny.includes('Read(./.env)'), name);
  }
});

test('the defaults allow nothing that changes a remote, adds a dependency, or runs any npm script', () => {
  const all = Object.values(loadProfiles()).flatMap(p => mergePermissions(shared, p.permissions).allow);
  for (const rule of all) {
    assert.doesNotMatch(rule, /git push|npm install|npm i |npm run \*|^Bash$|^Bash\(\*\)$|^PowerShell$|^mcp__/, rule);
  }
  // Each shell rule is written for both shell tools, because Bash rules do not cover PowerShell.
  const shell = all.filter(r => /^(Bash|PowerShell)\(/.test(r));
  for (const rule of shell) {
    const other = rule.startsWith('Bash(') ? rule.replace(/^Bash/, 'PowerShell') : rule.replace(/^PowerShell/, 'Bash');
    assert.ok(all.includes(other), `${rule} has no ${other}`);
  }
});

test('the install-rules payload carries the shared permission rules', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-perms-payload-'));
  renderPayload({ dest });
  assert.deepEqual(readJson(path.join(dest, 'permissions.json')), shared);
  assert.deepEqual(readJson('plugins/core/skills/install-rules/payload/permissions.json'), shared);
  assert.match(fs.readFileSync('plugins/core/skills/install-rules/SKILL.md', 'utf8'), /permissions\.json/);
});

test('the reference projects carry the defaults for their profiles', () => {
  const profiles = loadProfiles();
  for (const name of ['web-app', 'unreal-plugin']) {
    const { allow } = readJson(`examples/${name}/.claude/settings.json`).permissions;
    for (const rule of mergePermissions(shared, profiles[name].permissions).allow) assert.ok(allow.includes(rule), `${name}: ${rule}`);
  }
});
