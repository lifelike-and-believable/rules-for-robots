#!/usr/bin/env node
// Process state (docs/specs/process-state.md): where each feature stands and what the process
// allows next. Approval is read from the remote default branch, because an artifact is approved
// when its pull request merges. rfr-process gives the same text to every session through its
// SessionStart hook; this command prints it on demand.
// Usage: node checks/process-next.mjs [project root]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processNext } from './lib/process.mjs';

function main(argv) {
  const root = path.resolve(argv[0] ?? '.');
  const next = processNext(root);
  console.log(next ? next.text : 'no docs/product/process.yml: this project does not use the process');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
