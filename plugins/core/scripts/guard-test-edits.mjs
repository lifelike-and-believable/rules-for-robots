#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit): ask the user before changing an existing test file
// (rule TEST-001). New test files are allowed without asking.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ask, readInput } from './lib.mjs';

const TEST_FILE = /\.(test|spec)\.[^/\\]+$/;
const TEST_DIR = /(^|[/\\])(test|tests|Tests|__tests__|__snapshots__)[/\\]/;
// Unreal test modules (Source/<Name>Tests/) and test files (*Tests.cpp, *Test.cpp, *Spec.cpp).
const UNREAL_TEST = /(^|\/)Source\/(\w+Tests\/|.*\w(Tests?|Spec)\.(cpp|h)$)/;

export function isTestPath(file) {
  if (typeof file !== 'string' || !file) return false;
  const normalized = file.replace(/\\/g, '/');
  return TEST_FILE.test(normalized) || TEST_DIR.test(normalized) || UNREAL_TEST.test(normalized);
}

export function shouldAsk(file, cwd = process.cwd()) {
  if (!isTestPath(file)) return false;
  return fs.existsSync(path.resolve(cwd, file));
}

async function main() {
  const input = await readInput();
  const file = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
  if (shouldAsk(file, input?.cwd ?? process.cwd())) {
    ask(`rfr-core (TEST-001): ${file} is an existing test. Approve only if the test itself is wrong; otherwise change the implementation.`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
