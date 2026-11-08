#!/usr/bin/env node
// Review findings check (docs/specs/grounded-evidence.md, AC-8). Parses findings in the reviewer
// agents' standard form and checks that each says what it rests on:
//
//   - [severity] path/to/file:line, rule ID or "no rule"
//     Problem: ...
//     Failure scenario: ...
//     Fix: ...
//     Basis: observed. <the command run or the place read, and what it showed>
//     Basis: inferred. <the step the reviewer did not check>
//
// review-pr sends findings with errors back to the reviewer, and confirms each inferred finding by
// doing the check its basis names before it counts as confirmed.
//
// Usage: node checks/review-findings.mjs check <file | -> [--json]
// Exit codes: 0 every finding has a valid basis (or there are none), 1 an error, 2 a usage error.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SEVERITIES = ['blocker', 'major', 'minor', 'nit'];
// A finding starts with a bullet and a bracketed word of two letters or more, so a task list's
// "- [ ]" or "- [x]" in a no-findings reply is not taken for one.
const START = /^\s*[-*]\s+\[([A-Za-z][A-Za-z-]+)\]\s+(.*)$/;
const FIELD = /^\s+([A-Za-z][A-Za-z ]*?):\s*(.*)$/;
const BASIS = /^(observed|inferred)\b\s*[.:;,\-–—]?\s*(.*)$/i;
const PLACE = /(?<![\w/.-])((?:[\w@.-]+\/)*[\w@.-]+\.[A-Za-z0-9]+):(\d+)\b/g;

function parseCitation(head) {
  const m = /^(.*?)(?:,\s*(.*))?$/.exec(head.trim());
  const place = /^(\S+?):(\d+)(?:-\d+)?$/.exec(m[1].trim());
  return { citation: m[1].trim(), file: place?.[1] ?? null, line: place ? Number(place[2]) : null, rule: m[2]?.trim().replace(/^"|"$/g, '') || null };
}

export function parseFindings(text) {
  const findings = [];
  let current = null;
  let lastField = null;
  for (const raw of text.split(/\r?\n/)) {
    const start = START.exec(raw);
    if (start) {
      current = { severity: start[1].trim().toLowerCase(), ...parseCitation(start[2]), fields: {} };
      findings.push(current);
      lastField = null;
      continue;
    }
    if (!current) continue;
    const field = FIELD.exec(raw);
    if (field) {
      lastField = field[1].trim().toLowerCase();
      current.fields[lastField] = field[2].trim();
    } else if (/^\s+\S/.test(raw) && lastField) {
      current.fields[lastField] += ` ${raw.trim()}`;
    } else if (!raw.trim()) {
      lastField = null;
    } else {
      // An unindented line that is not a finding ends the list item.
      current = null;
      lastField = null;
    }
  }
  return findings;
}

export function checkFindings(text) {
  const findings = parseFindings(text).map((f, i) => {
    const errors = [];
    if (!SEVERITIES.includes(f.severity)) errors.push(`unknown severity "${f.severity}" (expected ${SEVERITIES.join(', ')})`);
    const rawBasis = f.fields.basis;
    let basis = null;
    let detail = '';
    if (rawBasis === undefined) errors.push('no Basis: line');
    else {
      const m = BASIS.exec(rawBasis);
      if (!m) errors.push(`basis is neither observed nor inferred: "${rawBasis.slice(0, 80)}"`);
      else {
        basis = m[1].toLowerCase();
        detail = m[2].trim();
        if (!detail) errors.push(`basis says ${basis} but not what was ${basis === 'observed' ? 'run or read' : 'left unchecked'}`);
      }
    }
    const places = basis === 'observed' ? [...detail.matchAll(PLACE)].map(m => ({ file: m[1], line: Number(m[2]) })) : [];
    return { index: i + 1, severity: f.severity, citation: f.citation, file: f.file, line: f.line, rule: f.rule, problem: f.fields.problem ?? null, basis, basisDetail: detail, places, errors };
  });
  const errors = findings.filter(f => f.errors.length);
  return {
    ok: errors.length === 0,
    count: findings.length,
    observed: findings.filter(f => f.basis === 'observed').length,
    inferred: findings.filter(f => f.basis === 'inferred').map(f => f.index),
    findings,
  };
}

export function formatResult(r) {
  if (!r.count) return 'No findings in the standard form.';
  const out = [`${r.count} finding(s): ${r.observed} observed, ${r.inferred.length} inferred, ${r.findings.filter(f => f.errors.length).length} with errors.`];
  for (const f of r.findings) {
    out.push(`${f.index}. [${f.severity}] ${f.citation}: ${f.errors.length ? 'error' : f.basis}`);
    for (const e of f.errors) out.push(`   error: ${e}`);
    if (f.basis === 'inferred') out.push(`   to confirm: ${f.basisDetail}`);
    if (f.places.length) out.push(`   basis cites: ${f.places.map(p => `${p.file}:${p.line}`).join(', ')}`);
  }
  if (!r.ok) out.push('\nSend the findings with errors back to the reviewer, asking for a Basis: line on each.');
  return out.join('\n');
}

function main(argv) {
  const json = argv.includes('--json');
  const args = argv.filter(a => a !== '--json');
  if (args[0] !== 'check' || !args[1]) {
    console.error('Usage: review-findings.mjs check <file | -> [--json]');
    process.exit(2);
  }
  const text = args[1] === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(args[1], 'utf8');
  const r = checkFindings(text);
  console.log(json ? JSON.stringify(r, null, 2) : formatResult(r));
  process.exit(r.ok ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
