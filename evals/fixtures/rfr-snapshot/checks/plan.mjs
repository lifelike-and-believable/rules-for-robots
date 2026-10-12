#!/usr/bin/env node
// Plan record check: completed work in PLAN.md names the pull requests that delivered it, so
// the changes can be found later. A phase whose heading says "(complete)" or "released"
// needs a "Pull requests: #n, ..." line; a milestone row whose status starts with "Done"
// needs at least one #n in its "Pull requests" column. The "Pull requests:" label keeps PR
// numbers apart from the issue numbers the plan also cites.
// Usage: node checks/plan.mjs [PLAN.md]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const PR_LINE = /^Pull requests:.*#\d+/m;

export function checkPlan(text) {
  const errors = [];
  const sections = text.split(/^(?=### )/m).filter(s => s.startsWith('### '));
  for (const section of sections) {
    const heading = section.split('\n', 1)[0].replace(/^###\s+/, '');
    if (!/\((complete|[^)]*released)[^)]*\)/i.test(heading)) continue;
    const body = section.split(/^## /m)[0];
    if (!PR_LINE.test(body)) errors.push(`PLAN.md: "${heading}" is complete but has no "Pull requests: #n" line`);
  }
  const table = /^## [^\n]*Milestones\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(text)?.[1] ?? '';
  const rows = table.split('\n').filter(l => l.startsWith('|'));
  const header = rows[0]?.split('|').map(c => c.trim()) ?? [];
  const statusCol = header.indexOf('Status');
  const prCol = header.indexOf('Pull requests');
  for (const row of rows.slice(2)) {
    const cells = row.split('|').map(c => c.trim());
    if (!/^Done/i.test(cells[statusCol] ?? '')) continue;
    if (prCol === -1 || !/#\d+/.test(cells[prCol] ?? '')) errors.push(`PLAN.md: milestone ${cells[1]} is done but lists no pull requests`);
  }
  return errors;
}

function main() {
  const file = process.argv[2] ?? 'PLAN.md';
  const errors = checkPlan(fs.readFileSync(file, 'utf8'));
  for (const e of errors) console.error(e);
  if (errors.length) process.exit(1);
  console.log(`${file}: completed work names its pull requests.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
