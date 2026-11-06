#!/usr/bin/env node
// Intake for feedback issues on rules-for-robots (docs/specs/feedback.md, AC-5). Runs from
// .github/workflows/feedback-intake.yml when an issue is opened or edited. Issue text is data: it
// is parsed and scanned, never run, and nothing private it may contain is copied into a comment.
//   opened: label triage:new; ask once for missing required fields (versions, what happened; not
//           area, which triage assigns) with needs-info; list open feedback
//           issues with closely matching titles; label check-privacy if the scan finds anything.
//   edited: remove needs-info once the fields are filled in; re-run the privacy scan.
// Env: GITHUB_EVENT_PATH, GITHUB_REPOSITORY, GITHUB_TOKEN, GITHUB_API_URL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIELDS, scanPrivate } from '../../plugins/feedback/scripts/feedback.mjs';

const MARKER = '<!-- rfr-feedback-intake -->';
const LABELS = {
  'triage:new': ['0E8A16', 'Feedback waiting for the maintainer to triage'],
  'needs-info': ['FBCA04', 'Feedback missing a required field'],
  'check-privacy': ['D93F0B', 'Feedback that may contain details not meant to be public'],
};

export const isFeedback = issue => !issue.pull_request && ((issue.labels ?? []).some(l => (l.name ?? l) === 'feedback') || /^Feedback:/i.test(issue.title ?? ''));

// "### Label\n\nvalue" sections, as GitHub renders an issue form; "_No response_" is empty.
export function parseFields(body) {
  const byLabel = new Map();
  for (const m of String(body ?? '').matchAll(/^###\s+(.+?)\s*\n([\s\S]*?)(?=^###\s|(?![\s\S]))/gm)) {
    const value = m[2].trim();
    byLabel.set(m[1].trim().toLowerCase(), value === '_No response_' ? '' : value);
  }
  return Object.fromEntries(FIELDS.map(f => [f.id, byLabel.get(f.label.toLowerCase()) ?? '']));
}

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'when', 'not', 'are', 'its', 'feedback']);
const words = title => new Set(String(title).toLowerCase().replace(/^feedback:\s*/, '').split(/[^a-z0-9-]+/).filter(w => w.length > 2 && !STOP.has(w)));
export function similarity(a, b) {
  const x = words(a); const y = words(b);
  if (!x.size || !y.size) return 0;
  const shared = [...x].filter(w => y.has(w)).length;
  return shared / (x.size + y.size - shared);
}

export async function runIntake({ issue, action = 'opened', repo, fetch = globalThis.fetch, api = 'https://api.github.com', token }) {
  const result = { skipped: false, labels: [], removed: [], comment: null };
  if (!isFeedback(issue)) { result.skipped = true; return result; }
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' };
  const call = async (method, p, body) => {
    const r = await fetch(`${api}${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) };
  };

  const fields = parseFields(issue.body);
  const missing = FIELDS.filter(f => f.required && !fields[f.id]);
  const privacy = [...new Set(scanPrivate([issue.title, issue.body].join('\n')).map(f => f.kind))];
  const has = name => (issue.labels ?? []).some(l => (l.name ?? l) === name);
  const notes = [];

  if (action === 'opened') {
    result.labels.push('triage:new');
    if (missing.length) {
      result.labels.push('needs-info');
      notes.push(`Thank you. Please add ${missing.map(f => `**${f.label}**`).join(', ')} by editing the issue; versions are the rfr-core and rfr-process versions or the rules-for-robots commit you were using.`);
    }
    const open = await call('GET', `/repos/${repo}/issues?labels=feedback&state=open&per_page=100`);
    const similar = (open.ok ? open.data : [])
      .filter(o => o.number !== issue.number && !o.pull_request && similarity(o.title, issue.title) >= 0.5)
      .map(o => `#${o.number}`);
    if (similar.length) notes.push(`Possibly the same as ${similar.join(', ')}. The maintainer will link or close duplicates when triaging.`);
  } else if (has('needs-info') && !missing.length) {
    result.removed.push('needs-info');
  }
  if (privacy.length && !has('check-privacy')) {
    result.labels.push('check-privacy');
    notes.push(`This issue is public. It may contain ${privacy.map(k => k.replace('-', ' ')).join(', ')} details; please check them and edit the issue if they should not be here.`);
  }

  if (result.labels.length) {
    for (const name of result.labels) await call('POST', `/repos/${repo}/labels`, { name, color: LABELS[name][0], description: LABELS[name][1] });
    await call('POST', `/repos/${repo}/issues/${issue.number}/labels`, { labels: result.labels });
  }
  for (const name of result.removed) await call('DELETE', `/repos/${repo}/issues/${issue.number}/labels/${encodeURIComponent(name)}`);
  if (notes.length) {
    const existing = await call('GET', `/repos/${repo}/issues/${issue.number}/comments?per_page=100`);
    const already = (existing.ok ? existing.data : []).some(c => String(c.body ?? '').includes(MARKER));
    if (!already || action !== 'opened') {
      result.comment = `${MARKER}\n${notes.join('\n\n')}`;
      await call('POST', `/repos/${repo}/issues/${issue.number}/comments`, { body: result.comment });
    }
  }
  return result;
}

async function main() {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const r = await runIntake({
    issue: event.issue, action: event.action, repo: process.env.GITHUB_REPOSITORY,
    api: process.env.GITHUB_API_URL || 'https://api.github.com', token: process.env.GITHUB_TOKEN,
  });
  console.log(r.skipped ? 'Not a feedback issue.' : `Labels added: ${r.labels.join(', ') || 'none'}; removed: ${r.removed.join(', ') || 'none'}; ${r.comment ? 'commented' : 'no comment'}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch(e => { console.error(e.message); process.exit(1); });
