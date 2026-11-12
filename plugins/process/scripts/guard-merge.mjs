#!/usr/bin/env node
// PreToolUse (shell commands, and the GitHub MCP merge and auto-merge tools): an agent's merge of a pull request that
// touches a gated process folder needs the person's confirmation (docs/specs/project-process.md,
// "Approval records"). In solo mode the approver's merge is the approval, so the hook asks: the
// permission prompt is where the approver confirms, which turns an instruction like "merge it when
// green" into a recorded decision instead of something the agent does on its own. When the person's
// latest typed message in the session already says to merge (AC-52), that is the confirmation, and
// the hook does not ask again: "merge when green" is carried out when CI finishes. Projects without
// docs/product/process.yml are not affected, and neither are stages whose gate is notify or agent. The
// pull request's files come from gh, or, where there is no gh (cloud sessions), from git fetching the
// pull request's head; if neither can list them, it asks as well, and says why.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hasId, readConfig, readWorkMode, stagesWithGate, stageOf } from './lib/process.mjs';
import { approvedTasks, latestInput, mergeInstruction, openedInSession, standingInstructions } from './lib/task-approval.mjs';

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

function git(cwd, args, timeout = 8000) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout });
  if (r.error || r.status !== 0) throw new Error((r.error?.message ?? r.stderr ?? '').trim() || `git exited ${r.status}`);
  return r.stdout.trim();
}

// The pull request's files from git alone, for sessions with no gh (cloud sessions merge with the
// GitHub MCP tools): fetch refs/pull/<n>/head from origin and diff it against its merge base with the
// default branch. Only for a pull request on this repository's origin, named by number.
export function listWithGit(target, root) {
  const number = target.kind === 'unknown' ? null : targetNumber(target);
  if (number === null) throw new Error('the pull request has no number the guard can fetch');
  const origin = git(root, ['remote', 'get-url', 'origin'], 5000);
  if (target.kind === 'api') {
    const repo = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(origin);
    if (!repo || repo[1].toLowerCase() !== String(target.owner).toLowerCase() || repo[2].toLowerCase() !== String(target.repo).toLowerCase()) {
      throw new Error(`#${number} is in ${target.owner}/${target.repo}, not this checkout's origin`);
    }
  }
  git(root, ['fetch', '--quiet', '--no-tags', 'origin', `+refs/pull/${number}/head:refs/rfr/pull/${number}`]);
  let base = '';
  for (const ref of ['origin/HEAD', 'origin/main', 'origin/master']) {
    try { base = git(root, ['merge-base', ref, `refs/rfr/pull/${number}`], 5000); break; } catch { /* try the next */ }
  }
  if (!base) throw new Error('no default branch to compare the pull request with');
  return git(root, ['diff', '--name-only', base, `refs/rfr/pull/${number}`]).split('\n').map(s => s.trim()).filter(Boolean);
}

// gh first, then git: either one listing the files is enough.
function listFilesDefault(target, root) {
  try {
    return listWithGh(target);
  } catch (ghError) {
    try {
      return listWithGit(target, root);
    } catch (gitError) {
      throw new Error(`gh: ${ghError.message}; git: ${gitError.message}`);
    }
  }
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

// What a typed message says about merging: { numbers } for an instruction to merge, naming the pull
// requests it covers (none named means any pull request already open), or null. The recognizer is
// rfr-core's (docs/specs/task-approval.md), copied in by the build.
export { mergeInstruction };

function targetNumber(target) {
  if (target.kind === 'api') return Number.isFinite(target.number) ? target.number : null;
  const m = /^(?:#)?(\d+)$/.exec(target.ref) ?? /\/pull\/(\d+)/.exec(target.ref);
  return m ? Number(m[1]) : null;
}

// Whether the person's latest input is an instruction that covers this merge: their latest typed
// message, or their answer to the agent's own question when that came later (task-approval AC-1).
// Returns { covered: true, quote } or { covered: false, why } where why explains a near miss, or is empty.
export function instructionCovers({ transcriptPath, target, describePr = describeWithGh }) {
  const tasks = approvedTasks(latestInput(transcriptPath));
  const instruction = tasks?.merge;
  // A standing instruction ("merge each PR when green") covers every pull request this session
  // opened, whatever the person has typed since, until they withdraw it (task-approval AC-9 to AC-11).
  const own = targetNumber(target) !== null && openedInSession(transcriptPath, targetNumber(target), target.kind === 'api' ? target : {});
  const standing = own ? standingInstructions(transcriptPath).merge : null;
  const viaStanding = standing ? { covered: true, quote: standing.replace(/\s+/g, ' ').trim().slice(0, 90) } : null;
  if (!instruction) return viaStanding ?? { covered: false, why: '' };
  const message = { timestamp: tasks.timestamp };
  let number = targetNumber(target);
  let createdAt = null;
  const quoted = () => tasks.quote.replace(/\s+/g, ' ').trim().slice(0, 90);
  // The pull request this session opened is the one its "merge when green" is about, even when the
  // instruction came first ("fix it, open a PR, and merge when green"); no lookup needed.
  if (!instruction.numbers.length && number !== null && openedInSession(transcriptPath, number, target.kind === 'api' ? target : {})) {
    return { covered: true, quote: quoted() };
  }
  if (number === null || !instruction.numbers.length) {
    try {
      ({ number, createdAt } = describePr(target));
    } catch {
      return viaStanding ?? { covered: false, why: '' };
    }
  }
  const quote = quoted();
  if (instruction.numbers.length) {
    return instruction.numbers.includes(number) ? { covered: true, quote } : viaStanding ?? { covered: false, why: ` Your latest instruction names #${instruction.numbers.join(', #')}, not #${number}.` };
  }
  const opened = Date.parse(createdAt);
  const said = Date.parse(message.timestamp);
  if (Number.isNaN(opened) || Number.isNaN(said)) return viaStanding ?? { covered: false, why: '' };
  if (opened > said) return viaStanding ?? { covered: false, why: ` This pull request was opened after your instruction to merge, which named no pull request, so it does not cover this one.` };
  return { covered: true, quote };
}

// Whether the project turned task approval off (task-approval AC-6): then a covered merge is not
// asked about, as before, but is not approved either, so Claude Code's own rules decide.
function taskApprovalOff(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.claude', 'rfr.json'), 'utf8'))?.taskApproval === 'off';
  } catch {
    return false;
  }
}

export function decideMerge({ input, root, listFiles = listFilesDefault, describePr = describeWithGh }) {
  const target = mergeTarget(input);
  if (!target) return { ask: false, reason: '' };
  const loaded = readConfig(root);
  if (!loaded) return { ask: false, reason: '' };
  let files;
  try {
    files = listFiles(target, root);
  } catch (e) {
    return { ask: true, reason: `rfr-process: could not list the pull request's files (${e.message}), so it may touch gated process folders, where merging is the approver's decision. Confirm only if you are the approver and want it merged now.` };
  }
  // Only approve gates make the merge the approver's decision; notify and agent stages do not ask
  // (process plan 23b).
  const gated = new Set(stagesWithGate(loaded.config, readWorkMode(root), 'approve'));
  const touched = files.filter(file => {
    const stage = stageOf(file);
    if (!stage || !gated.has(stage)) return false;
    if (stage !== 'specs') return true;
    const local = path.join(root, file);
    return !fs.existsSync(local) || hasId(fs.readFileSync(local, 'utf8'));
  });
  if (!touched.length) return { ask: false, reason: '' };
  const { covered, why, quote } = instructionCovers({ transcriptPath: input.transcript_path, target, describePr });
  if (covered) {
    if (taskApprovalOff(root)) return { ask: false, reason: '' };
    return { ask: false, allow: true, reason: `rfr-process (task approval): approved by your message "${quote}"` };
  }
  return {
    ask: true,
    reason: `rfr-process: this pull request touches gated process files (${touched.slice(0, 5).join(', ')}${touched.length > 5 ? ', ...' : ''}). Merging it approves them.${why} Confirm only if you are the approver and want it merged now; the agent should then comment on the pull request with your instruction.`,
  };
}

export function askOutput(reason) {
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } });
}

export function allowOutput(reason) {
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', permissionDecisionReason: reason } });
}

export function denyOutput(reason) {
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
}

// Whether the project keeps Claude Code's own prompts ("permissions": "ask" in .claude/rfr.json).
function permissionsAsk(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.claude', 'rfr.json'), 'utf8'))?.permissions === 'ask';
  } catch {
    return false;
  }
}

// Under default allow, a merge that needs the person's review is a review stop, not a prompt
// (default-allow AC-4): the guard refuses, and the reason tells the agent to stop and report.
export function reviewStopReason(reason) {
  const what = reason.replace(/\s*Confirm only if you are the approver[\s\S]*$/, '').trim();
  return `${what} This merge is the person's review, so do not merge it and do not ask for a prompt: stop, tell the person this pull request is waiting for their review and why, and carry on with other work. Merge it when they say so.`;
}

export function mergeOutput({ ask, allow, reason }, root) {
  if (ask) return permissionsAsk(root) ? askOutput(reason) : denyOutput(reviewStopReason(reason));
  if (allow) return allowOutput(reason);
  return '';
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch { /* not JSON: nothing to check */ }
  const root = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const out = mergeOutput(decideMerge({ input, root }), root);
  if (out) process.stdout.write(out);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();
