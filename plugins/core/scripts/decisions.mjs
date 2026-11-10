#!/usr/bin/env node
// The decision queue (docs/improvement-plan.md, slice 19c). A question only the project lead can
// answer goes to one place instead of stopping the session: an issue labelled `needs-lead` in the
// project's repository, with the options, the agent's default, and the date the default takes
// effect. The agent continues on the default. A question about an action that cannot be undone has
// no default: that work waits for the answer.
//
//   node decisions.mjs ask --question <text> --option <label>=<text>... [--default <label>] [--days <n>] [--irreversible] [--context <text>] [--repo <owner/name>]
//   node decisions.mjs list [--json] [--repo <owner/name>]
//     Open questions with their state: answered (the lead commented with an option or "Answer:"),
//     due (no answer, and the default's date has passed), or waiting.
//   node decisions.mjs close <number> --applied <label or text> [--repo <owner/name>]
//     Comments what was applied and closes the issue.
// Needs gh. Exit codes: 0 done, 1 gh failed, 2 usage error.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LABEL = 'needs-lead';
export const MARKER = '<!-- rfr-decision -->';
export const DEFAULT_DAYS = 2;

const day = d => d.toISOString().slice(0, 10);

export function formatBody({ question, options, defaultLabel = null, effective = null, irreversible = false, context = '' }) {
  if (!question || !options?.length) throw new Error('a question needs text and at least one option');
  if (irreversible && defaultLabel) throw new Error('a question about an irreversible action has no default');
  if (defaultLabel && !options.some(o => o.label === defaultLabel)) throw new Error(`the default "${defaultLabel}" is not one of the options`);
  const lines = [MARKER, `**Question:** ${question}`, '', '**Options:**', ...options.map(o => `- ${o.label}: ${o.text}`), ''];
  lines.push(irreversible
    ? '**Default:** none. This is about an action that cannot be undone, so the work it affects waits for your answer.'
    : `**Default:** ${defaultLabel} (takes effect ${effective})`);
  if (context) lines.push('', `**Context:** ${context}`);
  lines.push('', 'Answer with a comment naming an option (for example "B"), or "Answer:" and your own words.');
  return lines.join('\n');
}

export function parseBody(body) {
  const text = String(body ?? '');
  if (!text.includes(MARKER)) return null;
  const question = /\*\*Question:\*\* (.*)/.exec(text)?.[1]?.trim() ?? '';
  const options = [...text.matchAll(/^- ([A-Za-z0-9]+): (.*)$/gm)].map(m => ({ label: m[1], text: m[2].trim() }));
  const def = /\*\*Default:\*\* ([A-Za-z0-9]+) \(takes effect (\d{4}-\d{2}-\d{2})\)/.exec(text);
  return { question, options, defaultLabel: def?.[1] ?? null, effective: def?.[2] ?? null, irreversible: !def };
}

// The lead's answer, from the latest comment by someone other than a bot or the queue itself (whose
// comments start with the marker): it names an option on its first line ("B", "Option B", "B,
// because ...") or starts with "Answer:". A latest comment that does neither ("Actually, let me
// think") leaves the question unanswered, even if an earlier one named an option.
export function findAnswer(comments, options) {
  const c = [...(comments ?? [])].reverse().find(x => {
    const body = String(x.body ?? '').trim();
    return body && !body.startsWith(MARKER) && !/\[bot\]$/.test(x.author ?? '');
  });
  if (!c) return null;
  const body = String(c.body).trim();
  const free = /^answer:\s*([\s\S]+)/i.exec(body);
  if (free) return { label: null, text: free[1].trim(), author: c.author ?? null };
  const first = body.split('\n')[0];
  const option = options.find(o => new RegExp(`^(option\\s+)?${o.label}\\b`, 'i').test(first));
  return option ? { label: option.label, text: option.text, author: c.author ?? null } : null;
}

export function stateOf(issue, today = new Date()) {
  const parsed = parseBody(issue.body);
  if (!parsed) return null;
  const answer = findAnswer(issue.comments, parsed.options);
  const due = !answer && !parsed.irreversible && parsed.effective !== null && parsed.effective <= day(today);
  return { number: issue.number, title: issue.title, ...parsed, answer, state: answer ? 'answered' : due ? 'due' : 'waiting' };
}

export function effectiveDate(days = DEFAULT_DAYS, today = new Date()) {
  return day(new Date(today.getTime() + days * 86400000));
}

function gh(args, run) {
  const r = run('gh', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`gh ${args.slice(0, 2).join(' ')} failed: ${(r.stderr ?? '').trim()}`);
  return r.stdout ?? '';
}
const repoArgs = repo => (repo ? ['--repo', repo] : []);

export function ask(opts, { run = spawnSync, today = new Date() } = {}) {
  const effective = opts.irreversible ? null : effectiveDate(opts.days ?? DEFAULT_DAYS, today);
  const body = formatBody({ ...opts, effective });
  const title = `Decision needed: ${opts.question}`.slice(0, 120);
  // The label may not exist yet in a new repository; creating it again is harmless.
  try { gh(['label', 'create', LABEL, '--color', 'D93F0B', '--description', 'A question for the project lead, with the default the agent proceeded on', ...repoArgs(opts.repo)], run); } catch { /* already there */ }
  return gh(['issue', 'create', '--title', title, '--label', LABEL, '--body', body, ...repoArgs(opts.repo)], run).trim();
}

export function list({ repo, run = spawnSync, today = new Date() } = {}) {
  const issues = JSON.parse(gh(['issue', 'list', '--label', LABEL, '--state', 'open', '--limit', '200', '--json', 'number,title,body,comments', ...repoArgs(repo)], run));
  return issues
    .map(i => stateOf({ ...i, comments: (i.comments ?? []).map(c => ({ body: c.body, author: c.author?.login ?? null })) }, today))
    .filter(Boolean);
}

export function close(number, applied, { repo, run = spawnSync } = {}) {
  gh(['issue', 'close', String(number), '--comment', `${MARKER}\nApplied: ${applied}`, ...repoArgs(repo)], run);
}

export function formatList(items) {
  if (!items.length) return 'No open questions for the project lead.';
  return items.map(i => {
    const head = `#${i.number} [${i.state}] ${i.question}`;
    const opts = i.options.map(o => `    ${o.label}${o.label === i.defaultLabel ? ' (default)' : ''}: ${o.text}`).join('\n');
    const tail = i.answer
      ? `    Answer${i.answer.author ? ` from ${i.answer.author}` : ''}: ${i.answer.label ?? i.answer.text}`
      : i.irreversible ? '    No default: the work it affects waits.' : `    Default ${i.defaultLabel} takes effect ${i.effective}.`;
    return `${head}\n${opts}\n${tail}`;
  }).join('\n\n');
}

function parseArgs(argv) {
  const out = { options: [], _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--option') {
      const [label, ...rest] = String(argv[++i] ?? '').split('=');
      out.options.push({ label: label.trim(), text: rest.join('=').trim() });
    } else if (a === '--irreversible' || a === '--json') out[a.slice(2)] = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  return out;
}

function main(argv) {
  const [command, ...rest] = argv;
  const o = parseArgs(rest);
  try {
    if (command === 'ask') {
      if (!o.question || !o.options.length || o.options.some(x => !x.label || !x.text) || (!o.irreversible && !o.default)) {
        console.error('Usage: decisions.mjs ask --question <text> --option <label>=<text>... (--default <label> [--days <n>] | --irreversible) [--context <text>]');
        process.exit(2);
      }
      console.log(ask({ question: o.question, options: o.options, defaultLabel: o.default ?? null, days: o.days ? Number(o.days) : undefined, irreversible: !!o.irreversible, context: o.context ?? '', repo: o.repo }));
    } else if (command === 'list') {
      const items = list({ repo: o.repo });
      console.log(o.json ? JSON.stringify(items, null, 2) : formatList(items));
    } else if (command === 'close') {
      if (!o._[0] || !o.applied) { console.error('Usage: decisions.mjs close <number> --applied <label or text>'); process.exit(2); }
      close(o._[0], o.applied, { repo: o.repo });
      console.log(`Closed #${o._[0]}.`);
    } else {
      console.error('Usage: decisions.mjs ask|list|close ...');
      process.exit(2);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(e.message.startsWith('gh ') ? 1 : 2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
