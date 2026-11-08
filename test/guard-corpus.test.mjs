// The guard corpus runner (docs/specs/guard-tiers.md, AC-2). Every case in
// test/fixtures/guard-corpus.json runs through its guard, and the decision must match the case's
// tier (or, for a case a later slice delivers, the tier the guard gives today).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decideCommand } from '../plugins/core/scripts/guard-commands.mjs';
import { decideEdit } from '../plugins/core/scripts/guard-test-edits.mjs';
import { vercelToolNeedsApproval } from '../plugins/web/scripts/guard-mcp.mjs';
import { decideUnreal } from '../plugins/unreal/scripts/guard-unreal.mjs';

const corpus = JSON.parse(fs.readFileSync('test/fixtures/guard-corpus.json', 'utf8'));

function git(dir, ...args) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
}

// A repository with tracked source, a tracked test, a tracked build/ folder, and an ignored dist/.
function fixtureRepo(state) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-corpus-'));
  const write = (f, s) => {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), s);
  };
  write('.gitignore', 'dist/\n');
  write('src/a.js', 'export const a = 1;\n');
  write('build/make.mjs', 'console.log("build");\n');
  write('tests/a.test.ts', "import { test, expect } from 'vitest';\n\ntest('a', () => {\n  expect(1 + 1).toBe(2);\n});\n");
  write('CHANGELOG.md', '# Changelog\n');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'second');
  git(dir, 'checkout', '-q', '-b', 'feature');
  write('dist/app.js', 'built\n');
  if (state === 'dirty') {
    write('src/a.js', 'export const a = 2;\n');
    write('notes.txt', 'untracked\n');
  }
  return dir;
}

// The tier a decision represents: none, or context only (inform), is 1; deny is 2 (or 3 when the
// reason defers to the pull request); ask is 4.
function tierOf(decision) {
  if (!decision || decision.decision === 'inform') return 1;
  if (decision.decision === 'ask') return 4;
  return /say so in your report|pull request decides/i.test(decision.reason ?? '') ? 3 : 2;
}

function decide(c) {
  if (c.guard === 'commands') {
    const dir = fixtureRepo(c.repo);
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-corpus-scratch-'));
    fs.mkdirSync(path.join(scratch, 'wt'));
    return decideCommand(c.command.replace('$TMPCASE', scratch), { cwd: dir });
  }
  if (c.guard === 'mcp') return vercelToolNeedsApproval(c.tool_name, c.tool_input) ? { decision: 'ask' } : null;
  if (c.guard === 'unreal') return decideUnreal(c.command);
  if (c.guard === 'test-edits') {
    const dir = fixtureRepo('clean');
    const file = path.join(dir, 'tests', 'a.test.ts');
    const edit = (old_string, new_string) => decideEdit({ tool_name: 'Edit', cwd: dir, tool_input: { file_path: file, old_string, new_string } });
    if (c.edit === 'branch-line') {
      fs.appendFileSync(file, "\ntest('b', () => {\n  expect(String(2)).toBe('2');\n});\n");
      return edit("expect(String(2)).toBe('2');", "expect(String(3)).toBe('3');");
    }
    if (c.edit === 'additive') return edit('  expect(1 + 1).toBe(2);\n', '  expect(1 + 1).toBe(2);\n  expect(2 + 2).toBe(4);\n');
    if (c.edit === 'weaken-base') return edit('expect(1 + 1).toBe(2);', 'expect(1 + 1).toBe(3);');
  }
  throw new Error(`unknown case shape: ${c.id}`);
}

test('guard-tiers#AC-2: every corpus case gets the decision its tier calls for', () => {
  const ids = new Set();
  const pending = [];
  for (const c of corpus.cases) {
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`);
    ids.add(c.id);
    assert.ok([1, 2, 3, 4].includes(c.tier), `${c.id}: tier`);
    assert.ok(c.source, `${c.id}: source`);
    const expected = c.pending ? c.now : c.tier;
    assert.equal(tierOf(decide(c)), expected, `${c.id}: expected tier ${expected}${c.pending ? ` (target ${c.tier} in ${c.pending})` : ''}`);
    if (c.pending) pending.push(`${c.id} -> ${c.tier} (${c.pending})`);
  }
  // The corpus keeps a dangerous core: these must always ask.
  for (const id of ['force-push', 'rm-outside', 'rm-root-like', 'drizzle-push', 'prisma-reset', 'vercel-deploy', 'edit-weakens-base-test']) {
    assert.equal(corpus.cases.find(c => c.id === id)?.tier, 4, `${id} stays tier 4`);
  }
  console.log(`${corpus.cases.length} corpus cases; ${pending.length} pending a later slice: ${pending.join(', ')}`);
});
