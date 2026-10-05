#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit): format the edited file with the project's own
// formatter, if it has one. Does nothing when no formatter is configured. Never blocks.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readInput } from './lib.mjs';

const PRETTIER_EXT = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts', '.css', '.scss', '.json', '.md', '.mdx', '.astro', '.html', '.yaml', '.yml']);
const CLANG_EXT = new Set(['.h', '.hpp', '.c', '.cc', '.cpp', '.inl']);

function findUp(start, names, stop) {
  let dir = start;
  while (true) {
    for (const name of names) if (fs.existsSync(path.join(dir, name))) return path.join(dir, name);
    if (dir === stop || path.dirname(dir) === dir) return null;
    dir = path.dirname(dir);
  }
}

export function chooseFormatter(file, projectDir) {
  const ext = path.extname(file).toLowerCase();
  const dir = path.dirname(file);
  if (PRETTIER_EXT.has(ext)) {
    const bin = path.join(projectDir, 'node_modules', '.bin', process.platform === 'win32' ? 'prettier.cmd' : 'prettier');
    if (fs.existsSync(bin)) return { cmd: bin, args: ['--write', '--log-level', 'warn', file] };
  }
  if (CLANG_EXT.has(ext) && findUp(dir, ['.clang-format', '_clang-format'], projectDir)) {
    return { cmd: 'clang-format', args: ['-i', file] };
  }
  return null;
}

async function main() {
  const input = await readInput();
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input?.cwd ?? process.cwd();
  const raw = input?.tool_input?.file_path;
  if (!raw) return;
  const file = path.resolve(projectDir, raw);
  if (!fs.existsSync(file)) return;
  const formatter = chooseFormatter(file, projectDir);
  if (!formatter) return;
  const result = spawnSync(formatter.cmd, formatter.args, { cwd: projectDir, timeout: 20000, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    process.stderr.write(`rfr-core format-on-edit: ${formatter.cmd} did not succeed on ${raw}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
