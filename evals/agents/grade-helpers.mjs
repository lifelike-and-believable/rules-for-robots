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

// Splits a plan into its slices. A plan names its units in many ways ("Slice 1", "Work package 2",
// "Step 3", or a bare numbered list) and may carry other numbered lists (decisions, findings).
// Lines that name a unit win when there are at least two; otherwise take the numbered list under a
// heading that sounds like the plan, or failing that the longest numbered list. Each chunk's first
// line is its title.
const LEAD = '^ {0,3}(?:#{1,4}\\s*|\\*\\*)?';
const NAMED_UNIT = new RegExp(`${LEAD}(?:slice|work[- ]?package|package|step|task|phase|stage|t)\\s*\\d+\\b`, 'i');
// A numbered list item, or a table row whose first cell is a number or a label such as "T1" or "S1".
const NUMBERED = new RegExp(`${LEAD}\\d+[.)]\\s|^\\s*\\|\\s*(?:\\*\\*)?(?:t|s|task\\s*|slice\\s*)?\\d+(?:\\*\\*)?(?:\\s*\\([^)]*\\))?\\s*\\|`, 'i');
const PLAN_HEADING = /slice|package|plan|step|task|sequence|breakdown|order|work/i;
const NOT_PLAN_HEADING = /decision|question|risk|assum|found|current|already|scope|not required|suggest|extra|left out|open/i;

function chunksStartingAt(lines, isStart) {
  const chunks = [];
  for (const line of lines) {
    if (isStart.test(line)) chunks.push([line]);
    else if (chunks.length) chunks.at(-1).push(line);
  }
  // A table row's title is its task cell (the second column), not every column.
  const titleOf = line => {
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    return line.trim().startsWith('|') && cells.length > 1 ? cells[1] : line.trim();
  };
  return chunks.map(c => ({ title: titleOf(c[0]), body: c.join('\n') }));
}

export function splitSlices(text) {
  const lines = text.split('\n');
  if (lines.filter(l => NAMED_UNIT.test(l)).length >= 2) return chunksStartingAt(lines, NAMED_UNIT);

  // Segments between headings and bold-only label lines, each with the heading that opens it.
  const segments = [{ heading: '', lines: [] }];
  for (const line of lines) {
    if (/^#{1,4}\s/.test(line) || /^\s*\*\*[^*]+\*\*:?\s*$/.test(line)) segments.push({ heading: line, lines: [] });
    else segments.at(-1).lines.push(line);
  }
  const lists = segments.map(s => ({ ...s, slices: chunksStartingAt(s.lines, NUMBERED) })).filter(s => s.slices.length >= 2);
  if (!lists.length) return [];
  const planLike = lists.filter(s => PLAN_HEADING.test(s.heading) && !NOT_PLAN_HEADING.test(s.heading));
  if (planLike.length) return planLike.reduce((best, s) => (s.slices.length > best.slices.length ? s : best)).slices;
  return lists.reduce((best, s) => (s.slices.length >= best.slices.length ? s : best)).slices;
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
