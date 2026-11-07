#!/usr/bin/env node
// PreToolUse (shell commands, and the GitHub MCP merge and auto-merge tools): an agent's merge of a pull request that
// touches a gated process folder needs the person's confirmation (docs/specs/project-process.md,
// "Approval records"). In solo mode the approver's merge is the approval, so the hook asks: the
// permission prompt is where the approver confirms, which turns an instruction like "merge it when
// green" into a recorded decision instead of something the agent does on its own. When the person's
// latest typed message in the session already says to merge (AC-52), that is the confirmation, and
// the hook does not ask again: "merge when green" is carried out when CI finishes. Projects without
// docs/product/process.yml are not affected. If the pull request's files cannot be listed (no gh,
// no network), it asks as well, and says why.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gatedStages, hasId, readConfig, stageOf } from './lib/process.mjs';

// Flags of `gh pr merge` that take a value, so their value is not the pull request argument.
const VALUE_FLAGS = new Set(['-b', '--body', '-F', '--body-file', '-t', '--subject', '--match-head-commit', '-A', '--author-email', '-R', '--repo']);

function words(segment) {
  return [...segment.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3]);
}

// gh api's method: -X or --method, else POST when fields or input are passed, else GET.
function apiMethod(w) {
  for (let k = 0; k < w.length; k++) {
    if (w[k] === '-X' || w[k] === '--method') return (w[k + 1] ?? '').toUpperCase();
    const joined = /^(?:-X|--method=)(\w+)$/.exec(w[k]);
    if (joined) return joined[1].toUpperCase();
  }
  return w.some(x => /^(-f|-F|--field|--raw-field|--input)$/.test(x) || /^--(raw-)?field=/.test(x)) ? 'POST' : 'GET';
}

// What a tool call would merge: { kind: 'gh', ref } for `gh pr merge [ref]` (with or without
// --auto), { kind: 'api', owner, repo, number } for the REST merge or auto-merge endpoints and the
// MCP merge and auto-merge tools, { kind: 'unknown' } for a GraphQL merge or auto-merge mutation,
// whose pull request is named by node ID, or null. Turning on auto-merge counts as a merge: GitHub
// merges the pull request once checks pass, with no further step for the guard to see (AC-53).
export function mergeTarget(input) {
  const tool = input?.tool_name ?? '';
  if (/^mcp__.*(merge_pull_request|enable_pr_auto_merge)$/i.test(tool)) {
    const t = input.tool_input ?? {};
    return { kind: 'api', owner: t.owner, repo: t.repo, number: Number(t.pullNumber ?? t.pull_number ?? t.number) };
  }
  if (!/^(Bash|PowerShell)$/.test(tool)) return null;
  const command = String(input.tool_input?.command ?? '');
  for (const segment of command.split(/&&|\|\||;|\||\n/)) {
    const w = words(segment.trim());
    const i = w.findIndex((x, k) => x === 'gh' && w[k + 1] === 'pr' && w[k + 2] === 'merge');
    if (i !== -1) {
      const args = w.slice(i + 3);
      let ref = '';
      for (let k = 0; k < args.length; k++) {
        if (VALUE_FLAGS.has(args[k])) { k++; continue; }
        if (args[k].startsWith('-')) continue;
        ref = args[k];
        break;
      }
      return { kind: 'gh', ref };
    }
    if (w[0] === 'gh' && w[1] === 'api') {
      if (w.includes('graphql')) {
        if (/\b(mergePullRequest|enablePullRequestAutoMerge)\b/.test(segment)) return { kind: 'unknown' };
        continue;
      }
      const m = w.map(x => /^\/?repos\/([^/]+)\/([^/]+)\/pulls\/(\d+)\/(merge|ccr\/auto_merge)$/.exec(x)).find(Boolean);
      if (m && ['PUT', 'POST'].includes(apiMethod(w))) return { kind: 'api', owner: m[1], repo: m[2], number: Number(m[3]) };
    }
  }
  return null;
}

function listWithGh(target) {
  if (target.kind === 'unknown') throw new Error('the call names the pull request by node ID, so the guard cannot tell which one it is');
  const args = target.kind === 'gh'
    ? ['pr', 'view', ...(target.ref ? [target.ref] : []), '--json', 'files', '--jq', '.files[].path']
    : ['api', '--paginate', `repos/${target.owner}/${target.repo}/pulls/${target.number}/files`, '--jq', '.[].filename'];
  const r = spawnSync('gh', args, { encoding: 'utf8', timeout: 8000 });
  if (r.error || r.status !== 0) throw new Error((r.error?.message ?? r.stderr ?? '').trim() || `gh exited ${r.status}`);
  return r.stdout.split('\n').map(s => s.trim()).filter(Boolean);
}

function describeWithGh(target) {
  if (target.kind === 'unknown') throw new Error('unknown pull request');
  const args = target.kind === 'gh'
    ? ['pr', 'view', ...(target.ref ? [target.ref] : []), '--json', 'number,createdAt', '--jq', '"\\(.number) \\(.createdAt)"']
    : ['api', `repos/${target.owner}/${target.repo}/pulls/${target.number}`, '--jq', '"\\(.number) \\(.created_at)"'];
  const r = spawnSync('gh', args, { encoding: 'utf8', timeout: 8000 });
  if (r.error || r.status !== 0) throw new Error((r.error?.message ?? r.stderr ?? '').trim() || `gh exited ${r.status}`);
  const [number, createdAt] = r.stdout.trim().split(/\s+/);
  return { number: Number(number), createdAt };
}

// The text of a transcript message: a typed string, or the text blocks of a content list. Tool
// results are not text the person typed, so a message holding one has no text here.
function messageText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content) || content.some(block => block?.type === 'tool_result')) return '';
  return content.filter(block => block?.type === 'text').map(block => block.text).join('\n');
}

// The person's latest typed message in the session transcript, or null. Claude Code marks a message
// the person typed with origin.kind "human"; tool results, notifications, messages from other
// sessions, and expanded skill text are not marked so, and subagent (sidechain) entries are
// skipped. Anything unreadable gives null, and the guard then asks.
export function latestHumanMessage(transcriptPath) {
  if (!transcriptPath) return null;
  let lines;
  try {
    lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
  } catch {
    return null;
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].trim()) continue;
    let entry;
    try { entry = JSON.parse(lines[i]); } catch { continue; }
    if (entry?.type !== 'user' || entry.isSidechain || entry.isMeta || entry.origin?.kind !== 'human') continue;
    const text = messageText(entry.message?.content).trim();
    if (text) return { text, timestamp: entry.timestamp ?? '' };
  }
  return null;
}

const NEGATED = /\b(don'?t|do\s+not|never|not|no|without|hold\s+off|stop|wait\s+(before|to))\b[^.!?\n]{0,30}\bmerg/i;
const SKILL = /(?:^|<command-name>)\s*\/(?:[\w-]+:)?merge-when-green\b/i;
// "merge" (or "squash merge", "go ahead and merge it") as the whole message, possibly naming
// pull requests and a condition such as "when green"; or "merge" with a CI condition anywhere.
const WHOLE = /^(?:(?:yes|ok(?:ay)?|sure|great|thanks)[,.!]?\s+)?(?:please\s+)?(?:go\s+ahead\s+(?:and\s+)?)?(?:squash[- ]|rebase[- ])?merge\b(?:\s+(?:it|this|that|them|the\s+pr|pr|pull\s+request))?(?:\s*(?:#?\d+|pr\s*#?\d+|https:\/\/\S+\/pull\/\d+)(?:\s*(?:,|and)\s*#?\d+)*)?(?:\s+(?:now|when|once|after|if)\b[^.!?\n]{0,40})?(?:,?\s+(?:please|thanks))?[.!]*$/i;
const CONDITIONAL = /\bmerge\b[^.!?\n]{0,40}\b(?:when|once|after|if)\b[^.!?\n]{0,30}\b(?:green|pass(?:es|ing)?|ci|checks?)\b/i;

// What a typed message says about merging: { numbers } for an instruction to merge, naming the
// pull requests it covers (none named means any pull request already open), or null.
export function mergeInstruction(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const t = text.trim();
  if (SKILL.test(t)) {
    const args = /<command-args>([\s\S]*?)<\/command-args>/i.exec(t)?.[1] ?? t.replace(SKILL, '');
    return { numbers: numbersIn(args) };
  }
  // A question ("should we merge when green?") or a negation is not an instruction.
  if (NEGATED.test(t) || /\?\s*$/.test(t)) return null;
  if (WHOLE.test(t) || CONDITIONAL.test(t)) return { numbers: numbersIn(t) };
  return null;
}

function numbersIn(text) {
  const found = new Set();
  for (const m of text.matchAll(/(?:#|\/pull\/|\bpr\s*#?|\bpull\s+request\s*#?)(\d+)/gi)) found.add(Number(m[1]));
  for (const m of text.matchAll(/\bmerge\b((?:\s*(?:,|and)?\s*#?\d+\b)+)/gi)) for (const n of m[1].matchAll(/\d+/g)) found.add(Number(n[0]));
  for (const m of text.matchAll(/^\s*(\d+)\b/g)) found.add(Number(m[1]));
  return [...found];
}

function targetNumber(target) {
  if (target.kind === 'api') return Number.isFinite(target.number) ? target.number : null;
  const m = /^(?:#)?(\d+)$/.exec(target.ref) ?? /\/pull\/(\d+)/.exec(target.ref);
  return m ? Number(m[1]) : null;
}

// Whether the person's latest typed message is an instruction that covers this merge. Returns
// { covered: true } or { covered: false, why } where why explains a near miss, or is empty.
export function instructionCovers({ transcriptPath, target, describePr = describeWithGh }) {
  const message = latestHumanMessage(transcriptPath);
  const instruction = message && mergeInstruction(message.text);
  if (!instruction) return { covered: false, why: '' };
  let number = targetNumber(target);
  let createdAt = null;
  if (number === null || !instruction.numbers.length) {
    try {
      ({ number, createdAt } = describePr(target));
    } catch {
      return { covered: false, why: '' };
    }
  }
  if (instruction.numbers.length) {
    return instruction.numbers.includes(number) ? { covered: true } : { covered: false, why: ` Your latest instruction names #${instruction.numbers.join(', #')}, not #${number}.` };
  }
  const opened = Date.parse(createdAt);
  const said = Date.parse(message.timestamp);
  if (Number.isNaN(opened) || Number.isNaN(said)) return { covered: false, why: '' };
  if (opened > said) return { covered: false, why: ` This pull request was opened after your instruction to merge, which named no pull request, so it does not cover this one.` };
  return { covered: true };
}

export function decideMerge({ input, root, listFiles = listWithGh, describePr = describeWithGh }) {
  const target = mergeTarget(input);
  if (!target) return { ask: false, reason: '' };
  const loaded = readConfig(root);
  if (!loaded) return { ask: false, reason: '' };
  let files;
  try {
    files = listFiles(target);
  } catch (e) {
    return { ask: true, reason: `rfr-process: could not list the pull request's files (${e.message}), so it may touch gated process folders, where merging is the approver's decision. Confirm only if you are the approver and want it merged now.` };
  }
  const gated = new Set(gatedStages(loaded.config));
  const touched = files.filter(file => {
    const stage = stageOf(file);
    if (!stage || !gated.has(stage)) return false;
    if (stage !== 'specs') return true;
    const local = path.join(root, file);
    return !fs.existsSync(local) || hasId(fs.readFileSync(local, 'utf8'));
  });
  if (!touched.length) return { ask: false, reason: '' };
  const { covered, why } = instructionCovers({ transcriptPath: input.transcript_path, target, describePr });
  if (covered) return { ask: false, reason: '' };
  return {
    ask: true,
    reason: `rfr-process: this pull request touches gated process files (${touched.slice(0, 5).join(', ')}${touched.length > 5 ? ', ...' : ''}). Merging it approves them.${why} Confirm only if you are the approver and want it merged now; the agent should then comment on the pull request with your instruction.`,
  };
}

export function askOutput(reason) {
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } });
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch { /* not JSON: nothing to check */ }
  const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const { ask, reason } = decideMerge({ input, root });
  if (ask) process.stdout.write(askOutput(reason));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();
