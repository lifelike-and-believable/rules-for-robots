#!/usr/bin/env node
// Drafts feedback for rules-for-robots (docs/specs/feedback.md in that repository): an issue body,
// a link to the repository's feedback form with every field filled in, and a scan for details
// that are usually private. Plain Node, no dependencies.
//
//   node feedback.mjs check <draft.json>   list possible private details, line by line
//   node feedback.mjs body  <draft.json>   print the issue body (for gh issue create --body-file)
//   node feedback.mjs url   <draft.json>   print the form link (when gh is not available)
//
// A draft is JSON: { "title", "area", "versions", "happened", "evidence", "suggestion", "source" }.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = 'lifelike-and-believable/rules-for-robots';
export const MAX_URL = 8000;

// The form's field IDs (.github/ISSUE_TEMPLATE/feedback.yml) and the headings GitHub renders.
export const FIELDS = [
  { id: 'area', label: 'Area' },
  { id: 'versions', label: 'Versions', required: true },
  { id: 'happened', label: 'What happened', required: true },
  { id: 'evidence', label: 'Evidence' },
  { id: 'suggestion', label: 'Suggestion' },
  { id: 'source', label: 'Kind of project' },
];

const titleOf = draft => `Feedback: ${String(draft.title ?? '').replace(/^Feedback:\s*/i, '')}`;

// The body in the shape GitHub gives an issue filed through the form, so intake reads both alike.
export function issueBody(draft) {
  return FIELDS.map(f => `### ${f.label}\n\n${(draft[f.id] ?? '').trim() || '_No response_'}`).join('\n\n') + '\n';
}

export function issueUrl(draft) {
  const params = new URLSearchParams({ template: 'feedback.yml', title: titleOf(draft) });
  for (const f of FIELDS) if (draft[f.id]) params.set(f.id, draft[f.id]);
  const url = `https://github.com/${REPO}/issues/new?${params}`;
  return { url, tooLong: url.length > MAX_URL };
}

const PATTERNS = [
  ['email', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ['token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|xox[abprs]-[A-Za-z0-9-]{10,})/],
  ['home-path', /(?:\/Users\/|\/home\/)[^\s/]+|[A-Za-z]:\\Users\\[^\s\\]+/],
  ['ip-address', /(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.]*\d)/],
];
const GITHUB_REPO = /https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)/g;

// Details that are usually not the reporter's to publish: one finding per kind per line, in order.
export function scanPrivate(text) {
  const findings = [];
  for (const [i, line] of String(text).split(/\r?\n/).entries()) {
    for (const [kind, re] of PATTERNS) if (re.test(line)) findings.push({ kind, line: i + 1 });
    const others = [...line.matchAll(GITHUB_REPO)].filter(m => `${m[1]}/${m[2]}`.toLowerCase() !== REPO);
    if (others.length) findings.push({ kind: 'other-repository', line: i + 1 });
  }
  return findings;
}

function main([command, file]) {
  if (!['check', 'body', 'url'].includes(command) || !file) {
    console.error('usage: node feedback.mjs check|body|url <draft.json>');
    process.exit(2);
  }
  const draft = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (command === 'check') {
    const text = [draft.title, ...FIELDS.map(f => draft[f.id] ?? '')].join('\n');
    const findings = scanPrivate(text);
    if (!findings.length) { console.log('No likely private details found. Read the draft anyway before filing.'); return; }
    for (const f of findings) console.log(`${f.kind}: line ${f.line} of the draft (title, then each field in order)`);
    process.exit(1);
  }
  if (command === 'body') { process.stdout.write(issueBody(draft)); return; }
  const { url, tooLong } = issueUrl(draft);
  if (tooLong) { console.error(`The link would be ${url.length} characters, more than GitHub accepts (${MAX_URL}). Shorten the evidence, or file with gh.`); process.exit(1); }
  console.log(url);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
