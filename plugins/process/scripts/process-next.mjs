#!/usr/bin/env node
// SessionStart: tell the session where each feature stands and what the process allows next
// (docs/specs/process-state.md, AC-4). Silent in a project without docs/product/process.yml, and
// an error here never fails the session.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processNext } from './lib/process.mjs';

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch { /* no input */ }
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  let next = null;
  try { next = processNext(root); } catch { next = null; }
  if (next?.text) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: next.text } }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch(() => {});
