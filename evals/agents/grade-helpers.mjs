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
