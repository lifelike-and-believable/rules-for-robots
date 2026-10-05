#!/usr/bin/env node
// Reads an Unreal automation report (index.json from -ReportExportPath) and fails unless
// at least one test ran and none failed or were skipped (UE-007). The editor's process
// exit code is not used.
// Usage: node read-automation-report.mjs <report-dir> [--expect-failures]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function summarize(report) {
  const tests = report.tests ?? [];
  return {
    succeeded: report.succeeded ?? tests.filter(t => t.state === 'Success').length,
    succeededWithWarnings: report.succeededWithWarnings ?? 0,
    failed: report.failed ?? tests.filter(t => t.state === 'Fail').length,
    notRun: report.notRun ?? 0,
    total: tests.length,
  };
}

function main() {
  const [dir] = process.argv.slice(2);
  const expectFailures = process.argv.includes('--expect-failures');
  const file = path.join(dir, 'index.json');
  if (!fs.existsSync(file)) {
    console.error(`no index.json in ${dir}; the run did not export a report`);
    process.exit(1);
  }
  // Unreal writes index.json with a UTF-8 BOM on some versions.
  const report = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  const s = summarize(report);
  console.log(JSON.stringify(s));
  if (expectFailures) process.exit(0);
  const ok = s.total > 0 && s.failed === 0 && s.notRun === 0;
  if (!ok) console.error('automation tests failed, were skipped, or none ran');
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
