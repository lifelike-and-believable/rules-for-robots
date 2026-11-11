// The general profile (docs/specs/android-plugin.md, slice 24a): rfr-core only, for projects that are
// neither web, Unreal, nor Android, with neutral process templates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseArtifact } from '../checks/lib/process.mjs';

const read = f => fs.readFileSync(f, 'utf8');
const profiles = JSON.parse(read('build/profiles.json'));

test('android-plugin#AC-6: build/profiles.json has general, with rfr-core only and no packs', () => {
  assert.deepEqual(profiles.general.packs, []);
  assert.deepEqual(profiles.general.plugins, ['rfr-core']);
  assert.equal(profiles.general.permissions, undefined, 'only the shared allow rules');
});

test('android-plugin#AC-6: the rendered general template enables rfr-core alone and carries the core rules only', () => {
  const dir = 'template-repos/general';
  const settings = JSON.parse(read(path.join(dir, '.claude/settings.json')));
  assert.deepEqual(settings.enabledPlugins, { 'rfr-core@rules-for-robots': true });
  assert.ok(fs.existsSync(path.join(dir, '.claude/rules/core')));
  assert.ok(!fs.existsSync(path.join(dir, '.claude/rules/packs')), 'no stack packs');
  assert.equal(read(path.join(dir, 'AGENTS.md')), read('templates/agents-md/general.md'));
  assert.ok(fs.existsSync(path.join(dir, 'docs/preferences.md')));
  assert.ok(fs.existsSync(path.join(dir, '.github/pull_request_template.md')));
});

test('android-plugin#AC-7: the general process templates are drafts, and the tutorial runner is manual', () => {
  const base = 'plugins/process/templates/profiles/general';
  const files = ['personas/primary-user.md', 'personas/maintainer.md', 'user-doc.md', 'tutorial.md'];
  for (const f of files) {
    const { front } = parseArtifact(read(path.join(base, f)));
    assert.equal(front?.status, 'draft', f);
    assert.ok(front?.id, f);
  }
  assert.match(read(path.join(base, 'tutorial.md')), /^runner: manual$/m);
  for (const p of ['personas/primary-user.md', 'personas/maintainer.md']) assert.match(read(path.join(base, p)), /concept#audience/, p);
});

test('android-plugin#AC-8: install-rules and setup offer general when no other profile fits', () => {
  assert.match(read('plugins/core/skills/install-rules/SKILL.md'), /none of these[^\n]*`general`/);
  assert.match(read('plugins/process/skills/setup/SKILL.md'), /anything else[^\n]*`general`/);
});
