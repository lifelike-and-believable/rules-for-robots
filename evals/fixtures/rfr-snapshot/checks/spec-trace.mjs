#!/usr/bin/env node
// Spec trace check (docs/specs/spec-test-traceability.md). For each spec in docs/specs/:
// every criterion whose "Verified by" cell starts with "test:" must be cited by a test as
// <spec file name>#AC-<n>, and every citation of this spec's slug must name a criterion the spec
// has. For specs marked approved or implemented these are errors; for drafts, warnings.
// Criteria verified by something else (a command, a browser check) are skipped and listed.
// Usage: node checks/spec-trace.mjs [project root]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TEST_DIRS, findCitations, listSpecs } from './lib/spec.mjs';

export function runTrace(root, { specsDir = 'docs/specs' } = {}) {
  const result = { errors: [], warnings: [], skipped: [], notices: [], checked: 0 };
  for (const spec of listSpecs(root, specsDir)) {
    if (spec.status === null) {
      result.warnings.push(`${spec.slug}: not checked (${spec.errors[0] ?? 'no status'})`);
      continue;
    }
    result.errors.push(...spec.errors);
    result.checked++;
    const strict = spec.status === 'approved' || spec.status === 'implemented';
    const problems = strict ? result.errors : result.warnings;
    const dirs = spec.testDirs ?? DEFAULT_TEST_DIRS;
    const cites = findCitations(root, dirs).filter(c => c.slug === spec.slug);
    const cited = new Set(cites.map(c => c.id));
    const known = new Set(spec.criteria.map(c => c.id));
    for (const c of spec.criteria) {
      if (!c.needsTest) result.skipped.push({ id: `${spec.slug}#${c.id}`, verifiedBy: c.verifiedBy });
      else if (!cited.has(c.id)) problems.push(`${spec.slug}#${c.id}: no test cites it (searched ${dirs.join(', ')})`);
    }
    for (const c of cites) {
      if (!known.has(c.id)) problems.push(`${spec.slug}#${c.id}: cited in ${c.file} but not in the spec`);
    }
  }
  return result;
}

function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const r = runTrace(root);
  for (const w of r.warnings) console.warn(`warning: ${w}`);
  for (const e of r.errors) console.error(e);
  if (r.skipped.length) console.log(`Not traced to a test (verified another way): ${r.skipped.map(s => s.id).join(', ')}`);
  if (r.errors.length) process.exit(1);
  console.log(`${r.checked} spec(s) checked; every test: criterion has a citing test.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();
