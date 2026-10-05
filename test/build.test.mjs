import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { alwaysOnLines, diffOwned, loadProfiles, renderProfile } from '../build/build.mjs';

const META = (id, extra = '') => `---
id: ${id}
title: Example
level: SHOULD
scope: core
verified-by: [review]
targets-failure: project-decision
observed-on: []
rationale: Example.${extra}
---
<!-- not counted -->
Line one.
Line two.
`;

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-build-test-'));
}

test('every profile has an AGENTS.md template', () => {
  for (const name of Object.keys(loadProfiles())) {
    assert.ok(fs.existsSync(path.join('templates', 'agents-md', `${name}.md`)), `missing template for ${name}`);
  }
});

test('always-on lines count AGENTS.md and unscoped rules only', () => {
  const dir = tmpdir();
  const unscoped = path.join(dir, 'TEST-900-a.md');
  const scoped = path.join(dir, 'TEST-901-b.md');
  fs.writeFileSync(unscoped, META('TEST-900'));
  fs.writeFileSync(scoped, META('TEST-901', '\npaths: ["src/**"]'));
  // AGENTS.md: 2 lines after stripping the comment; unscoped rule: 2 header lines + 2 body lines.
  assert.equal(alwaysOnLines('# Title\n<!-- note -->\nText\n', [unscoped, scoped]), 2 + 4);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('renders core plus selected packs and nothing else', () => {
  const root = tmpdir();
  const write = (rel, content) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  };
  write('templates/agents-md/demo.md', '# Demo\n');
  write('rules/core/testing/TEST-900-a.md', META('TEST-900'));
  write('rules/packs/typescript/x/TS-001-b.md', META('TS-001').replace('scope: core', 'scope: pack:typescript'));
  write('rules/packs/unreal-plugin/x/UE-001-c.md', META('UE-001').replace('scope: core', 'scope: pack:unreal-plugin'));

  const dest = path.join(root, 'out');
  const result = renderProfile('demo', { packs: ['typescript', 'static-sites'] }, { rulesRoot: path.join(root, 'rules'), root, dest });
  assert.equal(result.ruleCount, 2);
  assert.equal(fs.readFileSync(path.join(dest, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
  assert.ok(fs.existsSync(path.join(dest, '.claude/rules/core/testing/TEST-900-a.md')));
  assert.ok(fs.existsSync(path.join(dest, '.claude/rules/packs/typescript/x/TS-001-b.md')));
  assert.ok(!fs.existsSync(path.join(dest, '.claude/rules/packs/unreal-plugin')));
  assert.ok(!fs.existsSync(path.join(root, 'rules/packs/static-sites')), 'rendering must not create pack folders');

  // Shared and profile repo files are copied, and a second render replaces everything.
  write('templates/repo-files/common/.github/pull_request_template.md', 'common');
  write('templates/repo-files/demo/ci.yml', 'profile');
  fs.writeFileSync(path.join(dest, 'stale.txt'), 'old');
  renderProfile('demo', { packs: ['typescript'] }, { rulesRoot: path.join(root, 'rules'), root, dest });
  assert.ok(!fs.existsSync(path.join(dest, 'stale.txt')));
  assert.equal(fs.readFileSync(path.join(dest, '.github/pull_request_template.md'), 'utf8'), 'common');
  assert.equal(fs.readFileSync(path.join(dest, 'ci.yml'), 'utf8'), 'profile');
  fs.rmSync(root, { recursive: true, force: true });
});

test('diffOwned reports missing, stale, and unexpected files', () => {
  const a = tmpdir();
  const b = tmpdir();
  fs.writeFileSync(path.join(a, 'AGENTS.md'), 'new');
  fs.writeFileSync(path.join(b, 'AGENTS.md'), 'old');
  fs.writeFileSync(path.join(a, 'CLAUDE.md'), '@AGENTS.md\n');
  fs.mkdirSync(path.join(b, '.claude/rules'), { recursive: true });
  fs.writeFileSync(path.join(b, '.claude/rules/extra.md'), 'x');
  assert.deepEqual(diffOwned(a, b).sort(), ['missing CLAUDE.md', 'stale AGENTS.md', 'unexpected .claude/rules/extra.md']);
  fs.rmSync(a, { recursive: true, force: true });
  fs.rmSync(b, { recursive: true, force: true });
});

test('payload holds every rule and the profile map', async () => {
  const { renderPayload } = await import('../build/build.mjs');
  const root = tmpdir();
  const write = (rel, content) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  };
  write('build/profiles.json', '{"demo": {"packs": ["typescript"]}}');
  write('rules/core/testing/TEST-900-a.md', META('TEST-900'));
  write('rules/packs/unreal-plugin/x/UE-001-c.md', META('UE-001'));
  const dest = path.join(root, 'payload');
  fs.mkdirSync(dest);
  fs.writeFileSync(path.join(dest, 'stale.md'), 'old');
  assert.equal(renderPayload({ rulesRoot: path.join(root, 'rules'), root, dest }), 2);
  assert.ok(fs.existsSync(path.join(dest, 'rules/core/testing/TEST-900-a.md')));
  assert.ok(fs.existsSync(path.join(dest, 'rules/packs/unreal-plugin/x/UE-001-c.md')));
  assert.ok(fs.existsSync(path.join(dest, 'profiles.json')));
  assert.ok(!fs.existsSync(path.join(dest, 'stale.md')));
  fs.rmSync(root, { recursive: true, force: true });
});
