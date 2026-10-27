import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { lintInstructions } from '../checks/ci/instruction-lint.mjs';

function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-instr-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  return root;
}

const PKG = JSON.stringify({ scripts: { verify: 'x', build: 'y' } });

test('passes when named paths and npm scripts exist', () => {
  const root = repo({ 'package.json': PKG, 'scripts/verify.sh': '', 'docs/a.md': '' });
  const text = 'Run `npm run verify` or `npm run build`. See `scripts/verify.sh`, `docs/a.md`, and `docs/`.';
  assert.deepEqual(lintInstructions(text, { root }).errors, []);
});

test('reports a missing repo path and a missing npm script', () => {
  const root = repo({ 'package.json': PKG });
  const { errors } = lintInstructions('Run `npm run test:e2e`, then `scripts/verify.sh`.', { root });
  assert.ok(errors.some(e => e.includes('scripts/verify.sh')), errors.join('\n'));
  assert.ok(errors.some(e => e.includes('test:e2e')), errors.join('\n'));
});

test('accepts a path or file name relative to a folder named nearby', () => {
  const root = repo({ 'package.json': PKG, 'plugins/core/.claude-plugin/plugin.json': '{}', 'templates/repo-files/common/a.md': '' });
  const text = 'Bump `version` in `plugin.json`; `templates/repo-files/` holds `common/`; see `.claude-plugin/plugin.json`.';
  assert.deepEqual(lintInstructions(text, { root }).errors, []);
  assert.ok(lintInstructions('See `ThirdParty/open3dstream/include/o3ds/model.h`.', { root }).errors.length === 1);
});

test('ignores placeholders, globs, URLs, generated folders, identifiers, and fenced code', () => {
  const root = repo({ 'package.json': PKG });
  const text = [
    'Use `<PluginDir>/X.uplugin`, `**/*.ts`, `https://example.com/a/b`, `node_modules/next/dist/docs/`,',
    '`EngineIncludeOrderVersion.Latest`, `BuildSettingsVersion.V6`, `UE_5.6`, `$env:UE_ROOT/x.md`.',
    '```', 'cat missing/file.md', '```',
  ].join('\n');
  assert.deepEqual(lintInstructions(text, { root }).errors, []);
});

test('warns about absolute paths and MCP tool names it cannot check', () => {
  const root = repo({ 'package.json': PKG });
  const { errors, warnings } = lintInstructions('Source at `E:\\OtherProjects\\lib` and `/opt/lib/x.h`; search with `mcp__exa__web_search_exa`.', { root });
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 3, warnings.join('\n'));
});

test('the CLI lints AGENTS.md and CLAUDE.md and exits 1 on errors', () => {
  const root = repo({ 'package.json': PKG, 'AGENTS.md': 'Run `npm run nope`.', 'CLAUDE.md': '@AGENTS.md\n' });
  const run = spawnSync(process.execPath, [path.resolve('checks/ci/instruction-lint.mjs')], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stderr, /AGENTS\.md.*nope/);
});

test("this repository's instruction files pass", () => {
  const run = spawnSync(process.execPath, ['checks/ci/instruction-lint.mjs'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});
