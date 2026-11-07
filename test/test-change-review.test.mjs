// Tests for the test-change classifier and the session hooks that use it
// (docs/specs/test-change-review.md, slice 13a). Each test title cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyTestChange } from '../checks/lib/test-diff.mjs';
import { decideCommand } from '../plugins/core/scripts/guard-commands.mjs';
import { decideEdit } from '../plugins/core/scripts/guard-test-edits.mjs';

const SCRIPTS = path.resolve('plugins/core/scripts');
const runHook = (script, input) => spawnSync(process.execPath, [path.join(SCRIPTS, script)], { input: JSON.stringify(input), encoding: 'utf8' });

const js = (file, before, after) => classifyTestChange({ file, before, after });
const kinds = r => r.findings.map(f => f.kind);
function weakens(r, kind, line) {
  assert.equal(r.result, 'weakening', JSON.stringify(r));
  const f = r.findings.find(x => x.kind === kind);
  assert.ok(f, `expected a ${kind} finding, got ${kinds(r).join(', ')}`);
  if (line !== undefined) assert.equal(f.line, line, `${kind} line`);
}

const BASE = `import { describe, expect, test } from 'vitest';
import { parse } from '../src/parse';

describe('parse', () => {
  test('reads a number', () => {
    expect(parse('1')).toBe(1);
    expect(parse('2')).toBe(2);
  });

  test('rejects text', () => {
    expect(() => parse('x')).toThrow('not a number');
  });
});
`;
const edit = (from, to) => BASE.replace(from, to);

test('test-change-review#AC-1: each way a JavaScript change weakens a test is reported with its line', () => {
  weakens(js('t.test.ts', BASE, edit(/\n  test\('rejects text'[\s\S]*?\n  \}\);\n/, '\n')), 'test-removed', 10);
  weakens(js('t.test.ts', BASE, edit("    expect(parse('2')).toBe(2);\n", '')), 'fewer-assertions', 5);
  weakens(js('t.test.ts', BASE, edit("test('rejects text'", "test.skip('rejects text'")), 'skip-added', 10);
  weakens(js('t.test.ts', BASE, edit("test('rejects text'", "test.only('rejects text'")), 'skip-added', 10);
  weakens(js('t.test.ts', BASE, edit("  test('rejects text', () => {\n    expect(() => parse('x')).toThrow('not a number');\n  });", "  // test('rejects text', () => {\n  //   expect(() => parse('x')).toThrow('not a number');\n  // });")), 'test-commented-out');
  weakens(js('t.test.ts', BASE, edit("expect(parse('1')).toBe(1);", "expect(parse('1')).toBeTruthy();")), 'looser-matcher', 6);
  weakens(js('t.test.ts', BASE, edit(".toThrow('not a number')", '.toThrow()')), 'looser-matcher', 11);
  weakens(js('t.test.ts', BASE, edit("expect(parse('2')).toBe(2);", "expect(parse('2')).toBe(3);")), 'expected-literal-changed', 7);
  weakens(js('t.test.ts', BASE, edit("import { parse } from '../src/parse';", "import { parse } from '../src/parse';\nvi.mock('../src/parse');")), 'module-mocked', 3);
  weakens(js('t.test.ts', BASE, edit("    expect(() => parse('x')).toThrow('not a number');", "    try { expect(() => parse('x')).toThrow('not a number'); } catch {}")), 'error-swallowed', 11);

  const timing = "test('loads', async () => {\n  expect(await load()).toBeCloseTo(0.5, 3);\n}, 1000);\n";
  weakens(js('t.test.ts', timing, timing.replace('1000', '5000')), 'loosened-number', 3);
  weakens(js('t.test.ts', timing, timing.replace('0.5, 3', '0.5, 1')), 'loosened-number', 2);

  const table = "test.each([\n  [1, 2],\n  [2, 3],\n  [0, 1],\n])('adds one to %i', (a, b) => {\n  expect(a + 1).toBe(b);\n});\n";
  weakens(js('t.test.ts', table, table.replace('  [0, 1],\n', '')), 'cases-removed', 1);

  const inline = "test('shape', () => {\n  expect(shape()).toMatchInlineSnapshot(`{ \"a\": 1 }`);\n});\n";
  weakens(js('t.test.ts', inline, inline.replace('"a": 1', '"a": 2')), 'inline-snapshot-changed', 2);
});

const PY = `import pytest
from shop.cart import total


def test_total_sums_prices():
    assert total([1, 2]) == 3
    assert total([]) == 0


@pytest.mark.parametrize("items,expected", [
    ([1], 1),
    ([2, 2], 4),
])
def test_total_table(items, expected):
    assert total(items) == expected


def test_rejects_negative():
    with pytest.raises(ValueError, match="negative"):
        total([-1])
`;
const pyEdit = (from, to) => PY.replace(from, to);

test('test-change-review#AC-1: each way a Python change weakens a test is reported with its line', () => {
  weakens(js('tests/test_cart.py', PY, pyEdit('    assert total([]) == 0\n', '')), 'fewer-assertions', 5);
  weakens(js('tests/test_cart.py', PY, pyEdit('def test_rejects_negative', '@pytest.mark.skip\ndef test_rejects_negative')), 'skip-added');
  weakens(js('tests/test_cart.py', PY, pyEdit('def test_rejects_negative', '@pytest.mark.xfail\ndef test_rejects_negative')), 'skip-added');
  weakens(js('tests/test_cart.py', PY, pyEdit('assert total([1, 2]) == 3', 'assert total([1, 2])')), 'looser-matcher', 6);
  weakens(js('tests/test_cart.py', PY, pyEdit('pytest.raises(ValueError, match="negative")', 'pytest.raises(Exception)')), 'looser-matcher', 19);
  weakens(js('tests/test_cart.py', PY, pyEdit('assert total([1, 2]) == 3', 'assert total([1, 2]) == 4')), 'expected-literal-changed', 6);
  weakens(js('tests/test_cart.py', PY, pyEdit('    ([2, 2], 4),\n', '')), 'cases-removed', 10);
  weakens(js('tests/test_cart.py', PY, pyEdit('from shop.cart import total\n', 'from shop.cart import total\nfrom unittest.mock import patch\n\n\n@patch("shop.cart.total")\ndef _unused(m):\n    pass\n')), 'module-mocked');
  weakens(js('tests/test_cart.py', PY, pyEdit(/\n\ndef test_rejects_negative[\s\S]*$/, '\n')), 'test-removed', 18);
});

test('test-change-review#AC-2: additive and neutral changes are reported as such', () => {
  const added = edit("    expect(parse('2')).toBe(2);\n", "    expect(parse('2')).toBe(2);\n    expect(parse('-3')).toBe(-3);\n");
  assert.equal(js('t.test.ts', BASE, added).result, 'additive');
  const newTest = BASE.replace(/\}\);\n$/, "\n  test('reads a decimal', () => {\n    expect(parse('1.5')).toBe(1.5);\n  });\n});\n");
  assert.equal(js('t.test.ts', BASE, newTest).result, 'additive');
  const table = "test.each([\n  [1, 2],\n])('adds one to %i', (a, b) => {\n  expect(a + 1).toBe(b);\n});\n";
  assert.equal(js('t.test.ts', table, table.replace('  [1, 2],\n', '  [1, 2],\n  [5, 6],\n')).result, 'additive');

  assert.equal(js('t.test.ts', BASE, BASE.replaceAll('parse', 'parseNumber')).result, 'neutral');
  assert.equal(js('t.test.ts', BASE, edit("'../src/parse'", "'../src/lib/parse'")).result, 'neutral');
  assert.equal(js('t.test.ts', BASE, BASE.replaceAll("'", '"').replace("toBe(2);", 'toBe(2)')).result, 'neutral');
  assert.equal(js('t.test.ts', BASE, edit("  test('reads a number', () => {", "  // Plain integers only.\n  test('reads a number', () => {")).result, 'neutral');
  assert.equal(js('t.test.ts', BASE, edit("expect(parse('1'))", "expect(parse('1' as string) as number)")).result, 'neutral');
  assert.equal(js('t.test.ts', BASE, edit("test('reads a number'", "test('reads an integer'")).result, 'neutral');

  assert.equal(js('tests/test_cart.py', PY, pyEdit('    assert total([]) == 0\n', '    assert total([]) == 0\n    assert total([5]) == 5\n')).result, 'additive');
  assert.equal(js('tests/test_cart.py', PY, PY.replaceAll('total', 'cart_total')).result, 'neutral');

  // A neutral change mixed with a weakening one reports the weakening.
  const mixed = edit("'../src/parse'", "'../src/lib/parse'").replace("toBe(2);", 'toBe(3);');
  weakens(js('t.test.ts', BASE, mixed), 'expected-literal-changed', 7);
  // A change the classifier cannot show to be additive or neutral counts as weakening.
  const subject = edit("expect(parse('1')).toBe(1);", "expect(Number('1')).toBe(1);");
  assert.equal(js('t.test.ts', BASE, subject).result, 'weakening');
  const early = edit("    expect(parse('2')).toBe(2);", "    if (process.env.CI) return;\n    expect(parse('2')).toBe(2);");
  assert.equal(js('t.test.ts', BASE, early).result, 'weakening');
  // Renaming a property the test reads from the code under test changes what it checks; only names
  // the file itself declares can be renamed neutrally (seen in this repository's history, f3da6d7).
  const prop = "test('merges', () => {\n  assert.equal(decide(input).deny, false);\n});\n";
  assert.equal(js('t.test.mjs', prop, prop.replace('.deny', '.ask')).result, 'weakening');
  // Adding to an expected value changes what the test expects, so a wrong extra output can be made
  // to pass; that is a changed expectation, not an addition (seen in this repository's history, 7e99661).
  const expected = "const BLOCK = [\n  'a',\n  'b',\n];\n\ntest('writes the block', () => {\n  assert.deepEqual(render(), BLOCK);\n});\n";
  weakens(js('t.test.mjs', expected, expected.replace("  'a',\n", "  'a',\n  'extra',\n")), 'expected-value-changed', 3);
  weakens(js('t.test.ts', BASE, edit("toThrow('not a number')", "toThrow('not a number' + ' or empty')")), 'expected-value-changed', 11);
  // Data a test only reads as input, and new assertions, stay additive.
  const input = "const ROWS = [\n  1,\n];\n\ntest('sums', () => {\n  expect(sum(ROWS)).toBe(1);\n});\n";
  assert.equal(js('t.test.ts', input, input.replace('  1,\n', '  1,\n  0,\n')).result, 'additive');
});

test('test-change-review#AC-3: unknown languages and unreadable files are unclear; snapshot files are weakening', () => {
  assert.equal(classifyTestChange({ file: 'spec/cart_spec.rb', before: 'a', after: 'b' }).result, 'unclear');
  assert.equal(js('t.test.ts', BASE, edit("test('rejects text', () => {", "test('rejects text', () => {{")).result, 'unclear');
  assert.equal(js('tests/test_cart.py', PY, pyEdit('"negative")', '"negative"')).result, 'unclear');
  for (const file of ['src/__snapshots__/a.test.ts.snap', 'tests/e2e/home.spec.ts-snapshots/home-chromium.png']) {
    weakens(classifyTestChange({ file, before: 'a', after: 'b' }), 'snapshot');
  }
});

function project(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-test-review-'));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}
const editInput = (root, file, old_string, new_string) => ({ cwd: root, tool_name: 'Edit', tool_input: { file_path: path.join(root, file), old_string, new_string } });

test('test-change-review#AC-4: guard-test-edits allows additive and neutral edits and asks for weakening and unclear ones', () => {
  const root = project({ 'tests/parse.test.ts': BASE });
  const file = 'tests/parse.test.ts';
  assert.equal(decideEdit(editInput(root, file, "    expect(parse('2')).toBe(2);\n", "    expect(parse('2')).toBe(2);\n    expect(parse('9')).toBe(9);\n")), null);
  assert.equal(decideEdit(editInput(root, file, "'../src/parse'", "'../src/lib/parse'")), null);
  const weak = decideEdit(editInput(root, file, "toBe(2)", 'toBe(3)'));
  assert.equal(weak.decision, 'ask');
  assert.match(weak.reason, /expected-literal-changed/);
  assert.match(weak.reason, /line 7/);
  assert.equal(decideEdit(editInput(root, file, 'no such text', 'x')).decision, 'ask');
  assert.equal(decideEdit({ cwd: root, tool_name: 'MultiEdit', tool_input: { file_path: path.join(root, file), edits: [{ old_string: "toBe(1)", new_string: 'toBe(1)' }, { old_string: "toBe(2);\n", new_string: "toBe(2);\n    expect(parse('7')).toBe(7);\n" }] } }), null);
  assert.equal(decideEdit({ cwd: root, tool_name: 'Write', tool_input: { file_path: path.join(root, file), content: BASE.replace('toBe(1)', 'toBeDefined()') } }).decision, 'ask');
  assert.equal(decideEdit({ cwd: root, tool_name: 'Write', tool_input: { file_path: path.join(root, 'tests/new.test.ts'), content: 'anything' } }), null, 'new files are allowed');

  const allowed = runHook('guard-test-edits.mjs', editInput(root, file, "'../src/parse'", "'../src/lib/parse'"));
  assert.equal(allowed.stdout, '');
  const asked = runHook('guard-test-edits.mjs', editInput(root, file, "toBe(2)", 'toBe(3)'));
  assert.equal(JSON.parse(asked.stdout).hookSpecificOutput.permissionDecision, 'ask');

  // Classifying a 2,000-line test file stays well under a second.
  const big = Array.from({ length: 400 }, (_, i) => `test('case ${i}', () => {\n  const v = parse('${i}');\n  expect(v).toBe(${i});\n});\n`).join('\n');
  const started = performance.now();
  classifyTestChange({ file: 'big.test.ts', before: big, after: big.replace("toBe(399)", 'toBe(400)') });
  assert.ok(performance.now() - started < 1000, `took ${performance.now() - started} ms`);
});

test('test-change-review#AC-5: a weakening edit does not ask when a spec unlocks the file and cites a criterion it defines', () => {
  const spec = unlocks => `---\nstatus: approved\nunlocks:\n  - ${unlocks}\n---\n\n# Parse\n\n| # | Criterion | Verified by |\n|---|---|---|\n| AC-1 | Reads numbers. | test |\n| AC-2 | Rejects text with a message. | test |\n`;
  const file = 'tests/parse.test.ts';
  const weakening = root => decideEdit(editInput(root, file, "toBe(2)", 'toBe(3)'));
  assert.equal(weakening(project({ [file]: BASE, 'docs/specs/parse.md': spec(`${file}: AC-2 now reports the value it read`) })), null);
  assert.equal(weakening(project({ [file]: BASE, 'docs/specs/parse.md': spec(`${file}: AC-9 changed`) })).decision, 'ask');
  assert.equal(weakening(project({ [file]: BASE, 'docs/specs/parse.md': spec(`${file}: the value changed`) })).decision, 'ask');
  assert.equal(weakening(project({ [file]: BASE, 'docs/specs/parse.md': spec(`tests/other.test.ts: AC-2 changed`) })).decision, 'ask');
});

test('test-change-review#AC-6: shell writes to existing tests are refused with a pointer to the Edit tool; deletes, moves, and snapshot updates ask', () => {
  const refused = decideCommand('sed -i s/a/b/ tests/a.test.ts');
  assert.equal(refused.decision, 'deny');
  assert.match(refused.reason, /Edit tool/);
  assert.equal(decideCommand("python3 - <<'PY'\np='tests/a.test.ts'\nopen(p,'w').write('x')\nPY").decision, 'deny');
  for (const command of ['git rm tests/a.test.ts', 'rm tests/a.test.ts', 'mv tests/a.test.ts tests/b.test.ts', 'npx vitest run -u']) {
    assert.equal(decideCommand(command).decision, 'ask', command);
  }
  assert.equal(decideCommand('git reset --hard').decision, 'ask');
  assert.equal(decideCommand('npm test'), null);

  // Outside a git repository the guard cannot tell a branch's new tests apart, so an existing file counts as an existing test.
  const result = runHook('guard-commands.mjs', { cwd: project({ 'tests/a.test.ts': 'x\n' }), tool_name: 'Bash', tool_input: { command: 'sed -i s/a/b/ tests/a.test.ts' } });
  const out = JSON.parse(result.stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, 'deny');
  assert.match(out.permissionDecisionReason, /Edit tool/);
});
