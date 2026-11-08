#!/usr/bin/env node
// PreToolUse (Bash, PowerShell): ask when an Unreal editor run's -ExecCmds list does not end with
// Quit, which leaves the editor running after its commands finish (#56). Moved out of rfr-core's
// guard-commands into rfr-unreal (docs/specs/plugin-split.md, AC-2), so projects without Unreal do
// not run it. Requiring Quit is simpler than knowing which commands exit on their own, and always
// safe.
import { fileURLToPath } from 'node:url';
import { ask, readInput } from './lib.mjs';

export function execCmdsWithoutQuit(command) {
  if (typeof command !== 'string' || !/\bUnrealEditor(-Cmd)?(\.exe)?\b/i.test(command)) return false;
  const match = command.match(/-ExecCmds=("[^"]*"|'[^']*'|\S+)/i);
  return Boolean(match) && !/\bquit\b/i.test(match[1]);
}

// null, or { decision: 'ask', reason }.
export function decideUnreal(command) {
  if (!execCmdsWithoutQuit(command)) return null;
  return { decision: 'ask', reason: 'rfr-unreal: the editor -ExecCmds list does not end with Quit, so the editor will keep running after its commands finish (add ";Quit"). Approve only if you will close it yourself.' };
}

async function main() {
  const input = await readInput();
  const result = decideUnreal(input?.tool_input?.command);
  if (result) ask(result.reason);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
