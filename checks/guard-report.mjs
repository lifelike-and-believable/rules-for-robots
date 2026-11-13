#!/usr/bin/env node
// Guard decision report (docs/specs/guard-tiers.md, AC-7). Summarises a guard-decisions.jsonl log
// written by the rfr-core guards: asks and refusals per hour, per guard and reason, and the share of
// asks a person approved (an `approved` line follows an ask whose tool call then ran). A reason
// approved in at least 95% of 20 or more asks is a candidate to move down a tier. Reasons are
// grouped once file paths, numbers, and quoted values are set aside, so one rule asking about many
// files counts as one reason.
//
// Usage: node checks/guard-report.mjs [log...] [--json]
//   With no log, reads $CLAUDE_PLUGIN_DATA/guard-decisions.jsonl. Several logs (one per plugin) are
//   reported together.
// Exit codes: 0 report printed, 2 no log or a usage error.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CANDIDATE_SHARE = 0.95;
export const CANDIDATE_MIN = 20;

// The reason with its specifics set aside: quoted values, paths, line numbers, and tool names.
export function reasonKey(reason) {
  return String(reason ?? '')
    .replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '<value>')
    .replace(/\bmcp__\w+/g, '<tool>')
    .replace(/(?:[\w.@-]+\/)+[\w.@-]+|\b[\w-]+\.[a-z]{1,5}\b(?=[\s,:;)]|$)/gi, '<path>')
    .replace(/\b\d+\b/g, 'N')
    .replace(/\s+/g, ' ')
    .split(/(?<=\.)\s/)[0]
    .slice(0, 160)
    .trim();
}

export function summarise(entries) {
  const groups = new Map();
  let asks = 0;
  let approved = 0;
  let refusals = 0;
  let snapshots = 0;
  let deferred = 0;
  let byInstruction = 0;
  let first = null;
  let last = null;
  for (const e of entries) {
    const t = Date.parse(e.time);
    if (!Number.isNaN(t)) {
      first = first === null ? t : Math.min(first, t);
      last = last === null ? t : Math.max(last, t);
    }
    // A snapshot before a destructive command (guard tiers AC-11) asks no one: it is counted, not grouped.
    if (e.decision === 'snapshot') { snapshots++; continue; }
    // A test change deferred to the pull request (testWeakening: defer) asks no one either.
    if (e.decision === 'defer') { deferred++; continue; }
    // A command the person approved by asking for its task (task-approval AC-4) asks no one either.
    if (e.decision === 'approved-by-instruction') { byInstruction++; continue; }
    const key = `${e.hook}\u0000${reasonKey(e.reason)}`;
    if (!groups.has(key)) groups.set(key, { hook: e.hook ?? null, key: reasonKey(e.reason), asks: 0, approved: 0, refusals: 0 });
    const g = groups.get(key);
    if (e.decision === 'ask') { g.asks++; asks++; }
    else if (e.decision === 'approved') { g.approved++; approved++; }
    else if (e.decision === 'deny' || e.decision === 'never') { g.refusals++; refusals++; }
  }
  const hours = first === null ? 0 : (last - first) / 3600000;
  const reasons = [...groups.values()]
    .map(g => ({ ...g, share: g.asks ? Math.min(1, g.approved / g.asks) : null }))
    .sort((a, b) => b.asks + b.refusals - (a.asks + a.refusals));
  const candidates = reasons.filter(g => g.asks >= CANDIDATE_MIN && g.share >= CANDIDATE_SHARE);
  return { asks, approved, refusals, snapshots, deferred, byInstruction, hours, perHour: hours > 0 ? (asks + refusals) / hours : null, reasons, candidates };
}

const pct = x => (x === null ? 'n/a' : `${Math.round(x * 100)}%`);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function formatReport(r, unreadable = 0) {
  const out = [`${plural(r.asks, 'ask')}, ${r.approved} approved (${pct(r.asks ? r.approved / r.asks : null)}), ${plural(r.refusals, 'refusal')}, over ${r.hours.toFixed(1)} hours${r.perHour === null ? '' : ` (${r.perHour.toFixed(1)} an hour)`}.`];
  if (r.snapshots) out.push(`${plural(r.snapshots, 'snapshot')} taken before a destructive command, each allowed without asking.`);
  if (r.deferred) out.push(`${plural(r.deferred, 'test change')} deferred to the pull request's test-change review (testWeakening: defer), each allowed without asking.`);
  if (r.byInstruction) out.push(`${plural(r.byInstruction, 'command')} approved by the person's instruction for its task (task approval), each without a prompt.`);
  if (unreadable) out.push(`${plural(unreadable, 'line')} could not be read.`);
  out.push('', 'By guard and reason (asks, approved, refusals):');
  for (const g of r.reasons) out.push(`  ${g.hook}: ${g.asks} asked, ${g.approved} approved (${pct(g.share)}), ${g.refusals} refused | ${g.key}`);
  out.push('', r.candidates.length
    ? `Candidates to move down a tier (approved in ${pct(CANDIDATE_SHARE)} or more of ${CANDIDATE_MIN} or more asks):\n${r.candidates.map(c => `  ${c.hook}: ${c.key}`).join('\n')}`
    : `No reason was approved in ${pct(CANDIDATE_SHARE)} or more of ${CANDIDATE_MIN} or more asks.`);
  out.push('An ask with no approved line was declined, or the session ended first: Claude Code reports no hook event for a declined prompt.');
  return out.join('\n');
}

export function readLog(file) {
  const entries = [];
  let unreadable = 0;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      unreadable++;
    }
  }
  return { entries, unreadable };
}

function main(argv) {
  const json = argv.includes('--json');
  const args = argv.filter(a => a !== '--json');
  if (args.some(a => a.startsWith('-'))) {
    console.error('Usage: guard-report.mjs [log...] [--json]');
    process.exit(2);
  }
  // Each plugin with guards (rfr-core, rfr-web, rfr-unreal) logs to its own data folder, so a
  // report can take several logs (plugin-split AC-6).
  const files = args.length ? args : [path.join(process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), 'rfr-core'), 'guard-decisions.jsonl')];
  const log = { entries: [], unreadable: 0 };
  for (const file of files) {
    try {
      const one = readLog(file);
      log.entries.push(...one.entries);
      log.unreadable += one.unreadable;
    } catch (e) {
      console.error(`cannot read ${file}: ${e.code ?? e.message}`);
      process.exit(2);
    }
  }
  const r = summarise(log.entries);
  console.log(json ? JSON.stringify({ ...r, unreadable: log.unreadable }, null, 2) : formatReport(r, log.unreadable));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
