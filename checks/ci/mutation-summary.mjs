#!/usr/bin/env node
// Summarizes a Stryker JSON report (mutation-testing-report-schema) for the mutation job's summary
// (docs/specs/project-process.md, AC-24). The score is computed as Stryker computes it: killed and
// timed-out mutants over all valid mutants, where survivors and mutants no test covers count as
// undetected, and ignored mutants and compile or runtime errors are left out.
// Usage: node checks/ci/mutation-summary.mjs <reports/mutation/mutation.json>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DETECTED = new Set(['Killed', 'Timeout']);
const UNDETECTED = new Set(['Survived', 'NoCoverage']);
const MAX_LISTED = 15;

export function summarize(report) {
  const counts = { Killed: 0, Timeout: 0, Survived: 0, NoCoverage: 0 };
  const survivors = [];
  for (const [file, { mutants = [] }] of Object.entries(report.files ?? {})) {
    for (const m of mutants) {
      if (m.status in counts) counts[m.status]++;
      if (UNDETECTED.has(m.status)) {
        survivors.push({ file, line: m.location?.start?.line ?? 0, mutator: m.mutatorName, replacement: m.replacement ?? '', status: m.status });
      }
    }
  }
  const detected = counts.Killed + counts.Timeout;
  const total = detected + counts.Survived + counts.NoCoverage;
  survivors.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return {
    total,
    killed: counts.Killed,
    timeout: counts.Timeout,
    survived: counts.Survived,
    noCoverage: counts.NoCoverage,
    score: total ? (detected / total) * 100 : 100,
    survivors,
  };
}

export function markdown(s) {
  const lines = [
    '### Mutation score (advisory)',
    '',
    `**${s.score.toFixed(1)}%** of ${s.total} mutants detected: ${s.killed} killed, ${s.timeout} timed out, ${s.survived} survived, ${s.noCoverage} not covered by any test.`,
    '',
  ];
  if (s.survivors.length) {
    lines.push('A surviving mutant is a change to the code that no test noticed. Each one is a test to strengthen, or code no behaviour depends on.', '');
    lines.push('| Where | Mutator | Change | Status |', '|---|---|---|---|');
    for (const m of s.survivors.slice(0, MAX_LISTED)) {
      lines.push(`| \`${m.file}:${m.line}\` | ${m.mutator} | \`${m.replacement.replace(/\s+/g, ' ').replace(/\|/g, '\\|').slice(0, 60)}\` | ${m.status} |`);
    }
    if (s.survivors.length > MAX_LISTED) lines.push('', `And ${s.survivors.length - MAX_LISTED} more; the full list is in the Stryker report.`);
  }
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const file = process.argv[2];
  if (!file) { console.error('usage: mutation-summary.mjs <mutation.json>'); process.exit(2); }
  process.stdout.write(markdown(summarize(JSON.parse(fs.readFileSync(file, 'utf8')))));
}

// Stub (round 5 tests first).
export function annotation() { return 'stub'; }
