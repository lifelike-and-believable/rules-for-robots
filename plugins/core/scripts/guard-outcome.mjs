#!/usr/bin/env node
// PostToolUse and PostToolUseFailure (the tools the guards cover): when a guard asked about this
// tool call and the call then ran, the person approved it, so log an `approved` line with the same
// hook and reason as the ask (docs/specs/guard-tiers.md, AC-6). Claude Code reports no hook event
// when a person declines a prompt, so an ask with no `approved` line was declined or never reached.
// Prints nothing and never blocks; pending records older than a day are removed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendGuardLog, guardLogEnabled, pendingDir, readInput, safeId } from './lib.mjs';

const DAY = 24 * 60 * 60 * 1000;

export function recordOutcome(input, now = Date.now()) {
  if (!guardLogEnabled() || !input?.tool_use_id) return 0;
  const dir = pendingDir();
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return 0;
  }
  const prefix = `${safeId(input.tool_use_id)}__`;
  let recorded = 0;
  for (const name of names) {
    const file = path.join(dir, name);
    if (name.startsWith(prefix)) {
      try {
        const ask = JSON.parse(fs.readFileSync(file, 'utf8'));
        appendGuardLog({ time: new Date(now).toISOString(), session: input.session_id ?? null, hook: ask.hook ?? null, tool: ask.tool ?? input.tool_name ?? null, decision: 'approved', reason: ask.reason ?? '' });
        recorded++;
      } catch {
        // A record that cannot be read is dropped.
      }
      fs.rmSync(file, { force: true });
    } else if (recorded === 0) {
      // Old records belong to asks that were declined or abandoned.
      try {
        if (now - fs.statSync(file).mtimeMs > DAY) fs.rmSync(file, { force: true });
      } catch {
        // Already gone.
      }
    }
  }
  return recorded;
}

async function main() {
  try {
    recordOutcome(await readInput());
  } catch {
    // Outcome logging never affects the tool call.
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
