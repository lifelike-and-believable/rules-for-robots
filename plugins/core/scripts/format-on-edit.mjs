#!/usr/bin/env node
// Format edited files with the project's own formatter, once per turn.
//
// PostToolUse (Edit|Write|MultiEdit): record the edited path in a small pending list in
// the OS temp directory, keyed by session (and subagent, when the edit came from one).
// The file is left alone, so a later Edit's old_string still matches what the agent read.
//
// Stop / SubagentStop: format every pending file for that session (or that subagent),
// then clear the list. Does nothing when no formatter is configured. Never blocks: it
// prints nothing on stdout and always exits 0, so it cannot keep Claude from stopping.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readInput } from './lib.mjs';

const PRETTIER_EXT = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts', '.css', '.scss', '.json', '.md', '.mdx', '.astro', '.html', '.yaml', '.yml']);
const CLANG_EXT = new Set(['.h', '.hpp', '.c', '.cc', '.cpp', '.inl']);
const PER_FILE_TIMEOUT_MS = 20000;
// hooks.json gives the hook 30 seconds; stop starting formatters well before that.
const TOTAL_BUDGET_MS = 25000;

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

const safe = value => String(value).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100);

// One list per session, and a separate one per subagent so a SubagentStop never formats
// files the main agent is still working on.
export function pendingListPath(input) {
  const session = safe(input?.session_id ?? 'unknown');
  const agent = input?.agent_id ? `-agent-${safe(input.agent_id)}` : '';
  return path.join(os.tmpdir(), `rfr-format-pending-${session}${agent}.txt`);
}

const readList = file => {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
};

export function recordPending(input, projectDir) {
  const raw = input?.tool_input?.file_path;
  if (!raw) return;
  const file = path.resolve(projectDir, raw);
  const list = pendingListPath(input);
  if (readList(list).includes(file)) return;
  fs.appendFileSync(list, `${file}\n`);
}

export function formatPending(input, projectDir) {
  const list = pendingListPath(input);
  // Claim the list by renaming it, so an edit recorded while we format starts a new list.
  const claimed = `${list}.${process.pid}.claimed`;
  try {
    fs.renameSync(list, claimed);
  } catch {
    return;
  }
  const files = [...new Set(readList(claimed))];
  fs.rmSync(claimed, { force: true });

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const leftover = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const formatter = chooseFormatter(file, projectDir);
    if (!formatter) continue;
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      leftover.push(file);
      continue;
    }
    const result = spawnSync(formatter.cmd, formatter.args, { cwd: projectDir, timeout: Math.min(PER_FILE_TIMEOUT_MS, remaining), encoding: 'utf8' });
    if (result.error || result.status !== 0) {
      process.stderr.write(`rfr-core format-on-edit: ${formatter.cmd} did not succeed on ${file}\n`);
    }
  }
  // Out of time: keep the rest for the next Stop rather than drop them.
  for (const file of leftover) recordPending({ ...input, tool_input: { file_path: file } }, projectDir);
}

async function main() {
  const input = await readInput();
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input?.cwd ?? process.cwd();
  const event = input?.hook_event_name;
  // A SubagentStop without agent_id comes from Claude Code's internal helpers; formatting
  // then would touch the main agent's files mid-turn.
  if (event === 'SubagentStop' && !input?.agent_id) return;
  if (event === 'Stop' || event === 'SubagentStop') formatPending(input, projectDir);
  else recordPending(input, projectDir);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`rfr-core format-on-edit: ${error?.message ?? error}\n`);
  }).finally(() => {
    process.exitCode = 0;
  });
}
