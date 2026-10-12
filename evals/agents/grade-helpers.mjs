// Helpers for the architect and tech-lead eval cases (arch-*, lead-*).
import fs from 'node:fs';
import path from 'node:path';

// Paths the agent added or changed, from git status.
export function changedPaths(git) {
  return git('status', '--porcelain', '--untracked-files=all').split('\n').filter(Boolean).map(l => l.slice(3).trim().replace(/^"|"$/g, ''));
}

// What the design says: the final message plus any ADR the agent added.
export function designText(dir, adrPaths, finalText) {
  return [finalText, ...adrPaths.map(p => fs.readFileSync(path.join(dir, p), 'utf8'))].join('\n\n');
}

// In the rules+agents arm the main session has to have called the named agent; other arms
// have no agent to call.
export function agentInvoked(arm, tools, agentName) {
  if (arm !== 'rules+agents') return true;
  return tools.some(t => ['Agent', 'Task'].includes(t.name) && String(t.input?.subagent_type ?? '').endsWith(agentName));
}

// Splits a plan into slices at "Slice N" headings, or at numbered top-level lines when the
// plan does not use that word. Each chunk's first line is its title.
export function splitSlices(text) {
  const lead = '^\\s*(?:#{1,4}\\s*|\\*\\*|[-*]\\s+)?';
  const sliceWord = new RegExp(`${lead}slice\\s*\\d+`, 'i');
  const numbered = new RegExp(`${lead}(?:slice\\s*\\d+|\\d+[.)]\\s)`, 'i');
  const starts = text.split('\n').some(l => sliceWord.test(l)) ? sliceWord : numbered;
  const chunks = [];
  for (const line of text.split('\n')) {
    if (starts.test(line)) chunks.push([line]);
    else if (chunks.length) chunks.at(-1).push(line);
  }
  return chunks.map(lines => ({ title: lines[0].trim(), body: lines.join('\n') }));
}

// For review cases with planted defects: which of them the review mentions. `defects` maps a
// name to a pattern that a review of that defect would match.
export function plantedFound(text, defects) {
  const found = Object.entries(defects).filter(([, re]) => re.test(text)).map(([name]) => name);
  return { found, count: found.length };
}

// Findings by severity, counted from the "[severity]" markers of the standard finding format.
export function severityCounts(text) {
  const counts = { blocker: 0, major: 0, minor: 0, nit: 0 };
  for (const m of text.matchAll(/\[(blocker|major|minor|nit)\]/gi)) counts[m[1].toLowerCase()]++;
  return counts;
}

// True when at least `min` findings use the standard Problem / Failure scenario / Fix lines.
export function standardFormat(text, min = 3) {
  const n = Math.min((text.match(/^\s*Problem:/gim) ?? []).length, (text.match(/^\s*Failure scenario:/gim) ?? []).length, (text.match(/^\s*Fix:/gim) ?? []).length);
  return n >= min;
}
