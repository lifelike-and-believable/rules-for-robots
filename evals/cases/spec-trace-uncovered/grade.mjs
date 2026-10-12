// Pass when the spec's four test: criteria are each cited by a test (unit-converter#AC-n), the
// tests were written before the implementation, one test runs the command, npm test passes, and
// the spec is untouched.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);
const editedPath = t => String(t.input?.file_path ?? t.input?.path ?? '').replace(/\\/g, '/');

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true, recursive: true }).filter(e => e.isFile()).map(e => path.join(e.parentPath ?? e.path, e.name));
}

export default async function grade({ dir, git, tools = [] }) {
  const { runTrace } = await import(pathToFileURL(path.join(ROOT, 'checks', 'spec-trace.mjs')));
  const trace = runTrace(dir);

  const edits = tools.filter(t => EDIT_TOOLS.has(t.name));
  const firstTest = edits.findIndex(t => /(^|\/)test\//.test(editedPath(t)));
  const firstSource = edits.findIndex(t => /(^|\/)(src|bin)\//.test(editedPath(t)));

  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const tests = spawnSync('npm', ['test'], { cwd: dir, encoding: 'utf8', timeout: 120000, env, shell: process.platform === 'win32' });
  const testText = listFiles(path.join(dir, 'test')).map(f => fs.readFileSync(f, 'utf8')).join('\n');

  const checks = {
    traced: trace.checked === 1 && trace.errors.length === 0,
    testsFirst: firstTest !== -1 && (firstSource === -1 || firstTest < firstSource),
    commandTested: /(spawnSync|execFileSync|execSync|spawn|execFile)\(/.test(testText) && /convert\.js/.test(testText),
    testsGreen: tests.status === 0,
    specUntouched: git('status', '--porcelain', '--', 'docs/specs').trim() === '',
  };
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, traceErrors: trace.errors } };
}
