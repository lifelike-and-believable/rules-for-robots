// Task approval (docs/specs/task-approval.md): the person approves tasks, not commands. When the
// person's latest input in the session asks for a task (release a version, push a named branch, merge
// a pull request, deploy a preview), a command that carries out that task, and nothing else, is
// approved without a prompt. The input is the person's latest typed message, or their answer to the
// agent's own AskUserQuestion when that came later (AC-1). Tool results, notifications, other
// sessions, and subagents never count. This file is copied into rfr-web and rfr-process by the build.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseCommand } from './shell-writes.mjs';

// The text of a typed message: a string, or the text blocks of a content list. A message holding a
// tool result is not typed text.
function messageText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content) || content.some(block => block?.type === 'tool_result')) return '';
  return content.filter(block => block?.type === 'text').map(block => block.text).join('\n');
}

// The person's latest input in a transcript, or null when there is none or the file cannot be read.
// { kind: 'typed', text, timestamp } for a message Claude Code marks origin.kind "human", or
// { kind: 'answer', pairs: [{ question, answer }], timestamp } for the answer to an AskUserQuestion
// call made in the main conversation (paired by tool_use_id; Claude Code writes the chosen labels to
// toolUseResult.answers). Subagent (sidechain) and meta entries are skipped.
export function latestInput(transcriptPath) {
  if (!transcriptPath) return null;
  let lines;
  try {
    lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
  } catch {
    return null;
  }
  const entries = [];
  const askIds = new Set();
  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    entries.push(entry);
    if (entry?.type === 'assistant' && !entry.isSidechain && Array.isArray(entry.message?.content)) {
      for (const block of entry.message.content) if (block?.type === 'tool_use' && block.name === 'AskUserQuestion') askIds.add(block.id);
    }
  }
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry?.type !== 'user' || entry.isSidechain || entry.isMeta) continue;
    if (entry.origin?.kind === 'human') {
      const text = messageText(entry.message?.content).trim();
      if (text) return { kind: 'typed', text, timestamp: entry.timestamp ?? '' };
      continue;
    }
    const content = Array.isArray(entry.message?.content) ? entry.message.content : [];
    const answered = content.some(block => block?.type === 'tool_result' && askIds.has(block.tool_use_id));
    const answers = entry.toolUseResult?.answers;
    if (answered && answers && typeof answers === 'object') {
      const pairs = Object.entries(answers).map(([question, answer]) => ({ question: String(question), answer: String(answer) }));
      if (pairs.length) return { kind: 'answer', pairs, timestamp: entry.timestamp ?? '' };
    }
  }
  return null;
}

// Merge instructions, as rfr-process's merge guard has recognized them since project-process AC-52.
const MERGE_NEGATED = /\b(don'?t|do\s+not|never|not|no|without|hold\s+off|stop|wait\s+(before|to))\b[^.!?\n]{0,30}\bmerg/i;
const MERGE_SKILL = /(?:^|<command-name>)\s*\/(?:[\w-]+:)?merge-when-green\b/i;
const MERGE_WHOLE = /^(?:(?:yes|ok(?:ay)?|sure|great|thanks)[,.!]?\s+)?(?:please\s+)?(?:go\s+ahead\s+(?:and\s+)?)?(?:squash[- ]|rebase[- ])?merge\b(?:\s+(?:it|this|that|them|both|all|the\s+pr|pr|pull\s+request))?(?:\s*(?:#?\d+|pr\s*#?\d+|https:\/\/\S+\/pull\/\d+)(?:\s*(?:,|and)\s*#?\d+)*)?(?:\s+(?:now|when|once|after|if)\b[^.!?\n]{0,40})?(?:,?\s+(?:please|thanks))?[.!]*$/i;
const MERGE_CONDITIONAL = /\bmerge\b[^.!?\n]{0,40}\b(?:when|once|after|if)\b[^.!?\n]{0,30}\b(?:green|pass(?:es|ing)?|ci|checks?)\b/i;

export function prNumbersIn(text) {
  const found = new Set();
  for (const m of text.matchAll(/(?:#|\/pull\/|\bpr\s*#?|\bpull\s+request\s*#?)(\d+)/gi)) found.add(Number(m[1]));
  for (const m of text.matchAll(/\bmerge\b((?:\s*(?:,|and)?\s*#?\d+\b)+)/gi)) for (const n of m[1].matchAll(/\d+/g)) found.add(Number(n[0]));
  for (const m of text.matchAll(/^\s*(\d+)\b/g)) found.add(Number(m[1]));
  return [...found];
}

// What a typed message says about merging: { numbers } (none named means any pull request already
// open when the message was given), or null.
export function mergeInstruction(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const t = text.trim();
  if (MERGE_SKILL.test(t)) {
    const args = /<command-args>([\s\S]*?)<\/command-args>/i.exec(t)?.[1] ?? t.replace(MERGE_SKILL, '');
    return { numbers: prNumbersIn(args) };
  }
  if (MERGE_NEGATED.test(t) || /\?\s*$/.test(t)) return null;
  if (MERGE_WHOLE.test(t) || MERGE_CONDITIONAL.test(t)) return { numbers: prNumbersIn(t) };
  // A merge clause joined to other tasks: "merge 301, then release 5.11.0", "merge and release 5.11.0".
  for (const clause of t.split(/[,;]|\.\s|\bthen\b|\band\s+(?=(?:then\s+)?(?:release|publish|tag|push|deploy|continue|carry\s+on|start|move\s+on)\b)/i)) {
    const c = clause.trim().replace(/^(?:and\s+)?(?:then\s+)?/i, '');
    if (c && MERGE_WHOLE.test(c)) return { numbers: prNumbersIn(c) };
  }
  return null;
}

// An answer that turns the question down approves nothing: no, not yet, skip, later, I'll do it, or
// "other" text the agent did not offer (AC-1).
const DECLINED = /^\s*(no\b|nope|not\s+(now|yet)|skip|later|cancel|stop|wait|hold|don'?t|do\s+not|i'?ll\b|i\s+will\b|let\s+me\b|other\b)/i;
const negated = verb => new RegExp(`\\b(don'?t|do\\s+not|never|not|no|without|hold\\s+off|stop|wait\\s+(before|to))\\b[^.!?\\n]{0,30}\\b${verb}`, 'i');
const VERSION = /^v?\d+\.\d+\.\d+(?:[-+][\w.]+)?$/i;
const STOP_BRANCH = new Set(['it', 'this', 'that', 'them', 'the', 'changes', 'commits', 'branch', 'branches', 'to', 'origin', 'up', 'everything', 'all', 'now', 'and']);

// The tasks one piece of text asks for. `question` is true for the text of an AskUserQuestion pair,
// whose question part ends with "?" by nature; a typed message that is itself a question asks for nothing.
export function tasksIn(text, { question = false } = {}) {
  const tasks = { releases: [], branches: [], deployPreview: false, merge: null };
  if (typeof text !== 'string' || !text.trim()) return tasks;
  const t = text.trim();
  if (!question && /\?\s*$/.test(t)) return tasks;
  if (!negated('(release|publish|tag)').test(t)) {
    for (const m of t.matchAll(/\b(?:release|publish|tag)\s+(?:version\s+)?`?((?:[A-Za-z][\w.-]*-)?v?\d+\.\d+\.\d+(?:[-+][\w.]+)?)`?/gi)) tasks.releases.push(m[1]);
  }
  if (!negated('push').test(t)) {
    for (const m of t.matchAll(/\bpush\s+(?:the\s+)?(?:branch\s+)?(?:to\s+)?(?:origin\s+)?`?([A-Za-z0-9][\w./-]*)`?/gi)) {
      const name = m[1].replace(/[.,]+$/, '');
      if (!STOP_BRANCH.has(name.toLowerCase()) && /[A-Za-z]/.test(name)) tasks.branches.push(name);
    }
  }
  if (!negated('deploy').test(t) && /\b(?:preview\s+deploy(?:ment)?|deploy\s+(?:a\s+|the\s+)?preview|deploy\s+to\s+(?:a\s+)?preview)\b/i.test(t)) tasks.deployPreview = true;
  tasks.merge = question ? (negated('merg').test(t) || !/\bmerge/i.test(t) ? null : { numbers: prNumbersIn(t) }) : mergeInstruction(t);
  return tasks;
}

// The tasks the person's latest input approves, with the words quoted in the reason.
export function approvedTasks(input) {
  if (!input) return null;
  if (input.kind === 'typed') return { ...tasksIn(input.text), quote: input.text, timestamp: input.timestamp };
  const merged = { releases: [], branches: [], deployPreview: false, merge: null, quote: '', timestamp: input.timestamp };
  for (const { question, answer } of input.pairs) {
    if (DECLINED.test(answer)) continue;
    const found = tasksIn(`${question}\n${answer}`, { question: true });
    merged.releases.push(...found.releases);
    merged.branches.push(...found.branches);
    merged.deployPreview ||= found.deployPreview;
    if (found.merge) merged.merge = { numbers: [...(merged.merge?.numbers ?? []), ...found.merge.numbers] };
    if (found.releases.length || found.branches.length || found.deployPreview || found.merge) merged.quote ||= `${answer} (to: ${question})`;
  }
  return merged;
}

// Whether a tag is the release a person named: the same tag, or the named version with or without
// a "v" and a prefix such as "rfr-".
export function tagMatches(tag, named) {
  if (!tag || !named) return false;
  if (tag === named) return true;
  if (!VERSION.test(named)) return false;
  const version = named.replace(/^v/i, '').replace(/[.+]/g, m => `\\${m}`);
  return new RegExp(`^(?:[A-Za-z][\\w.-]*-)?v?${version}$`, 'i').test(tag);
}

// The text of a tool result's content: a string, or the text blocks of a content list.
function resultText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map(block => (typeof block === 'string' ? block : block?.type === 'text' ? block.text : '')).join('\n');
}

// Whether this session opened the pull request: the transcript holds a call that created it (the
// GitHub MCP create_pull_request tool, or a shell command running gh pr create) whose result links to
// it, as .../pull/<number> (in owner/repo when they are known). A merge instruction that names no pull
// request covers the pull request its own task opened, even after the instruction (project-process
// AC-52, amended 2026-11-12). Subagents count: they work for the session. Anything unreadable gives false.
export function openedInSession(transcriptPath, number, { owner, repo } = {}) {
  if (!transcriptPath || !Number.isInteger(number)) return false;
  let lines;
  try {
    lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
  } catch {
    return false;
  }
  const escape = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const link = new RegExp(`${owner && repo ? `github\\.com/${escape(owner)}/${escape(repo)}` : ''}/pull/${number}(?!\\d)`, 'i');
  const creations = new Set();
  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const content = Array.isArray(entry?.message?.content) ? entry.message.content : [];
    if (entry?.type === 'assistant') {
      for (const block of content) {
        if (block?.type !== 'tool_use') continue;
        const creates = /^mcp__.*create_pull_request$/i.test(block.name ?? '')
          || (/^(Bash|PowerShell)$/.test(block.name ?? '') && /\bgh\s+pr\s+create\b/.test(String(block.input?.command ?? '')));
        if (creates) creations.add(block.id);
      }
    } else if (entry?.type === 'user') {
      for (const block of content) {
        if (block?.type === 'tool_result' && creations.has(block.tool_use_id) && !block.is_error && link.test(resultText(block.content))) return true;
      }
    }
  }
  return false;
}

// Standing instructions (AC-9 to AC-11): "merge each PR when green", "push each branch as you go".
// One stays in force across the person's later messages until a message withdraws it, and covers
// only the pull requests and branches the session itself created.
// "each" and "every" only with what they count ("each PR", "every one"), so "merge when every check
// passes" is not standing.
const EACH = String.raw`(?:(?:each|every)\s+(?:one|of\s+them|(?:new\s+)?(?:prs?|pull\s+requests?|branch(?:es)?))|as\s+(?:you\s+go|we\s+go|they\s+(?:go|turn|come)|each\s+(?:one|is))|along\s+the\s+way|one\s+(?:by\s+one|at\s+a\s+time)|in\s+turn)`;
const STANDING_MERGE = new RegExp(String.raw`\bmerg(?:e|ing)\b[^.!?\n]{0,40}\b${EACH}\b|\b(?:each|every|all)\s+(?:the\s+)?(?:prs?|pull\s+requests?)\b[^.!?\n]{0,40}\bmerg|\bkeep\s+merging\b`, 'i');
const STANDING_PUSH = new RegExp(String.raw`\bpush(?:ing)?\b[^.!?\n]{0,40}\b${EACH}\b|\b(?:each|every|all)\s+(?:the\s+)?branch(?:es)?\b[^.!?\n]{0,40}\bpush|\bkeep\s+pushing\b`, 'i');
// A message that stops everything: "stop", "pause", "hold on", "wait".
const STOP_ALL = /^\s*(?:ok(?:ay)?[,.!]?\s+)?(?:stop|pause|halt|hold\s+(?:on|off|it)|wait)\b/i;

// The standing instructions in force at the end of the transcript: { merge, push }, each the quoted
// message that gave it, or null. Only messages the person typed grant or withdraw one; a later
// message that says not to merge (or push), or to stop, withdraws it (AC-10).
export function standingInstructions(transcriptPath) {
  const standing = { merge: null, push: null };
  if (!transcriptPath) return standing;
  let lines;
  try {
    lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
  } catch {
    return standing;
  }
  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry?.type !== 'user' || entry.isSidechain || entry.isMeta || entry.origin?.kind !== 'human') continue;
    const text = messageText(entry.message?.content).trim();
    if (!text) continue;
    if (STOP_ALL.test(text)) { standing.merge = null; standing.push = null; continue; }
    if (negated('merg').test(text)) standing.merge = null;
    if (negated('push').test(text)) standing.push = null;
    if (/\?\s*$/.test(text)) continue;
    if (!negated('merg').test(text) && STANDING_MERGE.test(text)) standing.merge = text;
    if (!negated('push').test(text) && STANDING_PUSH.test(text)) standing.push = text;
  }
  return standing;
}

// Whether this session created the branch: a shell command it ran, that succeeded, made it
// (git switch -c, git checkout -b, git branch, git worktree add -b). Anything unreadable gives false.
export function branchCreatedInSession(transcriptPath, branch) {
  if (!transcriptPath || !branch) return false;
  let lines;
  try {
    lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
  } catch {
    return false;
  }
  const escape = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const b = escape(branch);
  const makes = new RegExp(String.raw`\bgit\s+(?:switch\s+(?:-c|-C|--create|--force-create)|checkout\s+(?:-b|-B)|worktree\s+add\s+(?:\S+\s+)*?(?:-b|-B)|branch(?:\s+--?\w[\w-]*)*)\s+["']?${b}["']?(?=\s|$|;|&)`);
  const creations = new Set();
  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const content = Array.isArray(entry?.message?.content) ? entry.message.content : [];
    if (entry?.type === 'assistant') {
      for (const block of content) {
        if (block?.type === 'tool_use' && /^(Bash|PowerShell)$/.test(block.name ?? '') && makes.test(String(block.input?.command ?? ''))) creations.add(block.id);
      }
    } else if (entry?.type === 'user') {
      for (const block of content) {
        if (block?.type === 'tool_result' && creations.has(block.tool_use_id) && !block.is_error) return true;
      }
    }
  }
  return false;
}

function gitOut(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 5000 });
  return r.status === 0 ? r.stdout.trim() : '';
}

// The default branch names a push must never be approved for: the remote's HEAD, plus main and master.
export function defaultBranches(cwd) {
  const head = gitOut(cwd, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).replace(/^origin\//, '');
  return new Set(['main', 'master', ...(head ? [head] : [])]);
}

const NEVER_PUSH = /^(-f|--force|--force-with-lease(=.*)?|--force-if-includes|-d|--delete|--tags|--all|--mirror|--prune|--no-verify|-n|--dry-run)$/;
const NEVER_MERGE = /^(--admin|-d|--delete-branch|--disable-auto)$/;
const NEVER_DEPLOY = /^(--prod|--production|promote|alias|aliases|domains|rollback|rm|remove|env|--target=production)$/i;

// The one command a command line runs, or null when it runs several, redirects output, or
// substitutes another command, so an approval never covers more than it names (AC-2).
function singleCommand(command) {
  if (typeof command !== 'string' || /[`]|\$\(|<\(|>\(/.test(command)) return null;
  const parsed = parseCommand(command);
  if (!parsed || parsed.length !== 1 || parsed[0].redirects.length || parsed[0].scripts.length) return null;
  return parsed[0].words;
}

// What a shell command does, as a task: { task: 'release' | 'push' | 'merge' | 'deploy-preview', target },
// or null when it is not one of the tasks, or does something no instruction may approve (AC-3).
export function commandTask(command, { cwd = process.cwd(), defaults = defaultBranches(cwd) } = {}) {
  const w = singleCommand(command);
  if (!w || !w.length) return null;
  if (w[0] === 'git' && w[1] === 'tag') {
    const rest = w.slice(2);
    const i = rest.findIndex(x => x === '-a' || x === '--annotate' || x === '-s' || x === '--sign');
    if (i === -1) return null;
    const args = rest.filter((x, k) => k !== i);
    const tag = args[0];
    if (!tag || tag.startsWith('-')) return null;
    const tail = args.slice(1);
    for (let k = 0; k < tail.length; k++) {
      if (tail[k] === '-m' || tail[k] === '--message') { k++; continue; }
      if (/^-/.test(tail[k]) || !/^[0-9a-f]{7,40}$/i.test(tail[k]) || k !== tail.length - 1) return null;
    }
    return { task: 'release', target: tag };
  }
  if (w[0] === 'git' && w[1] === 'push') {
    const rest = w.slice(2);
    if (rest.some(x => NEVER_PUSH.test(x))) return null;
    const refs = rest.filter(x => x !== '-u' && x !== '--set-upstream');
    if (refs.length !== 2 || refs[0] !== 'origin') return null;
    const ref = refs[1];
    if (/[:+^~*]/.test(ref) || ref.startsWith('-') || ref.startsWith('refs/')) return null;
    if (defaults.has(ref)) return null;
    return { task: 'push', target: ref };
  }
  if (w[0] === 'gh' && w[1] === 'release' && w[2] === 'create') {
    const tag = w[3];
    if (!tag || tag.startsWith('-')) return null;
    return { task: 'release', target: tag };
  }
  if (w[0] === 'gh' && w[1] === 'pr' && w[2] === 'merge') {
    const rest = w.slice(3);
    if (rest.some(x => NEVER_MERGE.test(x))) return null;
    const VALUE = new Set(['-b', '--body', '-F', '--body-file', '-t', '--subject', '--match-head-commit', '-A', '--author-email', '-R', '--repo']);
    let ref = null;
    for (let k = 0; k < rest.length; k++) {
      if (VALUE.has(rest[k])) { k++; continue; }
      if (!rest[k].startsWith('-')) { if (ref) return null; ref = rest[k]; }
    }
    const number = ref ? Number(/^#?(\d+)$/.exec(ref)?.[1] ?? /\/pull\/(\d+)/.exec(ref)?.[1] ?? NaN) : null;
    if (ref && !Number.isFinite(number)) return null;
    return { task: 'merge', target: number };
  }
  let v = w;
  if (['npx', 'bunx'].includes(v[0])) v = v.slice(1);
  else if (v[0] === 'pnpm' && v[1] === 'dlx') v = v.slice(2);
  if (v[0] === 'vercel') {
    const rest = v.slice(1);
    if (rest[0] && !rest[0].startsWith('-') && rest[0] !== 'deploy') return null;
    if (rest.some(x => NEVER_DEPLOY.test(x))) return null;
    for (let k = 0; k < rest.length; k++) if (rest[k] === '--target' && /^prod/i.test(rest[k + 1] ?? '')) return null;
    return { task: 'deploy-preview', target: null };
  }
  return null;
}

// A Vercel MCP call as a task: a deployment that does not target production, or null (AC-2, AC-3).
export function mcpTask(toolName, toolInput) {
  if (typeof toolName !== 'string' || !/^mcp__.*vercel/i.test(toolName)) return null;
  const action = toolName.slice(toolName.lastIndexOf('__') + 2).toLowerCase();
  if (!/^(create_deployment|deploy(_to_vercel|_project)?)$/.test(action)) return null;
  const text = typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput ?? {});
  if (/"(target|environment)"\s*:\s*"prod|--prod\b|"production"\s*:\s*true/i.test(text)) return null;
  return { task: 'deploy-preview', target: null };
}

// GitHub's opening time for a pull request, so a merge instruction that names no pull request
// covers those already open when it was given, besides the one the session opened (project-process AC-52).
function describeWithGh(number, cwd) {
  const r = spawnSync('gh', ['pr', 'view', ...(number ? [String(number)] : []), '--json', 'number,createdAt'], { cwd, encoding: 'utf8', timeout: 8000 });
  if (r.status !== 0) throw new Error((r.stderr || 'gh pr view failed').trim());
  return JSON.parse(r.stdout);
}

// Whether the person's latest input approves this task. Returns { reason } or null.
export function approval(found, { transcriptPath, cwd = process.cwd(), describePr = describeWithGh } = {}) {
  if (!found) return null;
  const tasks = approvedTasks(latestInput(transcriptPath)) ?? { releases: [], branches: [], deployPreview: false, merge: null, quote: '' };
  let ok = false;
  if (found.task === 'release') ok = tasks.releases.some(named => tagMatches(found.target, named));
  else if (found.task === 'push') ok = tasks.branches.includes(found.target) || tasks.releases.some(named => tagMatches(found.target, named));
  else if (found.task === 'deploy-preview') ok = tasks.deployPreview;
  else if (found.task === 'merge' && tasks.merge) {
    let number = found.target;
    if (tasks.merge.numbers.length && number !== null) ok = tasks.merge.numbers.includes(number);
    else if (!tasks.merge.numbers.length && number !== null && openedInSession(transcriptPath, number)) ok = true;
    else {
      try {
        const pr = describePr(number, cwd);
        number = pr.number;
        ok = tasks.merge.numbers.length ? tasks.merge.numbers.includes(number) : Date.parse(pr.createdAt) <= Date.parse(tasks.timestamp);
      } catch {
        ok = false;
      }
    }
  }
  let quote = tasks.quote;
  // A standing instruction covers the session's own pull requests and branches (AC-9 to AC-11).
  if (!ok && (found.task === 'merge' || found.task === 'push')) {
    const standing = standingInstructions(transcriptPath);
    if (found.task === 'merge' && standing.merge && found.target !== null && openedInSession(transcriptPath, found.target)) {
      ok = true;
      quote = standing.merge;
    } else if (found.task === 'push' && standing.push && branchCreatedInSession(transcriptPath, found.target)) {
      ok = true;
      quote = standing.push;
    }
  }
  if (!ok) return null;
  quote = quote.replace(/\s+/g, ' ').trim();
  return { reason: `rfr-core (task approval): approved by your ${quote.length > 90 ? `message "${quote.slice(0, 87)}..."` : `message "${quote}"`}` };
}
