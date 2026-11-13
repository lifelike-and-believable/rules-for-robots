// The settings the template repositories and install-rules write (rewrite plan 25e): no ask rules,
// which prompt even in auto mode; the never-list commands Claude Code's rule syntax can express are
// deny rules instead, so they hold where rfr's hooks are not loaded, without a prompt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const NEVER = ['Bash(git push --force *)', 'PowerShell(git push --force *)', 'Bash(git push origin main)', 'Bash(git push --delete *)', 'Bash(gh repo delete *)', 'Bash(vercel --prod *)', 'Read(./.env)'];

test('unattended#AC-1: the templates and the install-rules payload carry no ask rules, and deny the never-list commands', () => {
  const files = ['templates/repo-files/common/.claude/settings.json', ...['web-app', 'static-site', 'unreal-plugin', 'general'].map(p => `template-repos/${p}/.claude/settings.json`)];
  for (const f of files) {
    const { permissions } = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.equal(permissions.ask, undefined, `${f} has ask rules`);
    for (const rule of NEVER) assert.ok(permissions.deny.includes(rule), `${f}: ${rule}`);
  }
  const payload = JSON.parse(fs.readFileSync('plugins/core/skills/install-rules/payload/permissions.json', 'utf8'));
  assert.equal(payload.ask, undefined);
  for (const rule of NEVER) assert.ok(payload.deny.includes(rule), `payload: ${rule}`);
});

test('unattended#AC-1: install-rules writes no ask rules, and turns rfr\'s own earlier ask rules into deny rules', () => {
  const skill = fs.readFileSync('plugins/core/skills/install-rules/SKILL.md', 'utf8');
  assert.match(skill, /no `ask` rules/);
  assert.match(skill, /move them from `ask` to `deny`/);
});
