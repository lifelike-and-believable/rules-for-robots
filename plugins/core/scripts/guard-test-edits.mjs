#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit|NotebookEdit): rule TEST-001 for changes to existing test files.
// New test files, and test files added on the current branch (which the CI test guard also counts
// as new), are allowed without asking. For an existing test file, the hook works out the file as the
// edit would leave it and classifies the change (docs/specs/test-change-review.md, AC-4): additive
// and neutral changes are allowed; a weakening change asks unless a spec unlocks the file with a
// criterion (AC-5); a change it cannot read asks.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ask, askReason, canonical, deferredTestContext, defer, existedAtBase, guardSettings, readInput, textAtBase } from './lib.mjs';
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

// null to allow the edit, or { decision: 'ask' | 'defer', reason }. A weakening asks (tier 4), or, when
// the project sets testWeakening to defer in .claude/rfr.json, goes ahead with context telling the
// agent to report it, for the pull request to decide (tier 3; guard tiers AC-5).
export function decideEdit(input) {
  const tool = input?.tool_name;
  const toolInput = input?.tool_input ?? {};
  const cwd = input?.cwd ?? process.cwd();
  const root = process.env.CLAUDE_PROJECT_DIR ?? cwd;
  const file = toolInput.file_path ?? toolInput.notebook_path;
  if (!shouldAsk(file, cwd)) return null;
  const abs = path.resolve(cwd, file);
  // A file outside the project is not one of its tests.
  const fromRoot = path.relative(canonical(root), canonical(abs));
  if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) return null;
  // Paths and specs come from the checkout the file is in: for an agent's worktree under
  // .claude/worktrees/, that worktree and its branch, not the project's main checkout.
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: path.dirname(abs), encoding: 'utf8', timeout: 5000 });
  const repo = top.status === 0 && top.stdout.trim() ? top.stdout.trim() : root;
  const rel = path.relative(canonical(repo), canonical(abs)).split(path.sep).join('/');
  const settings = guardSettings(repo);
  const decide = action => settings.testWeakening === 'defer'
    ? { decision: 'defer', reason: deferredTestContext(action) }
    : { decision: 'ask', reason: askReason({ source: 'rfr-core (TEST-001)', action, why: 'a weakened test can hide a broken behaviour, and only a person can say the old expectation was wrong', instead: 'leave the test as it is and change the implementation, or stop and report which test you would change and why' }) };
  const intro = `${rel} is an existing test`;
  const before = fs.readFileSync(abs, 'utf8');
  const after = applyEdit(tool, toolInput, before);
  if (after === null) return decide(`${intro}, and the hook could not work out the edited file to check the change`);
  // Judge the change against the file as it was where the branch started, as the pull request
  // review does: lines the branch added are the agent's own work, not an existing test. An edit
  // asks only when it brings a weakening of base content that the file did not already have
  // (one approved earlier is not asked about again).
  const base = textAtBase(abs, cwd);
  let { result, findings } = classifyTestChange({ file: rel, before, after });
  if (base !== null && result !== 'additive' && result !== 'neutral') {
    const sinceBase = classifyTestChange({ file: rel, before: base, after });
    if (sinceBase.result === 'additive' || sinceBase.result === 'neutral') return null;
    if (sinceBase.result === 'weakening') {
      const key = f => `${f.kind}\u0000${f.message}`;
      const already = new Set(classifyTestChange({ file: rel, before: base, after: before }).findings.map(key));
      const fresh = sinceBase.findings.filter(f => !already.has(key(f)));
      if (!fresh.length) return null;
      result = 'weakening';
      findings = fresh;
    }
  }
  if (result === 'additive' || result === 'neutral') return null;
  if (result === 'weakening' && unlockedBy(rel, repo)) return null;
  const listed = findings.slice(0, 5).map(f => `${f.kind} (line ${f.line}): ${f.message}`).join('; ');
  const more = findings.length > 5 ? `; and ${findings.length - 5} more` : '';
  const what = result === 'unclear' ? 'the hook could not tell whether this edit weakens it' : 'this edit weakens it';
  return decide(`${intro}, and ${what}: ${listed}${more} (if a spec criterion changed, list the file under that spec's unlocks with the criterion ID)`);
}

async function main() {
  const input = await readInput();
  const decision = decideEdit(input);
  if (decision?.decision === 'defer') defer(decision.reason);
  else if (decision) ask(decision.reason);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
