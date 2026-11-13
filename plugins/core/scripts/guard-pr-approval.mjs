#!/usr/bin/env node
// PreToolUse (GitHub MCP tools): refuse a review that approves a pull request (github-gate AC-9).
// Shell commands that approve one are refused by guard-commands.
import { fileURLToPath } from 'node:url';
import { deny, readInput } from './lib.mjs';
import { approveReason, toolApprovesPr } from './pr-approval.mjs';

async function main() {
  const input = await readInput();
  if (toolApprovesPr(input?.tool_name, input?.tool_input)) deny(approveReason);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
