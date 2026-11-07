#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit|NotebookEdit): rule TEST-001 for changes to existing test files.
// New test files, and test files added on the current branch (which the CI test guard also counts
// as new), are allowed without asking. For an existing test file, the hook works out the file as the
// edit would leave it and classifies the change (docs/specs/test-change-review.md, AC-4): additive
// and neutral changes are allowed; a weakening change asks unless a spec unlocks the file with a
// criterion (AC-5); a change it cannot read asks.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ask, existedAtBase, readInput } from './lib.mjs';
import { classifyTestChange } from './lib/test-diff.mjs';
import { unlockedBy } from './spec-unlocks.mjs';

const TEST_FILE = /\.(test|spec)\.[^/\\]+$/;
const TEST_DIR = /(^|[/\\])(test|tests|Tests|__tests__|__snapshots__)[/\\]/;
// Unreal test modules (Source/<Name>Tests/) and test files (*Tests.cpp, *Test.cpp, *Spec.cpp).
const UNREAL_TEST = /(^|\/)Source\/(\w+Tests\/|.*\w(Tests?|Spec)\.(cpp|h)$)/;

export function isTestPath(file) {
  if (typeof file !== 'string' || !file) return false;
  const normalized = file.replace(/\\/g, '/');
  return TEST_FILE.test(normalized) || TEST_DIR.test(normalized) || UNREAL_TEST.test(normalized);
}

// Whether file is a test file that existed where the branch started (any change to it is a change
// to an existing test).
export function shouldAsk(file, cwd = process.cwd()) {
  if (!isTestPath(file)) return false;
  if (!fs.existsSync(path.resolve(cwd, file))) return false;
  return existedAtBase(file, cwd) !== false;
}

// The file's text after the edit, or null when the edit cannot be applied to it.
function applyEdit(tool, input, before) {
  const replace = (text, oldStr, newStr, all) => {
    if (typeof oldStr !== 'string' || !oldStr || !text.includes(oldStr)) return null;
    return all ? text.split(oldStr).join(newStr ?? '') : text.replace(oldStr, () => newStr ?? '');
  };
  if (tool === 'Write') return typeof input.content === 'string' ? input.content : null;
  if (tool === 'Edit') return replace(before, input.old_string, input.new_string, input.replace_all);
  if (tool === 'MultiEdit' && Array.isArray(input.edits)) {
    let text = before;
    for (const e of input.edits) {
      text = replace(text, e.old_string, e.new_string, e.replace_all);
      if (text === null) return null;
    }
    return text;
  }
  return null;
}

// null to allow the edit, or { decision: 'ask', reason }.
export function decideEdit(input) {
  const tool = input?.tool_name;
  const toolInput = input?.tool_input ?? {};
  const cwd = input?.cwd ?? process.cwd();
  const root = process.env.CLAUDE_PROJECT_DIR ?? cwd;
  const file = toolInput.file_path ?? toolInput.notebook_path;
  if (!shouldAsk(file, cwd)) return null;
  const abs = path.resolve(cwd, file);
  // A file outside the project is not one of its tests.
  const fromRoot = path.relative(path.resolve(root), abs);
  if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) return null;
  const rel = path.relative(root, abs).split(path.sep).join('/');
  const intro = `rfr-core (TEST-001): ${rel} is an existing test`;
  const advice = 'Approve only if the test itself is wrong; otherwise change the implementation.';
  const before = fs.readFileSync(abs, 'utf8');
  const after = applyEdit(tool, toolInput, before);
  if (after === null) return { decision: 'ask', reason: `${intro}, and the hook could not work out the edited file to check the change. ${advice}` };
  const { result, findings } = classifyTestChange({ file: rel, before, after });
  if (result === 'additive' || result === 'neutral') return null;
  if (result === 'weakening' && unlockedBy(rel, root)) return null;
  const listed = findings.slice(0, 5).map(f => `${f.kind} (line ${f.line}): ${f.message}`).join('; ');
  const more = findings.length > 5 ? `; and ${findings.length - 5} more` : '';
  const what = result === 'unclear' ? 'the hook could not tell whether this edit weakens it' : 'this edit weakens it';
  return {
    decision: 'ask',
    reason: `${intro}, and ${what}: ${listed}${more}. If a spec criterion changed, list the file under that spec's unlocks with the criterion ID. ${advice}`,
  };
}

async function main() {
  const input = await readInput();
  const decision = decideEdit(input);
  if (decision) ask(decision.reason);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
