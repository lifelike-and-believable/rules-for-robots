#!/usr/bin/env node
// Attention report (docs/improvement-plan.md, slice 19a). Counts the places a session waited on a
// person, and for how long, from the transcripts Claude Code already writes for every session:
//
//   prompt    a permission prompt a person answered (the tool result's permissionDecision has a
//             `user...` source). Wait: from the tool call to its result.
//   question  an AskUserQuestion call. Wait: from the call to the answer.
//   reply     a message the person typed after the agent ended its turn. Wait: from the end of the
//             turn to the message. This is where a session stopped and asked, reported, or finished.
//   intent    the first message the person typed in a session. Not a wait: it starts the work.
//   aside     a message typed while the agent was still working. Not a wait.
//
// A merge the person confirmed at a prompt is counted as a prompt and marked `merge`. Subagent
// transcripts are read for prompts and questions only, since a person does not type into them.
// Process gates (approvals at GitHub) are reported by checks/process-gate-report.mjs.
//
// Usage: node checks/attention-report.mjs <transcript.jsonl | folder>... [--merged <n> | --repo <owner/name>] [--json]
//   A folder is searched for *.jsonl (a project's folder under ~/.claude/projects, with its
//   subagents). --merged gives the number of pull requests merged in the period; --repo counts them
//   with gh between the first and last event. Nothing from the transcripts is printed except
//   counts, durations, tool names, and word counts.
// Exit codes: 0 report printed, 2 usage error or nothing readable.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const WAIT_KINDS = ['prompt', 'question', 'reply'];

const textOf = content => typeof content === 'string'
  ? content
  : Array.isArray(content) ? content.filter(b => b?.type === 'text').map(b => b.text).join('\n') : '';

// A message the person typed. Recent Claude Code versions mark it with origin.kind 'human'; older
// transcripts carry no origin, so a plain user message that is not a tool result, a meta message, a
// command, or a system notice counts as typed.
export function isHumanMessage(e) {
  if (e?.type !== 'user' || e.isSidechain || e.isMeta || e.toolUseResult) return false;
  if (e.origin) return e.origin.kind === 'human';
  const content = e.message?.content;
  if (Array.isArray(content) && content.some(b => b?.type === 'tool_result')) return false;
  const text = textOf(content).trim();
  return text !== '' && !/^<(command-|local-command|system-reminder|task-notification|bash-)/.test(text) && !/^\[Request interrupted/.test(text);
}

const isMerge = input => /\bgh\s+pr\s+merge\b|merge_pull_request|enable_pr_auto_merge/.test(JSON.stringify(input ?? ''));

// The waits in one transcript, in order. Each event: { kind, session, time, waitMs, tool?, merge?, decision?, words? }.
export function extractEvents(entries, { sidechain = false } = {}) {
  const events = [];
  const calls = new Map();
  let lastActivity = null;
  let turnEnded = false;
  let sawHuman = false;
  for (const e of entries) {
    const time = Date.parse(e?.timestamp);
    if (Number.isNaN(time)) continue;
    const session = e.sessionId ?? null;
    if (e.type === 'assistant') {
      for (const b of Array.isArray(e.message?.content) ? e.message.content : []) {
        if (b?.type === 'tool_use') calls.set(b.id, { time, name: b.name, input: b.input });
      }
      lastActivity = time;
      turnEnded = e.message?.stop_reason === 'end_turn';
      continue;
    }
    if (e.type !== 'user') continue;
    const results = Array.isArray(e.message?.content) ? e.message.content.filter(b => b?.type === 'tool_result') : [];
    if (results.length) {
      for (const r of results) {
        const call = calls.get(r.tool_use_id);
        if (!call) continue;
        const pd = e.permissionDecision;
        const waitMs = Math.max(0, time - call.time);
        if (call.name === 'AskUserQuestion') {
          events.push({ kind: 'question', session, time, waitMs, tool: call.name });
        } else if (pd && /^user/.test(String(pd.source ?? ''))) {
          events.push({ kind: 'prompt', session, time, waitMs, tool: call.name, merge: isMerge(call.input), decision: pd.decision ?? null });
        }
      }
      lastActivity = time;
      turnEnded = false;
      continue;
    }
    if (sidechain || !isHumanMessage(e)) continue;
    const words = textOf(e.message?.content).split(/\s+/).filter(Boolean).length;
    if (!sawHuman) events.push({ kind: 'intent', session, time, waitMs: 0, words });
    else if (turnEnded && lastActivity !== null) events.push({ kind: 'reply', session, time, waitMs: Math.max(0, time - lastActivity), words });
    else events.push({ kind: 'aside', session, time, waitMs: 0, words });
    sawHuman = true;
    lastActivity = time;
    turnEnded = false;
  }
  return events;
}

export function readTranscript(file) {
  const entries = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { entries.push(JSON.parse(line)); } catch { /* a partial last line */ }
  }
  return entries;
}

export function transcriptFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const out = [];
  for (const name of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, name.name);
    if (name.isDirectory()) { if (name.name !== 'tool-results' && name.name !== 'memory') out.push(...transcriptFiles(full)); }
    else if (name.name.endsWith('.jsonl')) out.push(full);
  }
  return out;
}

const median = xs => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const quantile = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

export function summarise(events, { merged = null } = {}) {
  const byKind = {};
  for (const kind of [...WAIT_KINDS, 'intent', 'aside']) byKind[kind] = { count: 0, waitMs: 0, medianMs: null, p90Ms: null };
  for (const kind of Object.keys(byKind)) {
    const xs = events.filter(e => e.kind === kind).map(e => e.waitMs);
    byKind[kind] = { count: xs.length, waitMs: xs.reduce((a, b) => a + b, 0), medianMs: median(xs), p90Ms: quantile(xs, 0.9) };
  }
  const waits = events.filter(e => WAIT_KINDS.includes(e.kind));
  const blockedMs = waits.reduce((a, e) => a + e.waitMs, 0);
  const prompts = events.filter(e => e.kind === 'prompt');
  const promptTools = {};
  for (const p of prompts) {
    const key = p.merge ? 'merge' : p.tool;
    promptTools[key] = (promptTools[key] ?? 0) + 1;
  }
  const times = events.map(e => e.time);
  const words = events.reduce((a, e) => a + (e.words ?? 0), 0);
  const sessions = new Set(events.map(e => e.session).filter(Boolean)).size;
  return {
    sessions,
    from: times.length ? new Date(Math.min(...times)).toISOString() : null,
    to: times.length ? new Date(Math.max(...times)).toISOString() : null,
    waits: waits.length,
    blockedMs,
    words,
    byKind,
    promptTools,
    declined: prompts.filter(p => p.decision === 'reject').length,
    merged,
    perMerged: merged ? { waits: waits.length / merged, blockedHours: blockedMs / 3600000 / merged, words: words / merged } : null,
  };
}

const mins = ms => (ms === null ? 'n/a' : ms < 60000 ? `${Math.round(ms / 1000)} s` : ms < 3600000 ? `${(ms / 60000).toFixed(1)} min` : `${(ms / 3600000).toFixed(1)} h`);

export function formatReport(r) {
  const out = [`${r.sessions} session(s), ${r.from ?? '?'} to ${r.to ?? '?'}.`,
    `${r.waits} wait(s) on a person, ${mins(r.blockedMs)} in total; the person typed ${r.words} words.`, '',
    'Kind      Count  Total     Median    90th'];
  for (const [kind, k] of Object.entries(r.byKind)) {
    out.push(`${kind.padEnd(9)} ${String(k.count).padStart(5)}  ${mins(k.waitMs).padEnd(9)} ${mins(k.medianMs).padEnd(9)} ${mins(k.p90Ms)}`);
  }
  if (Object.keys(r.promptTools).length) out.push('', `Prompts by tool: ${Object.entries(r.promptTools).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ')}${r.declined ? `; ${r.declined} declined` : ''}.`);
  if (r.perMerged) out.push('', `Per merged pull request (${r.merged}): ${r.perMerged.waits.toFixed(1)} waits, ${r.perMerged.blockedHours.toFixed(2)} h blocked, ${Math.round(r.perMerged.words)} words typed.`);
  else out.push('', 'Pass --merged <n> or --repo <owner/name> for figures per merged pull request.');
  out.push('A reply\'s wait runs from the end of the agent\'s turn to the next typed message, so it includes time the person spent on other things.');
  return out.join('\n');
}

export function countMerged(repo, from, to, run = spawnSync) {
  const r = run('gh', ['pr', 'list', '-R', repo, '--state', 'merged', '--limit', '1000', '--search', `merged:${from.slice(0, 10)}..${to.slice(0, 10)}`, '--json', 'number'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`gh pr list failed: ${(r.stderr || '').trim()}`);
  return JSON.parse(r.stdout).length;
}

function main(argv) {
  const json = argv.includes('--json');
  let merged = null;
  let repo = null;
  const targets = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') continue;
    if (argv[i] === '--merged') merged = Number(argv[++i]);
    else if (argv[i] === '--repo') repo = argv[++i];
    else if (argv[i].startsWith('-')) { console.error(`unknown option ${argv[i]}`); process.exit(2); }
    else targets.push(argv[i]);
  }
  if (!targets.length || (merged !== null && !(merged > 0))) {
    console.error('Usage: attention-report.mjs <transcript.jsonl | folder>... [--merged <n> | --repo <owner/name>] [--json]');
    process.exit(2);
  }
  const events = [];
  for (const target of targets) {
    let files;
    try { files = transcriptFiles(target); } catch (e) { console.error(`cannot read ${target}: ${e.code ?? e.message}`); process.exit(2); }
    for (const file of files) {
      const sidechain = /[\\/]subagents[\\/]/.test(file);
      events.push(...extractEvents(readTranscript(file), { sidechain }));
    }
  }
  if (!events.length) { console.error('no events found'); process.exit(2); }
  let r = summarise(events, { merged });
  if (repo && merged === null) r = summarise(events, { merged: countMerged(repo, r.from, r.to) || null });
  console.log(json ? JSON.stringify(r, null, 2) : formatReport(r));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
